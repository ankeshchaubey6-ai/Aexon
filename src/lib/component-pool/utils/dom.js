// ─────────────────────────────────────────────
// Environment guard
// ─────────────────────────────────────────────

/** True when running in a browser (not SSR / Node) */
export const isBrowser = typeof window !== "undefined";

// ─────────────────────────────────────────────
// Scroll helpers
// ─────────────────────────────────────────────

/**
 * Smooth-scroll to a DOM element by its ID.
 * @param {string} id      - Element ID (without #)
 * @param {number} offset  - Pixels above the element (for sticky headers)
 */
export function scrollToId(id, offset = 80) {
  if (!isBrowser) return;
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

/**
 * Smooth-scroll to a DOM element reference.
 */
export function scrollToEl(el, offset = 80) {
  if (!isBrowser || !el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

/** Scroll to the top of the page */
export function scrollToTop(behavior = "smooth") {
  if (!isBrowser) return;
  window.scrollTo({ top: 0, behavior });
}

/** Scroll to the bottom of the page */
export function scrollToBottom(behavior = "smooth") {
  if (!isBrowser) return;
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
}

/**
 * Get the current scroll progress (0–1) of the page.
 */
export function getScrollProgress() {
  if (!isBrowser) return 0;
  const { scrollY, innerHeight } = window;
  const { scrollHeight } = document.documentElement;
  return Math.min(scrollY / (scrollHeight - innerHeight), 1);
}

// ─────────────────────────────────────────────
// Scroll lock
// ─────────────────────────────────────────────

let _scrollY = 0;

/**
 * Prevent the page from scrolling (for modals, drawers).
 * Preserves scroll position to avoid layout jump.
 */
export function lockScroll() {
  if (!isBrowser) return;
  _scrollY = window.scrollY;
  document.body.style.cssText = `
    position: fixed;
    top: -${_scrollY}px;
    left: 0;
    right: 0;
    overflow-y: scroll;
  `;
}

/**
 * Re-enable page scrolling, restoring exact position.
 */
export function unlockScroll() {
  if (!isBrowser) return;
  document.body.style.cssText = "";
  window.scrollTo(0, _scrollY);
}

// ─────────────────────────────────────────────
// Clipboard
// ─────────────────────────────────────────────

/**
 * Copy text to the clipboard.
 * Uses the modern Clipboard API with a textarea fallback.
 * @returns {Promise<boolean>} - true if successful
 */
export async function copyToClipboard(text) {
  if (!isBrowser) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Legacy fallback
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read text from the clipboard.
 * @returns {Promise<string>}
 */
export async function readFromClipboard() {
  if (!isBrowser || !navigator.clipboard?.readText) return "";
  try { return await navigator.clipboard.readText(); }
  catch { return ""; }
}

// ─────────────────────────────────────────────
// Viewport / element detection
// ─────────────────────────────────────────────

/**
 * Check if an element is fully within the viewport.
 */
export function isInViewport(el) {
  if (!isBrowser || !el) return false;
  const { top, bottom, left, right } = el.getBoundingClientRect();
  return (
    top    >= 0 &&
    left   >= 0 &&
    bottom <= window.innerHeight &&
    right  <= window.innerWidth
  );
}

/**
 * Check if an element is partially within the viewport.
 */
export function isPartiallyInViewport(el) {
  if (!isBrowser || !el) return false;
  const { top, bottom, left, right } = el.getBoundingClientRect();
  return (
    bottom > 0 &&
    top    < window.innerHeight &&
    right  > 0 &&
    left   < window.innerWidth
  );
}

/**
 * Get the distance an element is from the center of the viewport.
 * Useful for parallax calculations.
 */
export function getDistanceFromCenter(el) {
  if (!isBrowser || !el) return 0;
  const { top, height } = el.getBoundingClientRect();
  const elementCenter = top + height / 2;
  const viewportCenter = window.innerHeight / 2;
  return elementCenter - viewportCenter;
}

// ─────────────────────────────────────────────
// Focus management
// ─────────────────────────────────────────────

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  "details > summary",
].join(", ");

/**
 * Get all focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest("[disabled]") && !el.closest("[aria-hidden='true']")
  );
}

/**
 * Trap keyboard focus within a container (for modals / drawers).
 * Returns a cleanup function — call it when the trap should be removed.
 *
 * @param {HTMLElement} container
 * @returns {() => void} cleanup
 */
export function trapFocus(container) {
  const handler = (e) => {
    if (e.key !== "Tab") return;
    const focusable = getFocusableElements(container);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

/**
 * Focus the first focusable element inside a container.
 */
export function focusFirst(container) {
  const first = getFocusableElements(container)[0];
  first?.focus();
}

// ─────────────────────────────────────────────
// CSS / Styles
// ─────────────────────────────────────────────

/**
 * Set CSS custom properties on an element (or :root by default).
 * @param {Record<string, string>} vars - e.g. { "--color-brand": "#3b82f6" }
 * @param {HTMLElement} [el]
 */
export function setCSSVars(vars, el = document.documentElement) {
  if (!isBrowser) return;
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

/**
 * Get a CSS custom property value from an element.
 */
export function getCSSVar(name, el = document.documentElement) {
  if (!isBrowser) return "";
  return getComputedStyle(el).getPropertyValue(name).trim();
}

// ─────────────────────────────────────────────
// Miscellaneous DOM
// ─────────────────────────────────────────────

/**
 * Create and inject a <style> tag into <head>.
 * Returns the element so you can remove it later.
 */
export function injectStyle(css) {
  if (!isBrowser) return null;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
  return el;
}

/**
 * Check if an element has a scrollbar (vertical).
 */
export function hasScrollbar(el = document.documentElement) {
  if (!isBrowser) return false;
  return el.scrollHeight > el.clientHeight;
}

/**
 * Get the scrollbar width in pixels.
 * Useful for preventing layout shift when locking scroll.
 */
export function getScrollbarWidth() {
  if (!isBrowser) return 0;
  const outer = document.createElement("div");
  outer.style.cssText = "visibility:hidden;overflow:scroll;position:absolute;";
  document.body.appendChild(outer);
  const width = outer.offsetWidth - outer.clientWidth;
  document.body.removeChild(outer);
  return width;
}

/**
 * Dispatch a custom event on an element.
 */
export function dispatchEvent(el, name, detail = {}) {
  el?.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}

/**
 * Wait for the next animation frame — useful for DOM-ready operations.
 */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Wait for n milliseconds.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download a string as a file.
 * @param {string} content  - File content
 * @param {string} filename - e.g. "export.csv"
 * @param {string} type     - MIME type e.g. "text/csv"
 */
export function downloadFile(content, filename, type = "text/plain") {
  if (!isBrowser) return;
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}