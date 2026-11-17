// app/game/builtinSkins.ts — the four built-in skins as pixel textures (see skinRig.ts for the layout).
// Each part is written row by row; a character is a palette key, "." is transparent. Left / right are as seen
// on screen, so the outer edge of ARM_L and LEG_L is their first column.
import { PARTS, TEX_H, TEX_W, type PartId } from "./skinRig";

export type PixelSkin = { palette: Record<string, string>; parts: Record<PartId, string[]> };

/** mirror a left part into the right one */
const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));

const NEON_RONIN: PixelSkin = (() => {
  const armL = ["kbn", "kbn", "kbn", "kbn", "kbn", "kbn", "rRr", "kss", "sds", "kkk"];
  const legL = ["kNNn", "kNnn", "kNnn", "kNnn", "kNnn", "kNnn", "kNnn", "kNNN", "kkkk"];
  return {
    palette: {
      k: "#0a0a14", s: "#e8b07a", d: "#c48a5c", h: "#5b6470", H: "#8a97a6",
      n: "#141c44", N: "#0b1030", b: "#8fa3d8", r: "#b0102a", R: "#7a0a1e", p: "#e05aa8",
    },
    parts: {
      HEAD: [".kssssssk.", "kssssssssk", "kssssssssk", "kssssssssk", "kssssssssk", "kssssssssk", "kdssssssdk", ".kdssssdk.", "..kddddk..", "...kssk..."],
      TORSO: ["kNrRRrNk", "knnrRnnk", "bnnrRnnb", "bnnrRnnb", "knnrRnnk", "knnRRnnk", "knnrRnnk", "knnrRnnk", "krrrrrpk", "kNNNNNNk"],
      ARM_L: armL,
      ARM_R: mirror(armL),
      LEG_L: legL,
      LEG_R: mirror(legL).map((r, i) => (i > 0 && i < 7 ? r.slice(0, 2) + "b" + r.slice(3) : r)),
      HAT: ["...k.kk.k.k...", "..kHkHhkHkhk..", ".khHhhHhhhHhk.", ".khhhhhhhhhhk.", ".kh........hk.", ".kh........hk."],
    },
  };
})();

const CRIMSON_CIPHER: PixelSkin = (() => {
  const armL = ["kvn", "kvn", "kvn", "knn", "knn", "knn", "knn", "kss", "sds", "kkk"];
  const legL = ["kNnn", "kNnn", "kNnn", "kNnn", "kNnn", "kNnn", "kNnn", "kNNN", "kkkk"];
  return {
    palette: {
      k: "#0a0a14", s: "#e8b07a", d: "#c48a5c", h: "#1c1f26", H: "#4a525e",
      n: "#141c44", N: "#0b1030", v: "#5a4f9a", l: "#8fa3d8", r: "#c0102a", R: "#7a0a1e", p: "#f08aa0",
    },
    parts: {
      HEAD: ["khssssshhk", "khssssssHk", "khssssssHk", "khssssssHk", "khssssssHk", "khssssssHk", "khsssssshk", "khdssssdhk", "khhdddshhk", "kh.kNNk.hk"],
      TORSO: ["kNnnnnNk", "vnrRrrnv", "lnrrrprl", "lnRrrrnl", "vnnRrnnv", "knnnRnnk", "knnnnnvk", "knnnnvvk", "kNnnnvNk", "kNNNNNNk"],
      ARM_L: armL,
      ARM_R: mirror(armL),
      LEG_L: legL,
      LEG_R: mirror(legL).map((r, i) => (i > 1 && i < 7 ? r.slice(0, 2) + "v" + r.slice(3) : r)),
      HAT: ["....kkkkkk....", "..kkhhhhhhkk..", ".khhhHhhhhhhk.", ".khhhhhhhHhhk.", ".khhhh....hhk.", ".khh.......hk."],
    },
  };
})();

const BYTE_KNIGHT: PixelSkin = (() => {
  const armL = ["kgg", "kgg", "kBB", "kBB", "kBB", "kBB", "kBB", "kgg", "kgg", "kkk"];
  const legL = ["kBBB", "kgBB", "kgbB", "kgbB", "kgbB", "kgbB", "kBBB", "kGGD", "kkkk"];
  return {
    palette: {
      k: "#1a1206", B: "#713f12", b: "#a16207", g: "#ca8a04", G: "#facc15", c: "#00f0ff", D: "#362208",
    },
    parts: {
      HEAD: ["kBbbbbbbBk", "kbbbbbbbbk", "kbggggggbk", "kbccccccbk", "kbccccccbk", "kbbbbbbbbk", "kbgbbbbgbk", "kBbbbbbbBk", ".kBBBBBBk.", "...kDDk..."],
      TORSO: ["kBggggBk", "kgbbbbgk", "kgbGGbgk", "kgbGGbgk", "kgbGGbgk", "kgbGGbgk", "kgbbbbgk", "kBggggBk", "kDDDDDDk", "kBBBBBBk"],
      ARM_L: armL,
      ARM_R: mirror(armL),
      LEG_L: legL,
      LEG_R: mirror(legL),
      HAT: ["......kk......", ".....kGGk.....", ".....kGgk.....", "......kk......", "..............", ".............."],
    },
  };
})();

const PUMPKIN_PHANTOM: PixelSkin = (() => {
  const armL = ["kCc", "kCc", "kcc", "kcc", "kcc", "kcc", "kcc", "kgg", "ggg", "kkk"];
  const legL = ["kccc", "kccc", "kccc", "kccc", "kcCc", "kccc", "kccc", "kCCC", "kkkk"];
  return {
    palette: {
      k: "#02040b", o: "#e8741e", O: "#b4501a", y: "#ffd54a", g: "#3e6b2e", c: "#2a1640", C: "#4b2a6e",
    },
    parts: {
      HEAD: ["kooOooOook", "kooOooOook", "koyyOoyyok", "koyyOoyyok", "kooOooOook", "koyoyyoyok", "kooyOOyook", "kooOooOook", ".kooOOook.", "...kCCk..."],
      TORSO: ["kCccccCk", "kcccccck", "kccOOcck", "kccOOcck", "kcccccck", "kcccccck", "kccccCck", "kcCcccck", "kcccccck", "kkkkkkkk"],
      ARM_L: armL,
      ARM_R: mirror(armL),
      LEG_L: legL,
      LEG_R: mirror(legL),
      HAT: ["......kgk.....", "......kgkgg...", "......kgk.....", "..............", "..............", ".............."],
    },
  };
})();

export const BUILTIN_SKINS: Record<string, PixelSkin> = {
  neon_ronin: NEON_RONIN,
  crimson_cipher: CRIMSON_CIPHER,
  byte_knight: BYTE_KNIGHT,
  pumpkin_phantom: PUMPKIN_PHANTOM,
};

/** Paints a PixelSkin into a TEX_W x TEX_H texture canvas. */
export function pixelSkinToCanvas(skin: PixelSkin): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext("2d")!;
  for (const id of Object.keys(PARTS) as PartId[]) {
    const r = PARTS[id];
    skin.parts[id].slice(0, r.h).forEach((row, y) => {
      for (let x = 0; x < r.w; x++) {
        const color = skin.palette[row[x] ?? "."];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(r.x + x, r.y + y, 1, 1);
      }
    });
  }
  return c;
}
