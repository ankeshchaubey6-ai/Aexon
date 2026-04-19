// ─────────────────────────────────────────────────────────────────────────────
// Hooks — barrel export
// Import from here: import { useFetch, useForm, useDarkMode } from "@/lib/component-pool/hooks"
// ─────────────────────────────────────────────────────────────────────────────

// Data fetching
export * from "./useFetch.js";

// Performance
export * from "./useDebounce.js";
export * from "./useThrottle.js";

// Persistence
export * from "./useLocalStorage.js";
export * from "./useSessionStorage.js";

// Responsive / environment
export * from "./useMediaQuery.js";
export * from "./useDarkMode.js";

// Scroll
export * from "./useScroll.js";
export * from "./useScrollLock.js";

// DOM observation
export * from "./useIntersection.js";
export * from "./useClickOutside.js";

// Keyboard
export * from "./useKeyboard.js";

// Clipboard
export * from "./useClipboard.js";

// Data / UI logic
export * from "./usePagination.js";
export * from "./useForm.js";
export * from "./useToggle.js";