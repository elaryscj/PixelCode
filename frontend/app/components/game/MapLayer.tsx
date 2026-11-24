// app/components/game/MapLayer.tsx
// Draws one arena (platforms, doors, hazards, finish). Static parts are React; moving parts are
// repositioned every frame by `animateMap` straight on the DOM, so the 60 FPS loop never re-renders React.
import { ArenaBackdrop } from "~/components/game/ArenaBackdrop";
import {
  DEFAULT_HAZARD_H,
  GROUND_Y,
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

/** Extra visual thickness under a platform's walkable top (purely cosmetic, % of arena height). */
export const PLATFORM_DEPTH = 1.8;

/**
 * Bottom (in %) of a platform's drawn block whose walkable top is `y`. Ground blocks and low
 * fixed pillars (e.g. over acid) reach down to the floor; everything else is a floating slab.
 */
const blockBottom = (y: number, fixed = false) =>
  y <= GROUND_Y + 0.5 || (fixed && y <= 10.5) ? 0 : y - PLATFORM_H - PLATFORM_DEPTH;

// Steel tile: seams every 18px, rivets, light lip under the edge, darker underside.
const STEEL =
  "linear-gradient(to bottom, rgba(255,255,255,0.22) 0 2px, rgba(255,255,255,0.07) 2px 45%, rgba(0,0,0,0.35) 45% calc(45% + 2px), transparent calc(45% + 2px) 60%, rgba(0,0,0,0.55) 100%)," +
  "radial-gradient(circle at 9px 7px, rgba(255,255,255,0.35) 0 1px, transparent 1.6px)," +
  "repeating-linear-gradient(90deg, rgba(0,0,0,0.55) 0 2px, transparent 2px 18px)";

interface BlockLook {
  lip: string; // top edge colour (also the glow)
  body: string; // base colour of the block
  pattern?: string; // overrides the steel pattern
  size?: string;
  dashed?: boolean;
}

function blockLook(p: PlatformDef, tone: Tone): BlockLook {
  switch (p.kind) {
    case "conveyor":
      return {
        lip: "#facc15",
        body: "#1d1a0a",
        pattern:
          "linear-gradient(to bottom, transparent 70%, rgba(0,0,0,0.6) 100%), repeating-linear-gradient(90deg, rgba(250,204,21,0.75) 0 7px, #111 7px 14px, transparent 14px 20px)",
        size: "auto, 20px 100%",
      };
    case "ice":
      return {
        lip: "#f0f9ff",
        body: "#3b6f8f",
        pattern:
          "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 38%, transparent 46%), linear-gradient(to bottom, rgba(255,255,255,0.4) 0 2px, transparent 2px 60%, rgba(0,20,40,0.5) 100%)",
      };
    case "bounce":
      return {
        lip: "#bef264",
        body: "#2f4a12",
        pattern:
          "linear-gradient(to bottom, rgba(255,255,255,0.25) 0 2px, transparent 2px 60%, rgba(0,0,0,0.5) 100%), repeating-linear-gradient(90deg, rgba(190,242,100,0.35) 0 3px, transparent 3px 9px)",
      };
    case "crumble":
      return {
        lip: "#d97706",
        body: "#3b2410",
        pattern:
          "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.6) 100%), repeating-linear-gradient(60deg, transparent 0 9px, rgba(0,0,0,0.6) 9px 10px, transparent 10px 23px), repeating-linear-gradient(-50deg, transparent 0 13px, rgba(0,0,0,0.45) 13px 14px)",
        dashed: true,
      };
    case "blink":
      return {
        lip: "#e879f9",
        body: "rgba(168,85,247,0.28)",
        pattern: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.18) 0 1px, transparent 1px 3px)",
        dashed: true,
      };
    default:
      if (p.move) return { lip: "#facc15", body: "#2a2a35" };
      return tone === "neon" ? { lip: "#01E4FF", body: "#243a63" } : { lip: "#FE2C96", body: "#4a2150" };
  }
}

function PlatformView({ p, i, mirror, tone }: { p: PlatformDef; i: number; mirror: boolean; tone: Tone }) {
  const mx = (x: number, w = 0) => (mirror ? 100 - x - w : x);
  const dir = (p.push ?? 0) * (mirror ? -1 : 1);
  const look = blockLook(p, tone);
  const bottom = blockBottom(p.y, !p.move);
  return (
    <div
      data-plat={isDynamic(p) ? i : undefined}
      className="absolute flex items-start justify-center overflow-hidden pointer-events-none"
      style={{
        left: `${mx(p.x, p.w)}%`,
        bottom: `${bottom}%`,
        width: `${p.w}%`,
        height: `${p.y - bottom}%`,
        backgroundColor: look.body,
        backgroundImage: look.pattern ?? STEEL,
        backgroundSize: look.size,
        borderTop: `3px ${look.dashed ? "dashed" : "solid"} ${look.lip}`,
        boxShadow: `0 -2px 10px -2px ${look.lip}aa, 0 8px 12px -4px rgba(0,0,0,0.75), inset 0 -2px 0 rgba(0,0,0,0.5)`,
        ...(p.kind === "conveyor"
          ? { animation: `pc-belt-${dir < 0 ? "left" : "right"} ${0.08 / Math.abs(p.push || 0.1)}s linear infinite` }
          : {}),
        ...(p.move && !p.kind
          ? { borderLeft: "3px solid #facc15", borderRight: "3px solid #facc15" }
          : {}),
      }}
    >
      {p.kind === "bounce" && <span className="text-[8px] leading-none text-lime-200 mt-px">▲ ▲ ▲</span>}
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
  // steel spikes on a base plate, lit from the left, with a red danger glow
  return (
    <div
      data-haz={dyn}
      className="absolute flex items-end justify-between pointer-events-none"
      style={{ ...base, filter: "drop-shadow(0 0 4px rgba(254,44,150,0.75))" }}
    >
      {[...Array(Math.max(1, Math.floor(h.w / 2.2)))].map((_, j) => (
        <div
          key={j}
          className="h-full flex-1"
          style={{
            clipPath: "polygon(50% 0%, 4% 100%, 96% 100%)",
            background: "linear-gradient(90deg, #ffe4f1 0 48%, #b3125f 52% 100%)",
          }}
        ></div>
      ))}
      <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-[#5b0a30] border-t border-pink/70" />
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
      <ArenaBackdrop map={map} tone={tone} />

      {/* side walls: riveted steel */}
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          className="absolute top-0 bottom-0 w-[1.6%] pointer-events-none"
          style={{
            [side]: 0,
            backgroundColor: "#161f36",
            backgroundImage:
              "radial-gradient(circle at 50% 8px, rgba(255,255,255,0.3) 0 1px, transparent 1.6px), repeating-linear-gradient(to bottom, rgba(0,0,0,0.5) 0 2px, transparent 2px 26px)",
            backgroundSize: "100% 26px, auto",
            boxShadow: `inset ${side === "left" ? "-2px" : "2px"} 0 0 rgba(255,255,255,0.08), 0 0 12px rgba(0,0,0,0.8)`,
          }}
        />
      ))}

      {map.platforms.map((p, i) => (
        <Track key={`t${map.id}-${i}`} p={p} mirror={mirror} />
      ))}
      {map.platforms.map((p, i) => (
        <PlatformView key={`${map.id}-${i}`} p={p} i={i} mirror={mirror} tone={tone} />
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
            {/* number plate above the door */}
            <span
              className={`absolute text-[8px] leading-none px-1 py-px border bg-black/70 ${
                isUnlocked ? "text-emerald-300 border-emerald-400/60" : isActive ? "text-yellow border-yellow/70" : "text-white/70 border-white/25"
              }`}
              style={{ left: `${mx(cp.x + DOOR_W / 2)}%`, transform: "translateX(-50%)", bottom: `${cp.y + DOOR_H + 0.8}%` }}
            >
              {cp.num}
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
        <HazardView key={`${map.id}-${i}`} h={h} i={i} mirror={mirror} />
      ))}

      {/* FINISH */}
      <div
        className="absolute flex flex-col items-center justify-end pointer-events-none"
        style={{ left: `${mx(ex.x, ex.w)}%`, bottom: `${ex.y}%`, width: `${ex.w}%`, height: `${ex.h}%` }}
      >
        {/* beam of light over the exit once every door is open */}
        <div
          className={`absolute left-[10%] right-[10%] bottom-4 h-[160%] transition-opacity duration-700 ${allOpen ? "opacity-100 animate-pulse" : "opacity-0"}`}
          style={{ background: "linear-gradient(to top, rgba(250,204,21,0.45), rgba(250,204,21,0.08) 60%, transparent)" }}
        />
        <span className={`relative text-[10px] mb-1 ${allOpen ? "text-yellow text-glow-sm animate-pulse" : "text-gray-500"}`}>
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
      const b = blockBottom(pos.y);
      el.style.bottom = `${b}%`;
      el.style.height = `${pos.y - b}%`;
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
