import { useState, useEffect, useCallback, useRef } from "react";

// =====================
// useLocalStorage
// =====================
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

// =====================
// useToggle
// =====================
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}

// =====================
// useDebounce
// =====================
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// =====================
// useClickOutside
// =====================
export function useClickOutside(handler) {
  const ref = useRef(null);
  useEffect(() => {
    const listener = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        handler(e);
      }
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [handler]);
  return ref;
}

// =====================
// useMediaQuery
// =====================
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// =====================
// useDarkMode
// =====================
export function useDarkMode() {
  const [isDark, setIsDark] = useLocalStorage("dark-mode", false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);
  return [isDark, setIsDark];
}

// =====================
// useFetch  (simple data fetching)
// =====================
export function useFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(url, { signal: controller.signal, ...options })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [url]);

  return { data, loading, error };
}

// =====================
// useCounter
// =====================
export function useCounter(initial = 0, { min, max } = {}) {
  const [count, setCount] = useState(initial);
  const increment = () => setCount((c) => (max !== undefined ? Math.min(c + 1, max) : c + 1));
  const decrement = () => setCount((c) => (min !== undefined ? Math.max(c - 1, min) : c - 1));
  const reset = () => setCount(initial);
  return { count, increment, decrement, reset, setCount };
}

// =====================
// useForm (simple)
// =====================
export function useForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return { values, errors, touched, setErrors, handleChange, handleBlur, reset, setValues };
}

// =====================
// usePagination
// =====================
export function usePagination(data = [], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(data.length / pageSize);
  const start = (page - 1) * pageSize;
  const items = data.slice(start, start + pageSize);

  return {
    items,
    page,
    totalPages,
    setPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
  };
}