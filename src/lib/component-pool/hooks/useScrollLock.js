import { useEffect, useRef } from "react";

/**
 * Lock/unlock body scroll — used by Modal, Drawer, CommandPalette.
 *
 * Technique: position:fixed preserves the scrollbar gutter and prevents
 * layout shift. Restores the exact scroll position on unlock.
 *
 * Multiple components can safely call this simultaneously —
 * it uses a ref-count so the lock is only released when every caller unlocks.
 *
 * @param {boolean} locked - When true, body scroll is disabled.
 *
 * @example
 * // Inside Modal:
 * useScrollLock(isOpen);
 *
 * // Conditional:
 * const { lock, unlock } = useScrollLockControls();
 */

// Global lock count — shared across all hook instances on the page
let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  savedScrollY = window.scrollY;
  document.body.style.cssText = `
    position: fixed;
    top: -${savedScrollY}px;
    left: 0;
    right: 0;
    overflow-y: scroll;
    overscroll-behavior: none;
  `.replace(/\n\s+/g, " ").trim();
}

function applyUnlock() {
  document.body.style.cssText = "";
  window.scrollTo({ top: savedScrollY, behavior: "instant" });
}

export function useScrollLock(locked) {
  const wasLocked = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (locked && !wasLocked.current) {
      lockCount++;
      wasLocked.current = true;
      if (lockCount === 1) applyLock();
    } else if (!locked && wasLocked.current) {
      lockCount = Math.max(0, lockCount - 1);
      wasLocked.current = false;
      if (lockCount === 0) applyUnlock();
    }

    return () => {
      if (wasLocked.current) {
        lockCount = Math.max(0, lockCount - 1);
        wasLocked.current = false;
        if (lockCount === 0) applyUnlock();
      }
    };
  }, [locked]);
}

/**
 * Imperative scroll lock controls — for components that lock/unlock
 * programmatically (e.g. based on animation state, not just a boolean prop).
 *
 * @returns {{ lock: () => void, unlock: () => void, isLocked: boolean }}
 */
export function useScrollLockControls() {
  const isLockedRef = useRef(false);

  const lock = () => {
    if (isLockedRef.current || typeof window === "undefined") return;
    isLockedRef.current = true;
    lockCount++;
    if (lockCount === 1) applyLock();
  };

  const unlock = () => {
    if (!isLockedRef.current || typeof window === "undefined") return;
    isLockedRef.current = false;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) applyUnlock();
  };

  // Always unlock on unmount
  useEffect(() => () => unlock(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { lock, unlock, get isLocked() { return isLockedRef.current; } };
}