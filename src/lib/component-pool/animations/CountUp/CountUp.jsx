import { useEffect, useRef, useState } from "react";
import { useIntersection } from "../../hooks/useIntersection.js";

/**
 * Animates a number counting up from 0 to `end`.
 */
export function CountUp({ end, duration = 2000, prefix = "", suffix = "", decimals = 0, className }) {
  const { ref, isVisible } = useIntersection({ threshold: 0.5 });
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!isVisible || started.current) return;
    started.current = true;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isVisible, end, duration, decimals]);

  return <span ref={ref} className={className}>{prefix}{count.toLocaleString()}{suffix}</span>;
}
