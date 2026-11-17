// app/game/skinRig.ts — skins as a pixel texture + procedural animation.
//
// A skin is one small PNG ("texture", TEX_W x TEX_H) cut into body parts, like a Minecraft skin but laid out
// for this game's front-facing 2D figure. Every animation (idle, walk, jump, fall, think, win, lose) is built
// from those parts by moving them a few pixels per frame, so drawing one pose gives the whole set.
//
// Texture layout (x, y, w, h):          Assembled figure (FRAME_W x FRAME_H):
//   HEAD   0, 0, 10, 10                     HAT covers the top of the head and may stick out
//   TORSO 10, 0,  8, 10                     ARM_L | TORSO | ARM_R   (left / right as seen on screen)
//   ARM_L 18, 0,  3, 10                         LEG_L LEG_R
//   ARM_R 21, 0,  3, 10
//   LEG_L 24, 0,  4,  9
//   LEG_R 28, 0,  4,  9
//   HAT    0,10, 14,  6  (hair, hats, ears, horns; transparent = nothing)
// Arms and legs are drawn with the hand / foot at the bottom.

export const TEX_W = 32;
export const TEX_H = 16;
export const FRAME_W = 18;
export const FRAME_H = 32;

export type PartId = "HEAD" | "TORSO" | "ARM_L" | "ARM_R" | "LEG_L" | "LEG_R" | "HAT";
export type Rect = { x: number; y: number; w: number; h: number };

export const PARTS: Record<PartId, Rect> = {
  HEAD: { x: 0, y: 0, w: 10, h: 10 },
  TORSO: { x: 10, y: 0, w: 8, h: 10 },
  ARM_L: { x: 18, y: 0, w: 3, h: 10 },
  ARM_R: { x: 21, y: 0, w: 3, h: 10 },
  LEG_L: { x: 24, y: 0, w: 4, h: 9 },
  LEG_R: { x: 28, y: 0, w: 4, h: 9 },
  HAT: { x: 0, y: 10, w: 14, h: 6 },
};

/** where each part sits in the standing pose */
const HOME: Record<PartId, { x: number; y: number }> = {
  LEG_L: { x: 5, y: 23 },
  LEG_R: { x: 9, y: 23 },
  TORSO: { x: 5, y: 13 },
  ARM_L: { x: 2, y: 13 },
  ARM_R: { x: 13, y: 13 },
  HEAD: { x: 4, y: 3 },
  HAT: { x: 2, y: 0 },
};

/** the left / right counterpart, for the editor's mirror tool */
export const MIRROR_OF: Partial<Record<PartId, PartId>> = { ARM_L: "ARM_R", ARM_R: "ARM_L", LEG_L: "LEG_R", LEG_R: "LEG_L" };

export function partAt(x: number, y: number): PartId | null {
  for (const id of Object.keys(PARTS) as PartId[]) {
    const r = PARTS[id];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return id;
  }
  return null;
}

export type AnimId = "idle" | "walk" | "jump" | "fall" | "think" | "win" | "lose";
export const ANIMS: AnimId[] = ["idle", "walk", "jump", "fall", "think", "win", "lose"];

/** One part in one frame: offset from its home spot, optional crop and vertical flip. */
type Place = {
  part: PartId;
  dx?: number;
  dy?: number;
  /** draw only rows [from, to) of the part */
  rows?: [number, number];
  /** absolute position of the cropped rows (instead of home + offset) */
  at?: { x: number; y: number };
  flipY?: boolean;
};
type Frame = { places: Place[]; dots?: number };

const ORDER: PartId[] = ["LEG_L", "LEG_R", "TORSO", "ARM_L", "ARM_R", "HEAD", "HAT"];

/** A frame where every part is at home, shifted by `body` (head, torso, arms) and `legs`. */
function pose(opts: {
  body?: number;
  legL?: [number, number];
  legR?: [number, number];
  armL?: [number, number];
  armR?: [number, number];
  head?: [number, number];
  replace?: Partial<Record<PartId, Place[]>>;
  /** drawn last, in front of the head */
  over?: Place[];
  dots?: number;
}): Frame {
  const b = opts.body ?? 0;
  const off: Record<PartId, [number, number]> = {
    LEG_L: opts.legL ?? [0, 0],
    LEG_R: opts.legR ?? [0, 0],
    TORSO: [0, b],
    ARM_L: [(opts.armL ?? [0, 0])[0], (opts.armL ?? [0, 0])[1] + b],
    ARM_R: [(opts.armR ?? [0, 0])[0], (opts.armR ?? [0, 0])[1] + b],
    HEAD: [(opts.head ?? [0, 0])[0], (opts.head ?? [0, 0])[1] + b],
    HAT: [(opts.head ?? [0, 0])[0], (opts.head ?? [0, 0])[1] + b],
  };
  const places: Place[] = [];
  for (const id of ORDER) {
    const custom = opts.replace?.[id];
    if (custom) places.push(...custom);
    else places.push({ part: id, dx: off[id][0], dy: off[id][1] });
  }
  if (opts.over) places.push(...opts.over);
  return { places, dots: opts.dots };
}

/** arm raised above the shoulder: flipped so the hand is on top */
const armUp = (part: "ARM_L" | "ARM_R", dx: number, body = 0): Place => ({
  part,
  flipY: true,
  dx,
  dy: -8 + body,
});

/** hand at the chin: the upper arm stays at the shoulder, the forearm comes up in front of the face */
const upperArm = (body: number): Place[] => [{ part: "ARM_R", rows: [0, 4], at: { x: 13, y: 13 + body } }];
const forearmAtChin = (body: number): Place[] => [{ part: "ARM_R", rows: [5, 10], at: { x: 11, y: 9 + body } }];

export const ANIM_FRAMES: Record<AnimId, { ms: number; frames: Frame[] }> = {
  idle: { ms: 520, frames: [pose({}), pose({ body: 1, armL: [0, 0], armR: [0, 0] })] },
  walk: {
    ms: 110,
    frames: [
      pose({ legL: [-1, 0], legR: [1, -1], armL: [1, 0], armR: [-1, 0] }),
      pose({ body: -1, legL: [0, 0], legR: [0, 0] }),
      pose({ legL: [1, -1], legR: [-1, 0], armL: [-1, 0], armR: [1, 0] }),
      pose({ body: -1, legL: [0, 0], legR: [0, 0] }),
    ],
  },
  jump: {
    ms: 1000,
    frames: [pose({ body: -1, legL: [-1, -3], legR: [1, -3], armL: [-1, -3], armR: [1, -3] })],
  },
  fall: {
    ms: 1000,
    frames: [pose({ legL: [-1, 0], legR: [1, 0], replace: { ARM_L: [armUp("ARM_L", -1)], ARM_R: [armUp("ARM_R", 1)] } })],
  },
  think: {
    ms: 380,
    frames: [0, 1, 2, 3].map((i) =>
      pose({ body: i % 2, replace: { ARM_R: upperArm(i % 2) }, over: forearmAtChin(i % 2), dots: i === 3 ? 0 : i + 1 }),
    ),
  },
  win: {
    ms: 260,
    frames: [
      pose({ replace: { ARM_L: [armUp("ARM_L", 0)], ARM_R: [armUp("ARM_R", 0)] } }),
      pose({ body: -2, legL: [0, -2], legR: [0, -2], replace: { ARM_L: [armUp("ARM_L", -1, -2)], ARM_R: [armUp("ARM_R", 1, -2)] } }),
    ],
  },
  lose: {
    ms: 900,
    frames: [
      pose({ body: 1, head: [0, 1], armL: [1, 1], armR: [-1, 1] }),
      pose({ body: 1, head: [0, 2], armL: [1, 1], armR: [-1, 1] }),
    ],
  },
};

export type Sheet = {
  canvas: HTMLCanvasElement;
  /** first frame index and frame count of each animation in the sheet */
  index: Record<AnimId, { start: number; count: number; ms: number }>;
};

/** Draws one frame of an animation into ctx at (ox, oy). `tex` is a TEX_W x TEX_H canvas or image. */
export function drawFrame(ctx: CanvasRenderingContext2D, tex: CanvasImageSource, anim: AnimId, frame: number, ox = 0, oy = 0) {
  const f = ANIM_FRAMES[anim].frames[frame % ANIM_FRAMES[anim].frames.length];
  ctx.imageSmoothingEnabled = false;
  for (const p of f.places) {
    const r = PARTS[p.part];
    const [r0, r1] = p.rows ?? [0, r.h];
    const h = r1 - r0;
    const home = HOME[p.part];
    const x = ox + (p.at ? p.at.x : home.x + (p.dx ?? 0));
    const y = oy + (p.at ? p.at.y : home.y + (p.dy ?? 0) + r0);
    if (p.flipY) {
      ctx.save();
      ctx.translate(x, y + h);
      ctx.scale(1, -1);
      ctx.drawImage(tex, r.x, r.y + r0, r.w, h, 0, 0, r.w, h);
      ctx.restore();
    } else {
      ctx.drawImage(tex, r.x, r.y + r0, r.w, h, x, y, r.w, h);
    }
  }
  if (f.dots) {
    // a thought: up to three little dots above the head
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < f.dots; i++) ctx.fillRect(ox + 12 + i * 2, oy + 1 - (i % 2), 1, 1);
  }
}

/** All animations of one texture side by side in a single canvas (built once, then only copied). */
export function buildSheet(tex: CanvasImageSource): Sheet {
  const total = ANIMS.reduce((n, a) => n + ANIM_FRAMES[a].frames.length, 0);
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W * total;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext("2d")!;
  const index = {} as Sheet["index"];
  let i = 0;
  for (const a of ANIMS) {
    const { frames, ms } = ANIM_FRAMES[a];
    index[a] = { start: i, count: frames.length, ms };
    frames.forEach((_, k) => drawFrame(ctx, tex, a, k, (i + k) * FRAME_W, 0));
    i += frames.length;
  }
  return { canvas, index };
}
