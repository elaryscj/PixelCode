// app/components/game/FitBox.tsx
// Fills the space its parent gives it (flex-1) and places one child of a fixed aspect ratio in the middle,
// as large as fits. Arenas use it so the map has the same proportions on every screen: on a wide monitor
// or a phone turned sideways the spare room becomes background, the level is never stretched.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function FitBox({
  aspect,
  extraH = 0,
  className = "",
  children,
}: {
  /** width / height of the arena itself */
  aspect: number;
  /** fixed pixels added above / below the arena inside the child (e.g. a header strip) */
  extraH?: number;
  className?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const outer = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (W <= 0 || H <= 0) return;
      const arenaH = Math.max(80, Math.min(H - extraH, W / aspect));
      const next = { width: Math.floor(arenaH * aspect), height: Math.floor(arenaH + extraH) };
      setSize((s) => (s && s.width === next.width && s.height === next.height ? s : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, extraH]);

  return (
    <div ref={outer} className={`flex-1 min-h-0 w-full flex items-center justify-center ${className}`}>
      {/* always rendered (game loops hold refs into it); 0x0 only until the first measurement */}
      {children(size ?? { width: 0, height: 0 })}
    </div>
  );
}
