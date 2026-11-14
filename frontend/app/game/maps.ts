// app/game/maps.ts
// Arena maps. Units are % of one arena panel; `y` is the TOP of a platform (bottom = 0).
// Both players always get the same map (US-12); the server picks it per match (`mapId`).
//
// Reach of a normal jump (see physics.ts): ~14.8 up, ~11 up comfortably, ~20 sideways on the same level.

export const GROUND_Y = 3;

/** Smooth back-and-forth motion: offset goes 0 -> range -> 0 every `period` seconds. */
export interface Motion {
  axis: "x" | "y";
  range: number;
  period: number;
  phase?: number; // 0..1, fraction of a period
}

export type PlatformKind =
  | "solid"
  | "conveyor" // pushes whoever stands on it by `push` units / frame
  | "ice" // low friction, hard to stop
  | "bounce" // launches the player up with `power`
  | "crumble" // breaks shortly after you stand on it, comes back later
  | "blink"; // phases in and out on a timer (`period`, `phase`)

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  kind?: PlatformKind;
  move?: Motion;
  push?: number; // conveyor
  power?: number; // bounce
  period?: number; // blink
  phase?: number; // blink, 0..1
}

export type HazardKind = "spikes" | "acid" | "saw" | "icicle";

export interface HazardDef {
  x: number;
  y: number; // bottom of the hazard
  w: number;
  h?: number;
  kind?: HazardKind;
  move?: Motion;
}

export interface DoorDef {
  num: number;
  x: number;
  y: number;
  /** which side of the door is "past" it: used for the respawn point after unlocking */
  exit?: "left" | "right";
}

export interface MapDef {
  id: number;
  name: string;
  sector: string;
  tagline: string;
  floors: number[]; // y of each floor, for the F1..Fn labels and the "FLOOR x / n" display
  start: { x: number; y: number };
  platforms: PlatformDef[];
  hazards: HazardDef[];
  doors: DoorDef[];
  exit: { x: number; y: number; w: number; h: number };
}

export const DEFAULT_HAZARD_H: Record<HazardKind, number> = { spikes: 4, acid: 3, saw: 6, icicle: 6 };

// ------------------------------------------------------------------ motion helpers

const TAU = Math.PI * 2;

export function motionOffset(m: Motion | undefined, t: number): number {
  if (!m) return 0;
  return (m.range * (1 - Math.cos(TAU * (t / m.period + (m.phase ?? 0))))) / 2;
}

/** Current top-left of a platform at time `t` (seconds). */
export function platPos(p: PlatformDef, t: number): { x: number; y: number } {
  const o = motionOffset(p.move, t);
  return { x: p.x + (p.move?.axis === "x" ? o : 0), y: p.y + (p.move?.axis === "y" ? o : 0) };
}

export function hazardPos(h: HazardDef, t: number): { x: number; y: number } {
  const o = motionOffset(h.move, t);
  return { x: h.x + (h.move?.axis === "x" ? o : 0), y: h.y + (h.move?.axis === "y" ? o : 0) };
}

/** Blink platforms are solid for the first half of their cycle. */
export function blinkPhase(p: PlatformDef, t: number): number {
  const period = p.period ?? 3;
  const f = (t / period + (p.phase ?? 0)) % 1;
  return f < 0 ? f + 1 : f;
}
export const blinkSolid = (p: PlatformDef, t: number) => blinkPhase(p, t) < 0.5;

/** Shared clock so both players see moving parts roughly in sync. */
export const worldTime = () => Date.now() / 1000;

// ------------------------------------------------------------------ maps

const MIRROR_CIRCUIT: MapDef = {
  id: 0,
  name: "MIRROR CIRCUIT",
  sector: "SECTOR 04",
  tagline: "THE CLASSIC: LEDGES, SPIKES AND FOUR GATES",
  floors: [GROUND_Y, 22, 41.5, 61, 80],
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 100 },
    { x: 84.5, y: 12.5, w: 15.5 },
    { x: 0, y: 22, w: 79 },
    { x: 0, y: 31.5, w: 17 },
    { x: 24, y: 41.5, w: 76 },
    { x: 46, y: 51, w: 17 },
    { x: 0, y: 61, w: 39 },
    { x: 54, y: 61, w: 46 },
    { x: 0, y: 70.5, w: 17 },
    { x: 20.5, y: 80, w: 79.5 },
  ],
  hazards: [
    { x: 61, y: 22, w: 9 },
    { x: 36, y: 80, w: 9 },
  ],
  doors: [
    { num: 1, x: 45, y: 22, exit: "left" },
    { num: 2, x: 32, y: 41.5, exit: "right" },
    { num: 3, x: 23, y: 61, exit: "left" },
    { num: 4, x: 60, y: 80, exit: "right" },
  ],
  exit: { x: 75, y: 80, w: 22, h: 12 },
};

// Lifts, a shuttle and conveyor belts that push you into spikes.
const PISTON_WORKS: MapDef = {
  id: 1,
  name: "PISTON WORKS",
  sector: "SECTOR 07",
  tagline: "RIDE THE LIFTS, FIGHT THE BELTS",
  floors: [GROUND_Y, 22, 41.5, 61, 80],
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 30 },
    { x: 30, y: GROUND_Y, w: 40, kind: "conveyor", push: -0.12 },
    { x: 70, y: GROUND_Y, w: 16 },
    { x: 87, y: GROUND_Y, w: 11, move: { axis: "y", range: 19, period: 5 } }, // lift F1 -> F2
    { x: 0, y: 22, w: 85 },
    { x: 3, y: 31.5, w: 12, move: { axis: "x", range: 10, period: 4 } }, // shuttle F2 -> F3
    { x: 24, y: 41.5, w: 22 },
    { x: 46, y: 41.5, w: 26, kind: "conveyor", push: 0.13 },
    { x: 72, y: 41.5, w: 15 },
    { x: 88, y: 41.5, w: 10, move: { axis: "y", range: 19.5, period: 5, phase: 0.5 } }, // lift F3 -> F4
    { x: 0, y: 61, w: 86 },
    { x: 2, y: 70.5, w: 14 },
    { x: 20, y: 80, w: 80 },
  ],
  hazards: [
    { x: 50, y: GROUND_Y, w: 6 },
    { x: 62, y: 22, w: 7 },
    { x: 76, y: 41.5, w: 5 },
    { x: 12, y: 61, w: 4, kind: "saw", move: { axis: "x", range: 30, period: 4 } },
    { x: 50, y: 80, w: 7 },
  ],
  doors: [
    { num: 1, x: 44, y: 22, exit: "left" },
    { num: 2, x: 34, y: 41.5, exit: "right" },
    { num: 3, x: 60, y: 61, exit: "left" },
    { num: 4, x: 30, y: 80, exit: "right" },
  ],
  exit: { x: 76, y: 80, w: 22, h: 12 },
};

// Parkour over an acid pit, crumbling stairs, bounce pads.
const ACID_GARDENS: MapDef = {
  id: 2,
  name: "ACID GARDENS",
  sector: "SECTOR 13",
  tagline: "PILLAR PARKOUR OVER ACID. DON'T LINGER ON CRACKED STONE",
  floors: [GROUND_Y, 30, 52, 66, 82],
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 14 },
    { x: 20, y: 8, w: 6 },
    { x: 31, y: 13, w: 6 },
    { x: 43, y: 9, w: 6 },
    { x: 55, y: 14, w: 6 },
    { x: 67, y: 10, w: 6 },
    { x: 80, y: GROUND_Y, w: 11 },
    { x: 91, y: GROUND_Y, w: 8, kind: "bounce", power: 1.55 }, // -> F2 (too high for a normal jump)
    { x: 30, y: 30, w: 70 },
    { x: 0, y: 30, w: 12 }, // safety net under the crumbling stairs
    { x: 20, y: 36, w: 8, kind: "crumble" }, // too low to reach F3 past the door
    { x: 6, y: 44, w: 8, kind: "crumble" },
    { x: 0, y: 52, w: 30 },
    { x: 36, y: 58, w: 6, move: { axis: "y", range: 5, period: 2.5 } },
    { x: 48, y: 61, w: 6 },
    { x: 60, y: 57, w: 6, move: { axis: "x", range: 9, period: 3 } },
    { x: 74, y: 66, w: 18 },
    { x: 92, y: 66, w: 7, kind: "bounce", power: 1.25 }, // -> F5
    { x: 14, y: 82, w: 86 },
  ],
  hazards: [
    { x: 14, y: GROUND_Y, w: 66, kind: "acid" },
    { x: 66, y: 30, w: 6 },
    { x: 38, y: 82, w: 4, kind: "saw", move: { axis: "x", range: 18, period: 3 } },
  ],
  doors: [
    { num: 1, x: 52, y: 30, exit: "left" },
    { num: 2, x: 18, y: 52, exit: "right" },
    { num: 3, x: 82, y: 66, exit: "right" },
    { num: 4, x: 64, y: 82, exit: "left" },
  ],
  exit: { x: 16, y: 82, w: 20, h: 10 },
};

// Ice floors you slide on, icicles that drop and rise again.
const FROST_LINE: MapDef = {
  id: 3,
  name: "FROST LINE",
  sector: "SECTOR 21",
  tagline: "EVERY FLOOR IS ICE. BRAKE EARLY, WATCH THE CEILING",
  floors: [GROUND_Y, 22, 41.5, 61, 80],
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 100, kind: "ice" },
    { x: 86, y: 12.5, w: 14 },
    { x: 2, y: 22, w: 9, kind: "bounce", power: 1.25 }, // -> F3
    { x: 11, y: 22, w: 69, kind: "ice" },
    { x: 0, y: 41.5, w: 76, kind: "ice" },
    { x: 82, y: 51, w: 12 },
    { x: 30, y: 61, w: 56, kind: "ice" },
    { x: 16, y: 70.5, w: 8, kind: "crumble" },
    { x: 0, y: 80, w: 100, kind: "ice" },
  ],
  hazards: [
    { x: 40, y: GROUND_Y, w: 6 },
    { x: 66, y: GROUND_Y, w: 6 },
    { x: 30, y: 24, w: 3, kind: "icicle", move: { axis: "y", range: 13, period: 2.2 } },
    { x: 42, y: 41.5, w: 8 },
    { x: 50, y: 63, w: 3, kind: "icicle", move: { axis: "y", range: 13, period: 2.4, phase: 0.3 } },
    { x: 52, y: 80, w: 7 },
  ],
  doors: [
    { num: 1, x: 58, y: 22, exit: "left" },
    { num: 2, x: 28, y: 41.5, exit: "right" },
    { num: 3, x: 70, y: 61, exit: "left" },
    { num: 4, x: 34, y: 80, exit: "right" },
  ],
  exit: { x: 74, y: 80, w: 24, h: 12 },
};

// Timing parkour on moving blocks; saws patrol the corridors.
const CLOCKWORK_SPIRE: MapDef = {
  id: 4,
  name: "CLOCKWORK SPIRE",
  sector: "SECTOR 33",
  tagline: "EVERYTHING MOVES. JUMP ON THE BEAT",
  floors: [GROUND_Y, 22, 41.5, 61, 80],
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 40 },
    { x: 42, y: 6, w: 10, move: { axis: "x", range: 32, period: 5 } }, // ferry over acid
    { x: 86, y: GROUND_Y, w: 14 },
    { x: 72, y: 12.5, w: 10 },
    { x: 12, y: 22, w: 58 },
    { x: 2, y: 22, w: 9, move: { axis: "y", range: 19.5, period: 4.5 } }, // lift F2 -> F3
    { x: 13, y: 41.5, w: 20 },
    { x: 38, y: 44, w: 9, move: { axis: "y", range: 8, period: 2.4 } },
    { x: 54, y: 46, w: 9, move: { axis: "x", range: 12, period: 3 } },
    { x: 80, y: 41.5, w: 20 },
    { x: 64, y: 51, w: 10 },
    { x: 8, y: 61, w: 60 },
    { x: 4, y: 70.5, w: 12, move: { axis: "y", range: 4, period: 2 } },
    { x: 18, y: 80, w: 82 },
  ],
  hazards: [
    { x: 40, y: GROUND_Y, w: 46, kind: "acid" },
    { x: 14, y: 22, w: 4, kind: "saw", move: { axis: "x", range: 26, period: 3 } },
    { x: 54, y: 61, w: 6 },
    { x: 44, y: 80, w: 4, kind: "saw", move: { axis: "x", range: 24, period: 2.6 } },
  ],
  doors: [
    { num: 1, x: 50, y: 22, exit: "left" },
    { num: 2, x: 22, y: 41.5, exit: "right" },
    { num: 3, x: 22, y: 61, exit: "left" },
    { num: 4, x: 30, y: 80, exit: "right" },
  ],
  exit: { x: 76, y: 80, w: 22, h: 12 },
};

// Phase blocks that blink in and out, belts and a bounce pad.
const DATA_STREAM: MapDef = {
  id: 5,
  name: "DATA STREAM",
  sector: "SECTOR 42",
  tagline: "PHASE BLOCKS BLINK. CROSS WHEN THEY'RE SOLID",
  floors: [GROUND_Y, 22, 41.5, 61, 80],
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 25 },
    { x: 25, y: GROUND_Y, w: 45, kind: "conveyor", push: 0.14 },
    { x: 70, y: GROUND_Y, w: 30 },
    { x: 80, y: 12.5, w: 10, kind: "blink", period: 3 },
    { x: 2, y: 22, w: 10, kind: "bounce", power: 1.25 }, // -> F3
    { x: 12, y: 22, w: 32, kind: "conveyor", push: -0.12 },
    { x: 44, y: 22, w: 32 },
    { x: 0, y: 41.5, w: 38 },
    { x: 43, y: 41.5, w: 10, kind: "blink", period: 2.4 },
    { x: 57, y: 41.5, w: 10, kind: "blink", period: 2.4, phase: 0.75 },
    { x: 71, y: 41.5, w: 29 },
    { x: 82, y: 51, w: 12 },
    { x: 30, y: 61, w: 60 },
    { x: 14, y: 70.5, w: 10, kind: "blink", period: 3, phase: 0.25 },
    { x: 0, y: 80, w: 44 },
    { x: 44, y: 80, w: 26, kind: "conveyor", push: -0.12 },
    { x: 70, y: 80, w: 30 },
  ],
  hazards: [
    { x: 45, y: GROUND_Y, w: 6 },
    { x: 24, y: 22, w: 6 },
    { x: 36, y: 61, w: 4, kind: "saw", move: { axis: "x", range: 16, period: 2.8 } },
    { x: 58, y: 80, w: 5 },
  ],
  doors: [
    { num: 1, x: 52, y: 22, exit: "left" },
    { num: 2, x: 28, y: 41.5, exit: "right" },
    { num: 3, x: 62, y: 61, exit: "left" },
    { num: 4, x: 32, y: 80, exit: "right" },
  ],
  exit: { x: 76, y: 80, w: 22, h: 12 },
};

export const MAPS: MapDef[] = [MIRROR_CIRCUIT, PISTON_WORKS, ACID_GARDENS, FROST_LINE, CLOCKWORK_SPIRE, DATA_STREAM];

export const getMap = (id: number | null | undefined) => MAPS[id ?? 0] ?? MAPS[0];
