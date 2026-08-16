// ─────────────────────────────────────────────
// API Error class
// ─────────────────────────────────────────────

/**
 * Structured API error with HTTP status, response data, and request details.
 */
export class ApiError extends Error {
  /**
   * @param {string}  message
   * @param {number}  status   - HTTP status code (0 = network error / timeout)
   * @param {any}     data     - Parsed response body (if available)
   * @param {string}  url      - Request URL
   */
  constructor(message, status = 0, data = null, url = "") {
    super(message);
    this.name   = "ApiError";
    this.status = status;
    this.data   = data;
    this.url    = url;
  }

  get isNetworkError()      { return this.status === 0; }
  get isUnauthorized()      { return this.status === 401; }
  get isForbidden()         { return this.status === 403; }
  get isNotFound()          { return this.status === 404; }
  get isServerError()       { return this.status >= 500; }
  get isClientError()       { return this.status >= 400 && this.status < 500; }
  get isValidationError()   { return this.status === 422; }
  get isRateLimited()       { return this.status === 429; }
}

// ─────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────

const DEFAULT_TIMEOUT = 15_000; // 15 seconds
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY = 1_000; // 1 second

// ─────────────────────────────────────────────
// Interceptors
// ─────────────────────────────────────────────

/** @type {Array<(config: RequestInit & { url: string }) => RequestInit & { url: string }>} */
const requestInterceptors = [];

/** @type {Array<(data: any, response: Response) => any>} */
const responseInterceptors = [];

/** @type {Array<(error: ApiError) => void>} */
const errorInterceptors = [];

export const interceptors = {
  /** Add a function that modifies every outgoing request */
  onRequest(fn) { requestInterceptors.push(fn); return () => requestInterceptors.splice(requestInterceptors.indexOf(fn), 1); },

  /** Add a function that transforms every successful response */
  onResponse(fn) { responseInterceptors.push(fn); return () => responseInterceptors.splice(responseInterceptors.indexOf(fn), 1); },

  /** Add a function called on every error (for global logging / toast) */
  onError(fn) { errorInterceptors.push(fn); return () => errorInterceptors.splice(errorInterceptors.indexOf(fn), 1); },
};

// ─────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────

/**
 * Production-grade fetch wrapper.
 *
 * @param {string} url
 * @param {object} options
 * @param {Record<string, string>} [options.headers]
 * @param {any}    [options.body]       - Will be JSON-serialized automatically
 * @param {string} [options.method]
 * @param {number} [options.timeout]    - ms (default 15 000)
 * @param {number} [options.retries]    - Retry count on 5xx / network errors
 * @param {number} [options.retryDelay] - ms between retries (doubles each time)
 * @param {string} [options.baseURL]    - Prepended to relative URLs
 * @param {"json"|"text"|"blob"|"arrayBuffer"|"formData"|null} [options.responseType]
 * @returns {Promise<any>}
 */
export async function apiFetch(url, options = {}) {
  const {
    timeout    = DEFAULT_TIMEOUT,
    retries    = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    baseURL    = "",
    responseType,
    body,
    headers = {},
    ...fetchOpts
  } = options;

  // Build full URL
  let fullURL = baseURL ? `${baseURL.replace(/\/$/, "")}/${url.replace(/^\//, "")}` : url;

  // Build headers
  const mergedHeaders = {
    ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  // Build request config
  let config = {
    ...fetchOpts,
    url:     fullURL,
    headers: mergedHeaders,
    body:    body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  };

  // Run request interceptors
  for (const fn of requestInterceptors) {
    config = fn(config) ?? config;
  }

  const { url: finalURL, ...finalConfig } = config;

  // Retry loop
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(finalURL, {
        ...finalConfig,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Parse response
      let data;
      const type = responseType ?? (response.headers.get("content-type")?.includes("application/json") ? "json" : "text");

      if (response.status === 204 || response.headers.get("content-length") === "0") {
        data = null;
      } else {
        try {
          data = type === "json"        ? await response.json()
               : type === "blob"        ? await response.blob()
               : type === "arrayBuffer" ? await response.arrayBuffer()
               : type === "formData"    ? await response.formData()
               : await response.text();
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const err = new ApiError(
          data?.message ?? data?.error ?? `HTTP ${response.status}`,
          response.status,
          data,
          finalURL
        );
        for (const fn of errorInterceptors) fn(err);

        // Retry on 5xx
        if (response.status >= 500 && attempt < retries) {
          attempt++;
          await sleep(retryDelay * attempt);
          continue;
        }
        throw err;
      }

      // Run response interceptors
      let result = data;
      for (const fn of responseInterceptors) result = fn(result, response) ?? result;
      return result;

    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) throw err;

      // AbortError = timeout
      const isTimeout = err.name === "AbortError";
      const apiErr = new ApiError(
        isTimeout ? `Request timed out after ${timeout}ms` : err.message ?? "Network error",
        0,
        null,
        finalURL
      );
      for (const fn of errorInterceptors) fn(apiErr);

      if (attempt < retries) {
        attempt++;
        await sleep(retryDelay * attempt);
        continue;
      }
      throw apiErr;
    }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// Convenience methods
// ─────────────────────────────────────────────

export const api = {
  /**
   * GET request.
   * @param {string} url
   * @param {Record<string, any>} [params] - Query params object
   * @param {object} [opts]
   */
  get(url, params, opts = {}) {
    const finalURL = params
      ? `${url}?${new URLSearchParams(params).toString()}`
      : url;
    return apiFetch(finalURL, { method: "GET", ...opts });
  },

  /** POST request with JSON body */
  post(url, body, opts = {}) {
    return apiFetch(url, { method: "POST", body, ...opts });
  },

  /** PUT request with JSON body */
  put(url, body, opts = {}) {
    return apiFetch(url, { method: "PUT", body, ...opts });
  },

  /** PATCH request with JSON body */
  patch(url, body, opts = {}) {
    return apiFetch(url, { method: "PATCH", body, ...opts });
  },

  /** DELETE request */
  delete(url, opts = {}) {
    return apiFetch(url, { method: "DELETE", ...opts });
  },

  /**
   * Upload a file or FormData via multipart POST.
   * @param {string}         url
   * @param {FormData|File}  data
   * @param {object}         [opts]
   * @param {(pct:number)=>void} [opts.onProgress] - Upload progress 0–100
   */
  upload(url, data, opts = {}) {
    // Use XMLHttpRequest for progress reporting
    if (opts.onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(xhr.responseText); }
          } else {
            reject(new ApiError(`HTTP ${xhr.status}`, xhr.status, null, url));
          }
        };
        xhr.onerror = () => reject(new ApiError("Network error", 0, null, url));
        const formData = data instanceof FormData ? data : (() => { const fd = new FormData(); fd.append("file", data); return fd; })();
        xhr.send(formData);
      });
    }

    const formData = data instanceof FormData ? data : (() => { const fd = new FormData(); fd.append("file", data); return fd; })();
    return apiFetch(url, { method: "POST", body: formData, ...opts });
  },
};

// ─────────────────────────────────────────────
// API client factory
// ─────────────────────────────────────────────

/**
 * Create a pre-configured API client instance.
 * Each instance has its own interceptors and base config.
 *
 * @param {object} config
 * @param {string} config.baseURL
 * @param {Record<string,string>} [config.headers] - Default headers
 * @param {number} [config.timeout]
 * @param {number} [config.retries]
 *
 * @example
 * export const apiClient = createApiClient({
 *   baseURL: process.env.NEXT_PUBLIC_API_URL,
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 */
export function createApiClient(config = {}) {
  const { baseURL = "", headers: defaultHeaders = {}, timeout, retries } = config;

  const defaults = { baseURL, timeout, retries, headers: defaultHeaders };

  return {
    get:    (url, params, opts = {}) => api.get(url, params, { ...defaults, ...opts }),
    post:   (url, body, opts = {})   => api.post(url, body, { ...defaults, ...opts }),
    put:    (url, body, opts = {})   => api.put(url, body, { ...defaults, ...opts }),
    patch:  (url, body, opts = {})   => api.patch(url, body, { ...defaults, ...opts }),
    delete: (url, opts = {})         => api.delete(url, { ...defaults, ...opts }),
    upload: (url, data, opts = {})   => api.upload(url, data, { ...defaults, ...opts }),

    /** Update auth token for this client */
    setToken(token) {
      defaults.headers = { ...defaults.headers, Authorization: `Bearer ${token}` };
    },

    /** Remove auth token */
    clearToken() {
      const { Authorization: _, ...rest } = defaults.headers;
      defaults.headers = rest;
    },
  };
}