// ─────────────────────────────────────────────
// Environment guard
// ─────────────────────────────────────────────

const isBrowser = typeof window !== "undefined";

// ─────────────────────────────────────────────
// localStorage — safe JSON wrapper
// ─────────────────────────────────────────────

export const ls = {
  /**
   * Get a value from localStorage, parsed as JSON.
   * Returns `fallback` if the key is missing or JSON parsing fails.
   */
  get(key, fallback = null) {
    if (!isBrowser) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Set a value in localStorage, serialized as JSON.
   * Silently ignores errors (e.g. quota exceeded, private mode).
   */
  set(key, value) {
    if (!isBrowser) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },

  /**
   * Remove a key from localStorage.
   */
  remove(key) {
    if (!isBrowser) return;
    try { localStorage.removeItem(key); } catch {}
  },

  /**
   * Remove all keys in localStorage.
   */
  clear() {
    if (!isBrowser) return;
    try { localStorage.clear(); } catch {}
  },

  /**
   * Get all keys in localStorage.
   * @returns {string[]}
   */
  keys() {
    if (!isBrowser) return [];
    try { return Object.keys(localStorage); } catch { return []; }
  },

  /**
   * Check whether a key exists.
   */
  has(key) {
    if (!isBrowser) return false;
    try { return localStorage.getItem(key) !== null; } catch { return false; }
  },
};

// ─────────────────────────────────────────────
// sessionStorage — safe JSON wrapper
// ─────────────────────────────────────────────

export const ss = {
  get(key, fallback = null) {
    if (!isBrowser) return fallback;
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    if (!isBrowser) return;
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  },

  remove(key) {
    if (!isBrowser) return;
    try { sessionStorage.removeItem(key); } catch {}
  },

  clear() {
    if (!isBrowser) return;
    try { sessionStorage.clear(); } catch {}
  },

  has(key) {
    if (!isBrowser) return false;
    try { return sessionStorage.getItem(key) !== null; } catch { return false; }
  },
};

// ─────────────────────────────────────────────
// Cookies
// ─────────────────────────────────────────────

export const cookie = {
  /**
   * Get a cookie value by name. Returns null if not found.
   */
  get(name) {
    if (!isBrowser) return null;
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${encodeURIComponent(name)}=`));
    return match ? decodeURIComponent(match.split("=")[1]) : null;
  },

  /**
   * Set a cookie.
   * @param {string}  name
   * @param {string}  value
   * @param {object}  opts
   * @param {number}  opts.days      - Expiry in days (default 7)
   * @param {string}  opts.path      - Cookie path (default "/")
   * @param {string}  opts.sameSite  - "Lax" | "Strict" | "None"
   * @param {boolean} opts.secure    - Https only (default false)
   * @param {string}  opts.domain    - Cookie domain
   */
  set(name, value, opts = {}) {
    if (!isBrowser) return;
    const { days = 7, path = "/", sameSite = "Lax", secure = false, domain } = opts;
    const expires = new Date(Date.now() + days * 864_00_000).toUTCString();
    let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    str += `; expires=${expires}`;
    str += `; path=${path}`;
    str += `; SameSite=${sameSite}`;
    if (secure) str += "; Secure";
    if (domain)  str += `; domain=${domain}`;
    document.cookie = str;
  },

  /**
   * Delete a cookie by name.
   */
  remove(name, path = "/") {
    if (!isBrowser) return;
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
  },

  /**
   * Check if a cookie exists.
   */
  has(name) {
    return this.get(name) !== null;
  },

  /**
   * Get all cookies as a plain object.
   * @returns {Record<string, string>}
   */
  all() {
    if (!isBrowser) return {};
    return Object.fromEntries(
      document.cookie.split("; ")
        .filter(Boolean)
        .map((pair) => pair.split("=").map(decodeURIComponent))
    );
  },
};

// ─────────────────────────────────────────────
// In-memory cache (LRU-style with TTL)
// ─────────────────────────────────────────────

/**
 * Create an in-memory cache with optional TTL.
 *
 * @param {number} ttl - Time-to-live in ms (0 = no expiry)
 * @returns {{ get, set, has, delete, clear, size }}
 *
 * @example
 * const cache = createCache(60_000); // 1 minute TTL
 * cache.set("key", data);
 * cache.get("key"); // → data or null if expired
 */
export function createCache(ttl = 0) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (ttl > 0 && Date.now() - entry.ts > ttl) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },

    set(key, value) {
      store.set(key, { value, ts: Date.now() });
    },

    has(key) {
      const entry = store.get(key);
      if (!entry) return false;
      if (ttl > 0 && Date.now() - entry.ts > ttl) { store.delete(key); return false; }
      return true;
    },

    delete(key) { store.delete(key); },

    clear() { store.clear(); },

    get size() { return store.size; },
  };
}

// ─────────────────────────────────────────────
// Versioned storage (auto-invalidates on version change)
// ─────────────────────────────────────────────

/**
 * A storage wrapper that namespaces keys by version.
 * When version changes, old data is automatically ignored (not deleted).
 *
 * @param {string} namespace - e.g. "app"
 * @param {string} version   - e.g. "v2"
 * @param {"local"|"session"} storageType
 */
export function createVersionedStorage(namespace, version, storageType = "local") {
  const store = storageType === "session" ? ss : ls;
  const prefix = `${namespace}__${version}__`;

  return {
    get:    (key, fb) => store.get(`${prefix}${key}`, fb),
    set:    (key, val) => store.set(`${prefix}${key}`, val),
    remove: (key) => store.remove(`${prefix}${key}`),
    has:    (key) => store.has(`${prefix}${key}`),
    clear() {
      for (const k of ls.keys()) {
        if (k.startsWith(`${namespace}__`)) ls.remove(k);
      }
    },
  };
}