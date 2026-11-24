// app/components/game/ArenaBackdrop.tsx
// Decorative scenery behind one arena: sky, a far skyline / server hall / factory silhouette,
// support pillars, cables with blinking lights and a vignette. Purely visual: nothing here
// takes part in physics, and it is drawn once per map (no per-frame work).
import { memo, useMemo } from "react";
import type { MapDef } from "~/game/maps";

type Tone = "neon" | "pink";

const ACCENT: Record<Tone, string> = { neon: "#01E4FF", pink: "#FE2C96" };

// One mood per map, picked by map id. Colours stay dark so the level in front reads clearly.
const MOODS = [
  { top: "#0d1b3d", bottom: "#04070f", haze: "#1d4ed8", kind: "city" },
  { top: "#1c1426", bottom: "#07040b", haze: "#f59e0b", kind: "factory" },
  { top: "#0a1f2b", bottom: "#030a0e", haze: "#06b6d4", kind: "servers" },
  { top: "#1a0f2e", bottom: "#05030c", haze: "#a855f7", kind: "city" },
  { top: "#0b1d2e", bottom: "#030810", haze: "#38bdf8", kind: "servers" },
  { top: "#21101c", bottom: "#080308", haze: "#f43f5e", kind: "factory" },
] as const;

/** Small deterministic PRNG so every player sees the same scenery for a map. */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

type Rect = { x: number; y: number; w: number; h: number; o?: number };

function silhouette(kind: string, seed: number) {
  const r = rng(seed + 7);
  const shapes: Rect[] = [];
  const lights: Rect[] = [];
  if (kind === "city") {
    for (let x = -2; x < 100; ) {
      const w = 5 + r() * 9;
      const h = 22 + r() * 48;
      shapes.push({ x, y: 100 - h, w: w - 0.6, h });
      for (let wy = 100 - h + 3; wy < 97; wy += 4)
        for (let wx = x + 1.2; wx < x + w - 2; wx += 2.6) if (r() < 0.28) lights.push({ x: wx, y: wy, w: 1, h: 1.4, o: 0.35 + r() * 0.5 });
      if (r() < 0.35) shapes.push({ x: x + w / 2 - 0.3, y: 100 - h - 6, w: 0.6, h: 6 }); // antenna
      x += w;
    }
  } else if (kind === "servers") {
    for (let x = 1; x < 100; x += 11) {
      const h = 55 + r() * 30;
      shapes.push({ x, y: 100 - h, w: 8.5, h });
      for (let wy = 100 - h + 2; wy < 98; wy += 2.4) {
        shapes.push({ x: x + 0.6, y: wy, w: 7.3, h: 0.25, o: 0.5 });
        if (r() < 0.5) lights.push({ x: x + 1 + r() * 6, y: wy + 0.6, w: 0.6, h: 0.9, o: 0.4 + r() * 0.6 });
      }
    }
  } else {
    for (let x = -3; x < 100; ) {
      const w = 8 + r() * 14;
      const h = 18 + r() * 30;
      shapes.push({ x, y: 100 - h, w, h });
      if (r() < 0.6) {
        const cw = 2 + r() * 2;
        const ch = 15 + r() * 30;
        shapes.push({ x: x + r() * (w - cw), y: 100 - h - ch, w: cw, h: ch }); // chimney
      }
      if (r() < 0.5) lights.push({ x: x + 2, y: 100 - h + 4, w: w - 4, h: 1.2, o: 0.35 });
      x += w + 1;
    }
  }
  return { shapes, lights };
}

function ArenaBackdropImpl({ map, tone }: { map: MapDef; tone: Tone }) {
  const mood = MOODS[map.id % MOODS.length];
  const accent = ACCENT[tone];
  const { shapes, lights } = useMemo(() => silhouette(mood.kind, map.id), [mood.kind, map.id]);
  const far = useMemo(() => silhouette(mood.kind === "servers" ? "city" : mood.kind, map.id + 50).shapes, [mood.kind, map.id]);
  const leds = useMemo(() => {
    const r = rng(map.id + 101);
    return [...Array(14)].map(() => ({ x: 4 + r() * 92, y: 10 + r() * 85, d: 1 + r() * 3, delay: r() * 3 }));
  }, [map.id]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* sky + coloured haze */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 55% at 50% 100%, ${mood.haze}55, transparent 72%),
                       radial-gradient(ellipse 40% 30% at 20% 20%, ${accent}14, transparent 70%),
                       linear-gradient(to bottom, ${mood.top}, ${mood.bottom})`,
        }}
      />

      {/* far silhouette (lit by the haze) and the nearer dark one */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" shapeRendering="crispEdges">
        <g fill={mood.haze} opacity={0.13} transform="translate(0 -12) scale(1 1.12)">
          {far.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} />
          ))}
        </g>
        <g fill="#02030a" opacity={0.8}>
          {shapes.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} opacity={s.o ?? 1} />
          ))}
        </g>
        <g fill={mood.haze}>
          {lights.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} opacity={(s.o ?? 0.5) * 0.55} />
          ))}
        </g>
      </svg>

      {/* support pillars of the building we are inside */}
      {[12, 50, 88].map((x) => (
        <div
          key={x}
          className="absolute top-0 bottom-0"
          style={{
            left: `${x - 1.5}%`,
            width: "3%",
            background: `linear-gradient(90deg, #0000 0, #0b1224 15%, #141d36 50%, #0b1224 85%, #0000 100%)`,
            opacity: 0.7,
          }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #ffffff22 0 1.5px, transparent 2px)", backgroundSize: "100% 22px" }}
          />
        </div>
      ))}

      {/* hanging cables */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[8, 27, 46, 66].map((y, i) => (
          <path
            key={y}
            d={`M0 ${y} Q ${25 + i * 8} ${y + 6} 50 ${y + 1} T 100 ${y + 2}`}
            stroke="#000"
            strokeOpacity={0.6}
            strokeWidth={0.35}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* blinking status lights */}
      {leds.map((l, i) => (
        <span
          key={i}
          className="absolute rounded-[1px] animate-pulse"
          style={{
            left: `${l.x}%`,
            top: `${l.y}%`,
            width: 3,
            height: 3,
            background: i % 3 === 0 ? "#facc15" : accent,
            boxShadow: `0 0 6px ${i % 3 === 0 ? "#facc15" : accent}`,
            opacity: 0.55,
            animationDuration: `${l.d}s`,
            animationDelay: `${l.delay}s`,
          }}
        />
      ))}

      {/* sector name painted on the back wall */}
      <div
        className="absolute left-0 right-0 text-center font-pixel tracking-[0.3em] select-none"
        style={{ top: "34%", fontSize: "clamp(14px, 3vw, 40px)", color: "#ffffff", opacity: 0.035 }}
      >
        {map.sector}
      </div>

      {/* vignette + faint scanlines */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.65) 100%), repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)",
        }}
      />
    </div>
  );
}

export const ArenaBackdrop = memo(ArenaBackdropImpl);
