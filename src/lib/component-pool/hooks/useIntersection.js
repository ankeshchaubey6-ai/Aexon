import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Observe when an element enters/leaves the viewport using IntersectionObserver.
 * Powers every scroll-triggered animation in the component pool.
 *
 * @param {object} [options]
 * @param {number|number[]} [options.threshold=0.1]   - Visibility % to trigger (0–1 or array)
 * @param {string}          [options.rootMargin="0px"]- Margin around root
 * @param {Element|null}    [options.root=null]        - Scroll container (null = viewport)
 * @param {boolean}         [options.once=true]        - Stop observing after first intersection
 * @param {boolean}         [options.triggerOnce]      - Alias for `once`
 *
 * @returns {{
 *   ref:       React.RefObject,
 *   entry:     IntersectionObserverEntry | null,
 *   isVisible: boolean,
 * }}
 *
 * @example
 * // Animate a section when it enters the viewport
 * function AnimatedSection({ children }) {
 *   const { ref, isVisible } = useIntersection({ threshold: 0.15, once: true });
 *   return (
 *     <div ref={ref} style={{ opacity: isVisible ? 1 : 0, transition: "opacity 600ms" }}>
 *       {children}
 *     </div>
 *   );
 * }
 */
export function useIntersection(options = {}) {
  const {
    threshold  = 0.1,
    rootMargin = "0px",
    root       = null,
    once       = true,
    triggerOnce,
  } = options;

  const shouldFireOnce = once || triggerOnce;
  const ref     = useRef(null);
  const [entry, setEntry] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    // If "once" and already fired, skip re-observing
    if (shouldFireOnce && firedRef.current) return;

    const observer = new IntersectionObserver(
      ([ent]) => {
        setEntry(ent);
        if (ent.isIntersecting && shouldFireOnce) {
          firedRef.current = true;
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin, root }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, root, shouldFireOnce]);

  return {
    ref,
    entry,
    isVisible: entry?.isIntersecting ?? false,
  };
}

/**
 * Observe multiple elements at once.
 * Returns a stable `observe(el)` callback — attach it as a callback ref.
 *
 * @param {(entry: IntersectionObserverEntry) => void} onIntersect
 * @param {object} [options] - Same options as useIntersection
 * @returns {(el: Element | null) => void} callback ref
 *
 * @example
 * const observe = useIntersectionCallback((entry) => {
 *   entry.target.classList.add("visible");
 * }, { threshold: 0.1, once: true });
 *
 * // Use as callback ref on any number of elements:
 * items.map(item => <div key={item.id} ref={observe}>{item.title}</div>)
 */
export function useIntersectionCallback(onIntersect, options = {}) {
  const {
    threshold  = 0.1,
    rootMargin = "0px",
    root       = null,
    once       = true,
  } = options;

  const observerRef = useRef(null);
  const onIntersectRef = useRef(onIntersect);
  onIntersectRef.current = onIntersect;

  const observe = useCallback((el) => {
    if (!el) return;

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            onIntersectRef.current(entry);
            if (entry.isIntersecting && once) {
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        { threshold, rootMargin, root }
      );
    }

    observerRef.current.observe(el);
  }, [threshold, rootMargin, root, once]);

  // Disconnect on unmount
  useEffect(() => () => observerRef.current?.disconnect(), []);

  return observe;
}