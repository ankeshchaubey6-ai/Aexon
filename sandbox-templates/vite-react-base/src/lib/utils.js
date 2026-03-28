import { clsx } from "clsx";

// Merge class names (like shadcn's cn)
export function cn(...inputs) {
  return clsx(inputs);
}

// Format currency
export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// Format date
export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(date));
}

// Truncate string
export function truncate(str, length = 50) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
}

// Debounce function
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Generate random ID
export function generateId(prefix = "") {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

// Capitalize first letter
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Group array by key
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

// Deep clone
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Sleep utility
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Local storage helpers
export const storage = {
  get: (key, fallback = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};