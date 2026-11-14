// app/game/physics.ts
// Local player physics (units: % of one arena panel, per 60 FPS frame). Pure: no React, no DOM.
import {
  DEFAULT_HAZARD_H,
  GROUND_Y,
  blinkSolid,
  hazardPos,
  platPos,
  type DoorDef,
  type MapDef,
  type PlatformDef,
} from "./maps";

export const GRAVITY = 0.038;
export const MOVE_SPEED = 0.42;
export const JUMP_FORCE = 1.08; // peak ~14.8 units
export const FRICTION = 0.82;
export const ICE_FRICTION = 0.965;
export const ICE_MAX_SPEED = 0.7;
export const CHAR_W = 6;
export const CHAR_H = 11;
export const PLATFORM_H = 2.6;
export const DOOR_W = 6.5;
export const DOOR_H = 10;
export const BARRIER_H = 18; // taller than a jump, so a locked door cannot be hopped over
export const DOORS = 4;

const CRUMBLE_AFTER = 0.55; // seconds standing before it breaks
const CRUMBLE_RESPAWN = 2.5; // seconds until it is back

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  facingLeft: boolean;
  respawnX: number;
  respawnY: number;
  coyote: number;
  riding: number; // index of the platform stood on last frame, -1 = none
  surface: PlatformDef | null;
  bounced: number; // frames since the last bounce-pad launch (for a tiny squash effect)
}

export function createPlayer(map: MapDef): PlayerState {
  return {
    x: map.start.x,
    y: map.start.y,
    vx: 0,
    vy: 0,
    isGrounded: true,
    facingLeft: false,
    respawnX: map.start.x,
    respawnY: map.start.y,
    coyote: 0,
    riding: -1,
    surface: null,
    bounced: 99,
  };
}

/** Per-player state of crumbling platforms (index -> timing), in world seconds. */
export type CrumbleState = Map<number, { stood: number; brokenUntil: number }>;

export function platformSolid(p: PlatformDef, i: number, t: number, crumble: CrumbleState): boolean {
  if (p.kind === "blink") return blinkSolid(p, t);
  if (p.kind === "crumble") return (crumble.get(i)?.brokenUntil ?? 0) <= t;
  return true;
}

/** Respawn point just past a door once it is open. */
export function doorRespawn(d: DoorDef): { x: number; y: number } {
  return d.exit === "left" ? { x: d.x - CHAR_W - 1, y: d.y } : { x: d.x + DOOR_W + 1, y: d.y };
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface StepResult {
  hitHazard: boolean;
  nearDoor: number | null;
  atExit: boolean;
}

/**
 * Advances the player by `dt` frames. `t` / `tPrev` are world seconds now / last frame
 * (moving parts are a function of time, so riders are carried by the platform's delta).
 */
export function stepPlayer(
  p: PlayerState,
  input: Input,
  map: MapDef,
  unlocked: number[],
  crumble: CrumbleState,
  t: number,
  tPrev: number,
  dt: number,
): StepResult {
  const plats = map.platforms;

  // 1. Carried by the platform we stood on (moving blocks, lifts) and pushed by belts
  if (p.riding >= 0 && p.isGrounded) {
    const rp = plats[p.riding];
    if (rp.move) {
      const a = platPos(rp, tPrev);
      const b = platPos(rp, t);
      p.x += b.x - a.x;
      p.y += b.y - a.y;
    }
    if (rp.kind === "conveyor") p.x += (rp.push ?? 0) * dt;
  }

  // 2. Input
  const onIce = p.isGrounded && p.surface?.kind === "ice";
  const accel = MOVE_SPEED * 0.25 * (onIce ? 0.45 : 1);
  if (input.left) {
    p.vx -= accel * dt;
    p.facingLeft = true;
  }
  if (input.right) {
    p.vx += accel * dt;
    p.facingLeft = false;
  }
  if (input.jump && (p.isGrounded || p.coyote > 0)) {
    p.vy = JUMP_FORCE;
    p.isGrounded = false;
    p.coyote = 0;
  }

  p.vx *= Math.pow(onIce ? ICE_FRICTION : FRICTION, dt);
  if (onIce) p.vx = Math.max(-ICE_MAX_SPEED, Math.min(ICE_MAX_SPEED, p.vx));
  p.vy -= GRAVITY * dt;

  const prevX = p.x;
  const prevY = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.x < 1) {
    p.x = 1;
    p.vx = 0;
  }
  if (p.x > 100 - CHAR_W - 1) {
    p.x = 100 - CHAR_W - 1;
    p.vx = 0;
  }

  // 3. A locked door is a solid wall from both sides (US-13)
  for (const cp of map.doors) {
    if (unlocked.includes(cp.num)) continue;
    const left = cp.x;
    const right = cp.x + DOOR_W;
    // the wall stands ON the door's floor: someone jumping on the floor below is not touching it
    const sameHeight = p.y < cp.y + BARRIER_H && p.y >= cp.y - 1;
    if (sameHeight && p.x + CHAR_W > left && p.x < right) {
      if (prevX + CHAR_W <= left + 0.01) {
        p.x = left - CHAR_W;
        p.vx = Math.min(p.vx, 0);
      } else if (prevX >= right - 0.01) {
        p.x = right;
        p.vx = Math.max(p.vx, 0);
      } else if (cp.exit === "left") {
        // entered the wall from below (jumping up under the door): back to the locked side
        p.x = right;
      } else {
        p.x = left - CHAR_W;
      }
    }
  }

  // 4. One-way platforms: land on the top edge when falling
  p.isGrounded = false;
  p.riding = -1;
  let standingOn: PlatformDef | null = null;
  for (let i = 0; i < plats.length; i++) {
    const plat = plats[i];
    if (!platformSolid(plat, i, t, crumble)) continue;
    const pos = platPos(plat, t);
    const prevPos = plat.move ? platPos(plat, tPrev) : pos;
    const rise = Math.max(0, pos.y - prevPos.y); // a lift moving up must still catch us
    const inside = p.x + CHAR_W > pos.x + 0.5 && p.x < pos.x + plat.w - 0.5;
    if (inside && prevY >= prevPos.y - 0.6 - rise && p.y <= pos.y && p.vy <= 0) {
      p.y = pos.y;
      p.vy = 0;
      p.isGrounded = true;
      p.riding = i;
      standingOn = plat;
      break;
    }
  }

  if (p.y < GROUND_Y) {
    p.y = GROUND_Y;
    p.vy = 0;
    p.isGrounded = true;
  }
  if (p.y > 92) {
    p.y = 92;
    p.vy = Math.min(p.vy, 0);
  }

  // 5. Special surfaces
  p.bounced += dt;
  if (standingOn?.kind === "bounce") {
    p.vy = standingOn.power ?? 1.25;
    p.isGrounded = false;
    p.riding = -1;
    p.bounced = 0;
    standingOn = null;
  }
  if (standingOn?.kind === "crumble") {
    const st = crumble.get(p.riding) ?? { stood: 0, brokenUntil: 0 };
    st.stood += dt / 60;
    if (st.stood >= CRUMBLE_AFTER) {
      st.stood = 0;
      st.brokenUntil = t + CRUMBLE_RESPAWN;
    }
    crumble.set(p.riding, st);
  }
  // cracks heal slowly when nobody stands on them
  for (const [i, st] of crumble) {
    if (i !== p.riding && st.stood > 0) st.stood = Math.max(0, st.stood - dt / 240);
  }
  p.surface = standingOn;

  // a few frames of grace after walking off an edge
  p.coyote = p.isGrounded ? 5 : Math.max(0, p.coyote - dt);

  // 6. Hazards: spikes, acid, saws, icicles
  let hitHazard = false;
  for (const h of map.hazards) {
    const pos = hazardPos(h, t);
    const hh = h.h ?? DEFAULT_HAZARD_H[h.kind ?? "spikes"];
    // only from the hazard's own floor: a head poking up through the floor above does not count
    const onItsFloor = p.y >= hazardFloor(map, h) - 1;
    if (onItsFloor && p.x + CHAR_W > pos.x + 1 && p.x < pos.x + h.w - 1 && p.y < pos.y + hh - 1 && p.y + CHAR_H > pos.y + 0.5) {
      hitHazard = true;
      break;
    }
  }

  // Safe spot to come back to: a steady static platform away from every hazard's path
  if (!hitHazard && p.isGrounded && standingOn && isSafeGround(standingOn)) {
    const nearDanger = map.hazards.some((h) => {
      const reach = h.move?.axis === "x" ? h.move.range : 0;
      const hy = h.y;
      const top = hy + (h.h ?? DEFAULT_HAZARD_H[h.kind ?? "spikes"]) + (h.move?.axis === "y" ? h.move.range : 0);
      const sameLevel = p.y >= hy - 1 && p.y <= top + 1;
      return sameLevel && p.x + CHAR_W > h.x - 5 && p.x < h.x + h.w + reach + 5;
    });
    if (!nearDanger) {
      p.respawnX = p.x;
      p.respawnY = p.y;
    }
  }

  // 7. Proximity prompt for the next locked door
  let nearDoor: number | null = null;
  for (const cp of map.doors) {
    if (!unlocked.includes(cp.num)) {
      const dx = Math.abs(p.x + CHAR_W / 2 - (cp.x + DOOR_W / 2));
      // feet on the door's floor (not jumping up from the floor below)
      if (dx < 10 && p.y >= cp.y - 0.5 && p.y < cp.y + 6) {
        nearDoor = cp.num;
        break;
      }
    }
  }

  const ex = map.exit;
  const atExit =
    unlocked.length >= DOORS && p.x + CHAR_W >= ex.x && p.x <= ex.x + ex.w && p.y >= ex.y - 0.5 && p.y <= ex.y + ex.h;

  return { hitHazard, nearDoor, atExit };
}

/** The floor a hazard stands on (or hangs above): the highest static platform under its lowest point. */
const hazardFloors = new WeakMap<object, number>();
function hazardFloor(map: MapDef, h: MapDef["hazards"][number]): number {
  const cached = hazardFloors.get(h);
  if (cached !== undefined) return cached;
  const reach = h.move?.axis === "x" ? h.move.range : 0;
  let floor = GROUND_Y;
  for (const pl of map.platforms) {
    if (pl.move) continue;
    const overlaps = pl.x < h.x + h.w + reach && pl.x + pl.w > h.x;
    if (overlaps && pl.y <= h.y + 0.01 && pl.y > floor) floor = pl.y;
  }
  hazardFloors.set(h, floor);
  return floor;
}

function isSafeGround(p: PlatformDef): boolean {
  if (p.move || p.w < 10) return false;
  const k = p.kind ?? "solid";
  return k === "solid" || k === "ice";
}

export function respawn(p: PlayerState) {
  p.x = p.respawnX;
  p.y = p.respawnY;
  p.vx = 0;
  p.vy = 0;
  p.riding = -1;
  p.isGrounded = false;
}

export const floorOf = (map: MapDef, y: number) => map.floors.filter((f) => f <= y + 0.5).length || 1;
