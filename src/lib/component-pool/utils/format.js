// ─────────────────────────────────────────────
// Currency & Numbers
// ─────────────────────────────────────────────

/**
 * Format a number as a locale-aware currency string.
 * @param {number} value
 * @param {string} currency - ISO 4217 code, e.g. "USD", "EUR", "INR"
 * @param {string} locale   - BCP 47 locale string, e.g. "en-US", "de-DE"
 * @example formatCurrency(1299.9, "USD") → "$1,299.90"
 */
export function formatCurrency(value, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format large numbers with compact K / M / B suffix.
 * @example formatCompact(1500000) → "1.5M"
 */
export function formatCompact(n, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Format a number with thousand-separator commas.
 * @example formatNumber(1234567.89) → "1,234,567.89"
 */
export function formatNumber(n, decimals = 0, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Format a ratio (0–1) as a percentage string.
 * @example formatPercent(0.1234) → "12.34%"
 */
export function formatPercent(ratio, decimals = 1, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(ratio);
}

/**
 * Format bytes to human-readable file size.
 * @example formatBytes(1536) → "1.5 KB"
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// ─────────────────────────────────────────────
// Dates & Time
// ─────────────────────────────────────────────

/**
 * Format a date value with Intl.DateTimeFormat.
 * @param {Date|string|number} date
 * @param {Intl.DateTimeFormatOptions} opts
 * @example formatDate("2024-01-15") → "Jan 15, 2024"
 */
export function formatDate(date, opts = {}) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...opts,
  }).format(new Date(date));
}

/**
 * Format a date as a short locale string.
 * @example formatDateShort("2024-01-15") → "1/15/24"
 */
export function formatDateShort(date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(new Date(date));
}

/**
 * Format a date including time.
 * @example formatDateTime("2024-01-15T14:30:00") → "Jan 15, 2024, 2:30 PM"
 */
export function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

/**
 * Format a relative time string (e.g. "3 days ago", "in 2 hours").
 * Automatically picks the best unit.
 * @param {Date|string|number} date
 * @example formatRelativeTime(new Date(Date.now() - 3 * 86400000)) → "3 days ago"
 */
export function formatRelativeTime(date) {
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units = [
    ["year",   31_536_000],
    ["month",   2_592_000],
    ["week",      604_800],
    ["day",        86_400],
    ["hour",        3_600],
    ["minute",         60],
    ["second",          1],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) {
      return rtf.format(Math.round(diff / seconds), unit);
    }
  }
  return "just now";
}

/**
 * Format a duration in seconds to mm:ss or hh:mm:ss.
 * @example formatDuration(3665) → "1:01:05"
 */
export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ─────────────────────────────────────────────
// Strings
// ─────────────────────────────────────────────

/**
 * Truncate a string to n characters, appending "…".
 * @example truncate("Hello world", 7) → "Hell…"
 */
export function truncate(str, n = 100) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

/**
 * Truncate a string at the nearest word boundary.
 * @example truncateWords("Hello world foo", 8) → "Hello…"
 */
export function truncateWords(str, n = 100) {
  if (!str || str.length <= n) return str ?? "";
  return str.slice(0, n).replace(/\s\S*$/, "") + "…";
}

/**
 * Convert a string to a URL-safe slug.
 * @example slugify("Hello World! 123") → "hello-world-123"
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Convert a camelCase or snake_case string to Title Case.
 * @example toTitleCase("helloWorld") → "Hello World"
 */
export function toTitleCase(str) {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Capitalize the first letter of a string.
 * @example capitalize("hello world") → "Hello world"
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract initials from a full name (up to 2 characters).
 * @example getInitials("John Doe") → "JD"
 */
export function getInitials(name = "") {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Mask a string, leaving only the last n characters visible.
 * @example maskString("4111111111111234", 4) → "············1234"
 */
export function maskString(str, visible = 4, char = "·") {
  if (!str || str.length <= visible) return str ?? "";
  return char.repeat(str.length - visible) + str.slice(-visible);
}

/**
 * Count words in a string.
 */
export function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate reading time in minutes.
 * @param {string} text - Raw text content
 * @param {number} wpm  - Words per minute (default 200)
 */
export function readingTime(text, wpm = 200) {
  const words = wordCount(text);
  const mins = Math.ceil(words / wpm);
  return `${mins} min read`;
}

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────

/**
 * Format a phone number to (xxx) xxx-xxxx (US).
 * Falls back to raw string if it can't parse.
 * @example formatPhone("8005551234") → "(800) 555-1234"
 */
export function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/**
 * Ordinal suffix for a number.
 * @example ordinal(21) → "21st"
 */
export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Convert a hex color to an rgba() string.
 * @example hexToRgba("#3b82f6", 0.5) → "rgba(59, 130, 246, 0.5)"
 */
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}