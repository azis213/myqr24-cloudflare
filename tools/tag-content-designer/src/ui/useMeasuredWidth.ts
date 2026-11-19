import { useEffect, useRef, useState } from "react";

/**
 * Misst die Breite eines Elements. In Umgebungen ohne `ResizeObserver`
 * (z. B. jsdom in Tests) bleibt der Fallback erhalten, damit die Vorschau
 * trotzdem eine sinnvolle Breite zeigt.
 */
export function useMeasuredWidth(fallback: number): {
  ref: React.RefObject<HTMLDivElement | null>;
  width: number;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.clientWidth);
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
