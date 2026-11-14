// app/components/game/MapLayer.tsx
// Draws one arena (platforms, doors, hazards, finish). Static parts are React; moving parts are
// repositioned every frame by `animateMap` straight on the DOM, so the 60 FPS loop never re-renders React.
import {
  DEFAULT_HAZARD_H,
  blinkPhase,
  hazardPos,
  platPos,
  type HazardDef,
  type MapDef,
  type PlatformDef,
} from "~/game/maps";
import { BARRIER_H, DOOR_H, DOOR_W, DOORS, PLATFORM_H, type CrumbleState } from "~/game/physics";

type Tone = "neon" | "pink";

const isDynamic = (p: PlatformDef) => !!p.move || p.kind === "blink" || p.kind === "crumble";

function platformClass(p: PlatformDef, tone: Tone): string {
  switch (p.kind) {
    case "conveyor":
      return "border-yellow/80 bg-yellow/10";
    case "ice":
      return "border-white/80 bg-sky-200/25 shadow-[0_0_6px_rgba(186,230,253,0.5)]";
    case "bounce":
      return "border-lime-300 bg-lime-300/30 shadow-[0_0_10px_rgba(190,242,100,0.7)]";
    case "crumble":
      return "border-amber-600 bg-amber-900/40 border-dashed";
    case "blink":
      return "border-fuchsia-400 bg-fuchsia-500/25 border-dashed shadow-[0_0_8px_rgba(217,70,239,0.6)]";
    default:
      if (p.move) return "border-yellow bg-yellow/20 shadow-[0_0_8px_rgba(253,224,71,0.45)]";
      return tone === "neon" ? "border-neon bg-neon/15" : "border-pink bg-pink/15";
  }
}

function PlatformView({ p, i, mirror, tone }: { p: PlatformDef; i: number; mirror: boolean; tone: Tone }) {
  const mx = (x: number, w = 0) => (mirror ? 100 - x - w : x);
  const tick = tone === "neon" ? "bg-neon/40" : "bg-pink/40";
  const dir = (p.push ?? 0) * (mirror ? -1 : 1);
  return (
    <div
      data-plat={isDynamic(p) ? i : undefined}
      className={`absolute border-t-2 ${platformClass(p, tone)} flex items-center justify-around overflow-hidden pointer-events-none`}
      style={{
        left: `${mx(p.x, p.w)}%`,
        bottom: `${p.y - PLATFORM_H}%`,
        width: `${p.w}%`,
        height: `${PLATFORM_H}%`,
        ...(p.kind === "conveyor"
          ? {
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(253,224,71,0.55) 0 6px, transparent 6px 20px)",
              animation: `pc-belt-${dir < 0 ? "left" : "right"} ${0.08 / Math.abs(p.push || 0.1)}s linear infinite`,
            }
          : {}),
      }}
    >
      {p.kind === "bounce" ? (
        <span className="text-[8px] leading-none text-lime-200">▲▲</span>
      ) : p.kind === "conveyor" ? null : (
        [...Array(Math.floor(p.w / 5))].map((_, j) => (
          <div key={j} className={`h-full w-1 ${p.kind === "crumble" ? "bg-amber-500/40" : tick}`}></div>
        ))
      )}
    </div>
  );
}

/** Faint rail showing where a moving block travels. */
function Track({ p, mirror }: { p: PlatformDef; mirror: boolean }) {
  if (!p.move) return null;
  const mx = (x: number, w = 0) => (mirror ? 100 - x - w : x);
  const horizontal = p.move.axis === "x";
  const w = horizontal ? p.w + p.move.range : 0.4;
  const x = horizontal ? p.x : p.x + p.w / 2 - 0.2;
  return (
    <div
      className="absolute pointer-events-none border-yellow/25"
      style={{
        left: `${mx(x, w)}%`,
        bottom: `${horizontal ? p.y - PLATFORM_H / 2 : p.y}%`,
        width: `${w}%`,
        height: horizontal ? "0px" : `${p.move.range}%`,
        borderTopWidth: horizontal ? 1 : 0,
        borderLeftWidth: horizontal ? 0 : 1,
        borderStyle: "dashed",
      }}
    />
  );
}

function HazardView({ h, i, mirror }: { h: HazardDef; i: number; mirror: boolean }) {
  const mx = (x: number, w = 0) => (mirror ? 100 - x - w : x);
  const kind = h.kind ?? "spikes";
  const hh = h.h ?? DEFAULT_HAZARD_H[kind];
  const base = {
    left: `${mx(h.x, h.w)}%`,
    bottom: `${h.y}%`,
    width: `${h.w}%`,
    height: `${hh}%`,
  };
  const dyn = h.move ? i : undefined;

  if (kind === "acid") {
    return (
      <div
        data-haz={dyn}
        className="absolute pointer-events-none border-t-2 border-lime-300 bg-gradient-to-b from-lime-400/70 to-emerald-900/80 shadow-[0_0_14px_rgba(163,230,53,0.6)] animate-pulse"
        style={{ ...base, bottom: `${h.y - PLATFORM_H}%`, height: `${hh + PLATFORM_H - 0.5}%` }}
      />
    );
  }
  if (kind === "saw") {
    return (
      <div data-haz={dyn} className="absolute pointer-events-none flex items-center justify-center" style={base}>
        <div
          className="h-full aspect-square rounded-full border-[3px] border-dashed border-pink bg-pink/30 shadow-[0_0_10px_rgba(254,44,150,0.8)] animate-spin"
          style={{ animationDuration: "0.6s" }}
        />
      </div>
    );
  }
  if (kind === "icicle") {
    return (
      <div data-haz={dyn} className="absolute pointer-events-none flex items-start justify-center" style={base}>
        <div
          className="w-full h-full bg-gradient-to-b from-white to-sky-300 shadow-[0_0_8px_rgba(186,230,253,0.9)]"
          style={{ clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }}
        />
      </div>
    );
  }
  return (
    <div data-haz={dyn} className="absolute flex items-end justify-between pointer-events-none" style={base}>
      {[...Array(Math.max(1, Math.floor(h.w / 2.2)))].map((_, j) => (
        <div key={j} className="w-2 h-full bg-pink" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}></div>
      ))}
    </div>
  );
}

export function MapLayer({
  map,
  mirror,
  unlocked,
  doors,
  tone,
  nearCheckpoint = null,
}: {
  map: MapDef;
  mirror: boolean;
  unlocked: number[];
  doors: Record<number, number>;
  tone: Tone;
  nearCheckpoint?: number | null;
}) {
  const mx = (x: number, w = 0) => (mirror ? 100 - x - w : x);
  const allOpen = unlocked.length >= DOORS;
  const ex = map.exit;

  return (
    <>
      {/* side walls */}
      <div className="absolute top-0 bottom-0 left-0 w-[1.6%] bg-[#10213d] border-r border-neon/30 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-[1.6%] bg-[#10213d] border-l border-neon/30 pointer-events-none" />

      {map.floors.map((y, i) => (
        <span
          key={i}
          className="absolute text-[9px] text-white/25 pointer-events-none"
          style={{ [mirror ? "right" : "left"]: "3%", bottom: `${y + PLATFORM_H}%` }}
        >
          F{i + 1}
        </span>
      ))}

      {map.platforms.map((p, i) => (
        <Track key={`t${i}`} p={p} mirror={mirror} />
      ))}
      {map.platforms.map((p, i) => (
        <PlatformView key={i} p={p} i={i} mirror={mirror} tone={tone} />
      ))}

      {/* Security doors: sealed -> timer running -> open. A locked door is a wall; it opens only with E next to it. */}
      {map.doors.map((cp) => {
        const isUnlocked = unlocked.includes(cp.num);
        const isActive = !isUnlocked && cp.num in doors;
        const near = !mirror && nearCheckpoint === cp.num;
        const src = isUnlocked ? "/doors/door-open.png" : isActive ? "/doors/door-active.png" : "/doors/door-locked.png";
        return (
          <div key={cp.num} className="pointer-events-none">
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute"
              style={{
                left: `${mx(cp.x, DOOR_W)}%`,
                bottom: `${cp.y}%`,
                width: `${DOOR_W}%`,
                height: `${DOOR_H}%`,
                objectFit: "fill",
                imageRendering: "pixelated",
                filter: isActive
                  ? "drop-shadow(0 0 6px #facc15)"
                  : near
                    ? "drop-shadow(0 0 8px #01E4FF)"
                    : isUnlocked
                      ? "none"
                      : "drop-shadow(0 0 3px rgba(255,42,133,0.7))",
              }}
            />
            <span
              className={`absolute text-[8px] leading-none ${isUnlocked ? "text-emerald-300" : "text-white/60"}`}
              style={{ left: `${mx(cp.x, DOOR_W)}%`, width: `${DOOR_W}%`, textAlign: "center", bottom: `${cp.y + DOOR_H + 0.6}%` }}
            >
              CP{cp.num}
            </span>

            {near && !isUnlocked && (
              <span
                className="absolute z-30 flex items-center justify-center w-6 h-6 bg-yellow text-black text-xs font-bold border-2 border-black animate-bounce"
                style={{ left: `${mx(cp.x + DOOR_W / 2)}%`, transform: "translateX(-50%)", bottom: `${cp.y + DOOR_H + 4}%` }}
              >
                E
              </span>
            )}

            {/* laser wall: this is what actually blocks movement */}
            {!isUnlocked && (
              <div
                className="absolute bg-gradient-to-t from-pink via-red-500 to-pink opacity-60 animate-pulse"
                style={{
                  left: `${mx(cp.x + DOOR_W / 2 - 0.4, 0.8)}%`,
                  bottom: `${cp.y + DOOR_H}%`,
                  width: "0.8%",
                  height: `${BARRIER_H - DOOR_H}%`,
                }}
              />
            )}
          </div>
        );
      })}

      {map.hazards.map((h, i) => (
        <HazardView key={i} h={h} i={i} mirror={mirror} />
      ))}

      {/* FINISH */}
      <div
        className="absolute flex flex-col items-center justify-end pointer-events-none"
        style={{ left: `${mx(ex.x, ex.w)}%`, bottom: `${ex.y}%`, width: `${ex.w}%`, height: `${ex.h}%` }}
      >
        <span className={`text-[10px] mb-1 ${allOpen ? "text-yellow text-glow-sm animate-pulse" : "text-gray-500"}`}>
          {allOpen ? "FINISH" : `FINISH ${unlocked.length}/${DOORS}`}
        </span>
        <div
          className={`w-full h-4 border ${allOpen ? "border-yellow shadow-[0_0_14px_rgba(255,215,0,0.8)]" : "border-gray-600 opacity-50"}`}
          style={{ background: "repeating-conic-gradient(#facc15 0% 25%, #111827 0% 50%) 0 0 / 16px 16px" }}
        />
      </div>
    </>
  );
}

/**
 * Moves the dynamic parts of one rendered arena to time `t`. `crumble` is the local player's
 * crumbling state (null for the opponent panel, whose cracks we don't know).
 */
export function animateMap(root: HTMLElement | null, map: MapDef, t: number, mirror: boolean, crumble: CrumbleState | null) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-plat]").forEach((el) => {
    const i = Number(el.dataset.plat);
    const p = map.platforms[i];
    if (!p) return;
    if (p.move) {
      const pos = platPos(p, t);
      el.style.left = `${mirror ? 100 - pos.x - p.w : pos.x}%`;
      el.style.bottom = `${pos.y - PLATFORM_H}%`;
    }
    if (p.kind === "blink") {
      const f = blinkPhase(p, t);
      // solid for the first half; flickers just before it vanishes
      const warn = f > 0.38 && f < 0.5;
      el.style.opacity = f < 0.5 ? (warn && Math.floor(t * 12) % 2 === 0 ? "0.35" : "1") : "0.12";
    }
    if (p.kind === "crumble" && crumble) {
      const st = crumble.get(i);
      const broken = st && st.brokenUntil > t;
      el.style.opacity = broken ? "0.1" : "1";
      el.style.transform = !broken && st && st.stood > 0.05 ? `translateX(${Math.sin(t * 60) * 1.5}px)` : "";
    }
  });
  root.querySelectorAll<HTMLElement>("[data-haz]").forEach((el) => {
    const h: HazardDef | undefined = map.hazards[Number(el.dataset.haz)];
    if (!h?.move) return;
    const pos = hazardPos(h, t);
    el.style.left = `${mirror ? 100 - pos.x - h.w : pos.x}%`;
    el.style.bottom = `${pos.y}%`;
  });
}
