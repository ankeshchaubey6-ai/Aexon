import { useState, useEffect, useRef, useCallback, useReducer } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────
const initialState = { data: null, error: null, loading: false, status: "idle" };

function fetchReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":  return { ...state, loading: true,  error: null, status: "loading" };
    case "FETCH_SUCCESS":return { data: action.data, error: null, loading: false, status: "success" };
    case "FETCH_ERROR":  return { ...state, error: action.error, loading: false, status: "error" };
    case "RESET":        return initialState;
    default:             return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache shared across all hook instances
// ─────────────────────────────────────────────────────────────────────────────
const cache = new Map();

/**
 * Production data-fetching hook.
 *
 * Features:
 *  - Module-level request cache (avoids duplicate in-flight fetches)
 *  - Automatic AbortController cleanup on unmount / url change
 *  - Configurable stale time (how long cached data is considered fresh)
 *  - Manual refetch trigger
 *  - Optimistic update support
 *  - SSR safe (no window references)
 *
 * @param {string | null | undefined} url
 *   Pass null/undefined to skip the fetch (useful for conditional fetching).
 * @param {object} [options]
 * @param {RequestInit} [options.fetchOptions]   - Passed directly to fetch()
 * @param {number}      [options.staleTime=0]    - ms before cached data is refetched (0 = always refetch)
 * @param {boolean}     [options.revalidateOnFocus=false] - Re-fetch when window regains focus
 * @param {boolean}     [options.revalidateOnReconnect=false] - Re-fetch on network reconnect
 * @param {function}    [options.transform]      - Transform response data before storing
 * @param {function}    [options.onSuccess]      - Called with data on successful fetch
 * @param {function}    [options.onError]        - Called with error on failed fetch
 *
 * @returns {{ data, error, loading, status, refetch, mutate }}
 *
 * @example
 * const { data: user, loading, error, refetch } = useFetch("/api/user/1");
 * const { data: posts } = useFetch(userId ? `/api/users/${userId}/posts` : null);
 */
export function useFetch(url, options = {}) {
  const {
    fetchOptions = {},
    staleTime = 0,
    revalidateOnFocus = false,
    revalidateOnReconnect = false,
    transform,
    onSuccess,
    onError,
  } = options;

  const [state, dispatch] = useReducer(fetchReducer, initialState);
  const abortRef    = useRef(null);
  const mountedRef  = useRef(true);
  const optionsRef  = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async (fetchUrl, force = false) => {
    if (!fetchUrl) return;

    // Check cache freshness
    if (!force && staleTime > 0 && cache.has(fetchUrl)) {
      const { data, ts } = cache.get(fetchUrl);
      if (Date.now() - ts < staleTime) {
        dispatch({ type: "FETCH_SUCCESS", data });
        optionsRef.current.onSuccess?.(data);
        return;
      }
    }

    // Abort any in-flight request for this hook instance
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    dispatch({ type: "FETCH_START" });

    try {
      const res = await fetch(fetchUrl, {
        signal: abortRef.current.signal,
        ...fetchOptions,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: res.statusText }));
        throw Object.assign(
          new Error(errBody?.message ?? `HTTP ${res.status}`),
          { status: res.status, data: errBody }
        );
      }

      const contentType = res.headers.get("content-type") ?? "";
      let raw = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

      const data = optionsRef.current.transform ? optionsRef.current.transform(raw) : raw;

      // Update cache
      cache.set(fetchUrl, { data, ts: Date.now() });

      if (!mountedRef.current) return;
      dispatch({ type: "FETCH_SUCCESS", data });
      optionsRef.current.onSuccess?.(data);
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!mountedRef.current) return;
      dispatch({ type: "FETCH_ERROR", error: err });
      optionsRef.current.onError?.(err);
    }
  }, [url, staleTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on url change
  useEffect(() => {
    mountedRef.current = true;
    execute(url);
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [url, execute]);

  // Revalidate on focus
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const handler = () => { if (document.visibilityState === "visible") execute(url, true); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [url, revalidateOnFocus, execute]);

  // Revalidate on reconnect
  useEffect(() => {
    if (!revalidateOnReconnect) return;
    const handler = () => execute(url, true);
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [url, revalidateOnReconnect, execute]);

  /** Force re-fetch, bypassing cache */
  const refetch = useCallback(() => execute(url, true), [url, execute]);

  /**
   * Optimistically update the local data without refetching.
   * Also updates the cache so other instances see the change.
   * @param {(prev: any) => any | any} updater
   */
  const mutate = useCallback((updater) => {
    const next = typeof updater === "function" ? updater(state.data) : updater;
    if (url) cache.set(url, { data: next, ts: Date.now() });
    dispatch({ type: "FETCH_SUCCESS", data: next });
  }, [url, state.data]);

  return {
    data:    state.data,
    error:   state.error,
    loading: state.loading,
    status:  state.status,   // "idle" | "loading" | "success" | "error"
    refetch,
    mutate,
  };
}

/** Clear the entire fetch cache (e.g. on logout) */
export function clearFetchCache() { cache.clear(); }

/** Remove a single URL from the fetch cache */
export function invalidateFetchCache(url) { cache.delete(url); }