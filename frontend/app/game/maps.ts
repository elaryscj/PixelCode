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
//
// Fixed platforms are SOLID blocks (physics.ts): you cannot jump up through a floor, you bump your head.
// So every map has four floors 24 apart (room for a jump under the ceiling) and the way up is a gap in
// the floor above with a step, a lift or a bounce pad under it. Lifts, blinking and crumbling blocks
// stay one-way (you can jump up onto them from below).
// The route zigzags: F1 left -> right, F2 right -> left, F3 left -> right, F4 right -> left to the exit.

const F = [GROUND_Y, 27, 51, 75];

// Ledges, spikes and four gates: the plain version of the layout.
const MIRROR_CIRCUIT: MapDef = {
  id: 0,
  name: "MIRROR CIRCUIT",
  sector: "SECTOR 04",
  tagline: "THE CLASSIC: LEDGES, SPIKES AND FOUR GATES",
  floors: F,
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 100 },
    { x: 92, y: 15, w: 7 }, // step F1 -> F2
    { x: 0, y: 27, w: 80 },
    { x: 1, y: 39, w: 7 }, // step F2 -> F3
    { x: 20, y: 51, w: 80 },
    { x: 92, y: 63, w: 7 }, // step F3 -> F4
    { x: 0, y: 75, w: 80 },
  ],
  hazards: [
    { x: 40, y: GROUND_Y, w: 6 },
    { x: 52, y: 27, w: 6 },
    { x: 44, y: 51, w: 6 },
    { x: 33, y: 75, w: 5 },
  ],
  doors: [
    { num: 1, x: 62, y: GROUND_Y, exit: "right" },
    { num: 2, x: 30, y: 27, exit: "left" },
    { num: 3, x: 66, y: 51, exit: "right" },
    { num: 4, x: 50, y: 75, exit: "left" },
  ],
  exit: { x: 4, y: 75, w: 20, h: 12 },
};

// Lifts and conveyor belts that push you into spikes.
const PISTON_WORKS: MapDef = {
  id: 1,
  name: "PISTON WORKS",
  sector: "SECTOR 07",
  tagline: "RIDE THE LIFTS, FIGHT THE BELTS",
  floors: F,
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 30 },
    { x: 30, y: GROUND_Y, w: 40, kind: "conveyor", push: -0.12 },
    { x: 70, y: GROUND_Y, w: 14 },
    { x: 86, y: GROUND_Y, w: 12, move: { axis: "y", range: 24, period: 5 } }, // lift F1 -> F2
    { x: 15, y: 27, w: 69 }, // nothing under the lift's shaft: you can't stand beneath it
    { x: 3, y: 27, w: 11, move: { axis: "y", range: 24, period: 5, phase: 0.5 } }, // lift F2 -> F3
    { x: 18, y: 51, w: 26 },
    { x: 44, y: 51, w: 26, kind: "conveyor", push: 0.13 },
    { x: 70, y: 51, w: 16 },
    { x: 87, y: 51, w: 11, move: { axis: "y", range: 24, period: 5 } }, // lift F3 -> F4
    { x: 0, y: 75, w: 82 },
  ],
  hazards: [
    { x: 50, y: GROUND_Y, w: 6 },
    { x: 62, y: 27, w: 6 },
    { x: 76, y: 51, w: 5 },
    { x: 56, y: 75, w: 6 },
  ],
  doors: [
    { num: 1, x: 20, y: GROUND_Y, exit: "right" },
    { num: 2, x: 44, y: 27, exit: "left" },
    { num: 3, x: 30, y: 51, exit: "right" },
    { num: 4, x: 40, y: 75, exit: "left" },
  ],
  exit: { x: 4, y: 75, w: 22, h: 12 },
};

// Parkour over an acid pit, crumbling steps, bounce pads.
const ACID_GARDENS: MapDef = {
  id: 2,
  name: "ACID GARDENS",
  sector: "SECTOR 13",
  tagline: "PILLAR PARKOUR OVER ACID. DON'T LINGER ON CRACKED STONE",
  floors: F,
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 14 },
    { x: 19, y: 6, w: 6 },
    { x: 30, y: 7, w: 6 },
    { x: 41, y: 6, w: 6 },
    { x: 52, y: 7, w: 6 },
    { x: 63, y: 6, w: 6 },
    { x: 74, y: GROUND_Y, w: 17 },
    { x: 91, y: GROUND_Y, w: 8, kind: "bounce", power: 1.5 }, // -> F2 through the gap
    { x: 0, y: 27, w: 86 },
    { x: 12, y: 39, w: 7, kind: "crumble" }, // F2 -> F3
    { x: 24, y: 51, w: 30 },
    { x: 57, y: 53, w: 6, move: { axis: "y", range: 4, period: 2.5 } },
    { x: 66, y: 51, w: 25 },
    { x: 91, y: 51, w: 8, kind: "bounce", power: 1.5 }, // -> F4 through the gap
    { x: 14, y: 75, w: 74 },
  ],
  hazards: [
    { x: 14, y: GROUND_Y, w: 60, kind: "acid" },
    { x: 60, y: 27, w: 6 },
    { x: 44, y: 75, w: 4, kind: "saw", move: { axis: "x", range: 10, period: 3 } },
  ],
  doors: [
    { num: 1, x: 80, y: GROUND_Y, exit: "right" },
    { num: 2, x: 40, y: 27, exit: "left" },
    { num: 3, x: 34, y: 51, exit: "right" },
    { num: 4, x: 70, y: 75, exit: "left" },
  ],
  exit: { x: 16, y: 75, w: 20, h: 12 },
};

// Ice floors you slide on, icicles that drop from the ceiling and rise again.
const FROST_LINE: MapDef = {
  id: 3,
  name: "FROST LINE",
  sector: "SECTOR 21",
  tagline: "EVERY FLOOR IS ICE. BRAKE EARLY, WATCH THE CEILING",
  floors: F,
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 100, kind: "ice" },
    { x: 92, y: 15, w: 7 }, // step F1 -> F2
    { x: 2, y: 27, w: 9, kind: "bounce", power: 1.5 }, // -> F3 through the gap
    { x: 11, y: 27, w: 69, kind: "ice" },
    { x: 16, y: 51, w: 64, kind: "ice" },
    { x: 92, y: 63, w: 7 }, // step F3 -> F4
    { x: 0, y: 75, w: 80, kind: "ice" },
  ],
  hazards: [
    { x: 40, y: GROUND_Y, w: 6 },
    { x: 28, y: 12, w: 3, kind: "icicle", move: { axis: "y", range: 6, period: 2.2 } },
    { x: 44, y: 27, w: 6 },
    { x: 50, y: 60, w: 3, kind: "icicle", move: { axis: "y", range: 6, period: 2.4, phase: 0.3 } },
    { x: 52, y: 75, w: 6 },
  ],
  doors: [
    { num: 1, x: 60, y: GROUND_Y, exit: "right" },
    { num: 2, x: 24, y: 27, exit: "left" },
    { num: 3, x: 64, y: 51, exit: "right" },
    { num: 4, x: 36, y: 75, exit: "left" },
  ],
  exit: { x: 4, y: 75, w: 22, h: 12 },
};

// Timing parkour on moving blocks; saws patrol the corridors.
const CLOCKWORK_SPIRE: MapDef = {
  id: 4,
  name: "CLOCKWORK SPIRE",
  sector: "SECTOR 33",
  tagline: "EVERYTHING MOVES. JUMP ON THE BEAT",
  floors: F,
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 40 },
    { x: 42, y: 6, w: 10, move: { axis: "x", range: 32, period: 5 } }, // ferry over acid
    { x: 86, y: GROUND_Y, w: 14 },
    { x: 92, y: 15, w: 7 }, // step F1 -> F2
    { x: 12, y: 27, w: 68 },
    { x: 2, y: 27, w: 9, move: { axis: "y", range: 24, period: 4.5 } }, // lift F2 -> F3
    { x: 16, y: 51, w: 17 },
    { x: 38, y: 53, w: 9, move: { axis: "y", range: 6, period: 2.4 } },
    { x: 54, y: 55, w: 9, move: { axis: "x", range: 12, period: 3 } },
    { x: 80, y: 51, w: 20 },
    { x: 92, y: 63, w: 7 }, // step F3 -> F4
    { x: 18, y: 75, w: 62 },
  ],
  hazards: [
    { x: 40, y: GROUND_Y, w: 46, kind: "acid" },
    { x: 14, y: 27, w: 4, kind: "saw", move: { axis: "x", range: 24, period: 3 } },
    { x: 40, y: 75, w: 4, kind: "saw", move: { axis: "x", range: 12, period: 2.6 } },
  ],
  doors: [
    { num: 1, x: 20, y: GROUND_Y, exit: "right" },
    { num: 2, x: 50, y: 27, exit: "left" },
    { num: 3, x: 22, y: 51, exit: "right" },
    { num: 4, x: 66, y: 75, exit: "left" },
  ],
  exit: { x: 18, y: 75, w: 20, h: 12 },
};

// Phase blocks that blink in and out, belts and a bounce pad.
const DATA_STREAM: MapDef = {
  id: 5,
  name: "DATA STREAM",
  sector: "SECTOR 42",
  tagline: "PHASE BLOCKS BLINK. CROSS WHEN THEY'RE SOLID",
  floors: F,
  start: { x: 4, y: GROUND_Y },
  platforms: [
    { x: 0, y: GROUND_Y, w: 25 },
    { x: 25, y: GROUND_Y, w: 45, kind: "conveyor", push: 0.14 },
    { x: 70, y: GROUND_Y, w: 30 },
    { x: 88, y: 16.5, w: 9, kind: "blink", period: 3 }, // F1 -> F2
    { x: 2, y: 27, w: 10, kind: "bounce", power: 1.5 }, // -> F3 through the gap
    { x: 12, y: 27, w: 32, kind: "conveyor", push: -0.12 },
    { x: 44, y: 27, w: 36 },
    { x: 16, y: 51, w: 22 },
    { x: 43, y: 51, w: 10, kind: "blink", period: 2.4 },
    { x: 57, y: 51, w: 10, kind: "blink", period: 2.4, phase: 0.75 },
    { x: 71, y: 51, w: 29 },
    { x: 89, y: 64.5, w: 9, kind: "blink", period: 3, phase: 0.25 }, // F3 -> F4
    { x: 0, y: 75, w: 44 },
    { x: 44, y: 75, w: 26, kind: "conveyor", push: -0.12 },
    { x: 70, y: 75, w: 10 },
  ],
  hazards: [
    { x: 45, y: GROUND_Y, w: 6 },
    { x: 24, y: 27, w: 6 },
    { x: 58, y: 75, w: 5 },
  ],
  doors: [
    { num: 1, x: 12, y: GROUND_Y, exit: "right" },
    { num: 2, x: 54, y: 27, exit: "left" },
    { num: 3, x: 26, y: 51, exit: "right" },
    { num: 4, x: 34, y: 75, exit: "left" },
  ],
  exit: { x: 4, y: 75, w: 22, h: 12 },
};

export const MAPS: MapDef[] = [MIRROR_CIRCUIT, PISTON_WORKS, ACID_GARDENS, FROST_LINE, CLOCKWORK_SPIRE, DATA_STREAM];

export const getMap = (id: number | null | undefined) => MAPS[id ?? 0] ?? MAPS[0];
