// app/components/admin/SkinEditor.tsx — pixel editor for skin textures (admin page, English only).
// The texture is TEX_W x TEX_H pixels cut into body parts (game/skinRig.ts); the preview animates it live.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatedSkin } from "~/components/skins";
import { BUILTIN_SKINS, pixelSkinToCanvas } from "~/game/builtinSkins";
import {
  ANIMS,
  ANIM_FRAMES,
  FRAME_H,
  FRAME_W,
  MIRROR_OF,
  PARTS,
  TEX_H,
  TEX_W,
  buildSheet,
  partAt,
  type AnimId,
  type PartId,
} from "~/game/skinRig";
import { encodeGif } from "~/lib/gif";

type Tool = "pencil" | "eraser" | "fill" | "picker";

const ZOOM = 20;
const PART_COLORS: Record<PartId, string> = {
  HEAD: "#facc15",
  TORSO: "#01e4ff",
  ARM_L: "#fe2c96",
  ARM_R: "#fe2c96",
  LEG_L: "#a3e635",
  LEG_R: "#a3e635",
  HAT: "#c084fc",
};
const PART_NAMES: Record<PartId, string> = {
  HEAD: "Head",
  TORSO: "Body",
  ARM_L: "Left arm (hand at the bottom)",
  ARM_R: "Right arm (hand at the bottom)",
  LEG_L: "Left leg (foot at the bottom)",
  LEG_R: "Right leg (foot at the bottom)",
  HAT: "Hair / hat (drawn over the top of the head)",
};
const SWATCHES = [
  "#0a0a14", "#ffffff", "#e8b07a", "#c48a5c", "#8d5524", "#5b6470", "#1c1f26",
  "#141c44", "#0b1030", "#8fa3d8", "#5a4f9a", "#b0102a", "#f08aa0", "#e8741e",
  "#ffd54a", "#ca8a04", "#3e6b2e", "#a3e635", "#00f0ff", "#01e4ff", "#fe2c96",
];
const ANIM_LABEL: Record<AnimId, string> = {
  idle: "Idle", walk: "Walk", jump: "Jump", fall: "Fall", think: "Think (at a door)", win: "Win", lose: "Lose",
};

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

function canvasToPixels(c: HTMLCanvasElement | HTMLImageElement): Uint8ClampedArray {
  const tmp = document.createElement("canvas");
  tmp.width = TEX_W;
  tmp.height = TEX_H;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(c, 0, 0);
  return ctx.getImageData(0, 0, TEX_W, TEX_H).data;
}

function pixelsToCanvas(px: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px), TEX_W, TEX_H), 0, 0);
  return c;
}

export const textureToDataUrl = (px: Uint8ClampedArray) => pixelsToCanvas(px).toDataURL("image/png");

export function loadTextureFromUrl(src: string): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      img.naturalWidth === TEX_W && img.naturalHeight === TEX_H
        ? resolve(canvasToPixels(img))
        : reject(new Error(`The texture must be ${TEX_W} x ${TEX_H} pixels (this one is ${img.naturalWidth} x ${img.naturalHeight})`));
    img.onerror = () => reject(new Error("This file is not a readable image"));
    img.src = src;
  });
}

export const builtinTexture = (id: string) => canvasToPixels(pixelSkinToCanvas(BUILTIN_SKINS[id]));

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Pixels that also get painted with the mirror tool on: the matching spot on the other arm / leg, or across a part. */
function mirrorPoint(x: number, y: number): [number, number] | null {
  const id = partAt(x, y);
  if (!id) return null;
  const p = PARTS[id];
  const twin = MIRROR_OF[id];
  if (twin) {
    const q = PARTS[twin];
    return [q.x + (p.w - 1 - (x - p.x)), q.y + (y - p.y)];
  }
  return [p.x + (p.w - 1 - (x - p.x)), y];
}

export default function SkinEditor({
  pixels,
  onChange,
}: {
  pixels: Uint8ClampedArray;
  onChange: (px: Uint8ClampedArray) => void;
}) {
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#e8b07a");
  const [mirror, setMirror] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [gifAnim, setGifAnim] = useState<AnimId>("walk");
  const [msg, setMsg] = useState<string | null>(null);
  const undo = useRef<Uint8ClampedArray[]>([]);
  const redo = useRef<Uint8ClampedArray[]>([]);
  const drawing = useRef<Uint8ClampedArray | null>(null);
  // the newest pixels, also between a change and the next render (fast strokes must not drop pixels)
  const live = useRef(pixels);
  live.current = pixels;
  const change = (next: Uint8ClampedArray) => {
    live.current = next;
    onChange(next);
  };

  // ---------------------------------------------------------------- drawing the grid
  useEffect(() => {
    const c = gridRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#03050c";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < TEX_H; y++) {
      for (let x = 0; x < TEX_W; x++) {
        const inPart = partAt(x, y) !== null;
        // checkerboard = transparent but paintable; flat dark = outside the template
        ctx.fillStyle = inPart ? ((x + y) % 2 ? "#1b2140" : "#151a33") : "#05070f";
        ctx.fillRect(x * ZOOM, y * ZOOM, ZOOM, ZOOM);
        const i = (y * TEX_W + x) * 4;
        if (pixels[i + 3] > 0) {
          ctx.fillStyle = `rgba(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3] / 255})`;
          ctx.fillRect(x * ZOOM, y * ZOOM, ZOOM, ZOOM);
        }
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= TEX_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * ZOOM + 0.5, 0);
      ctx.lineTo(x * ZOOM + 0.5, TEX_H * ZOOM);
      ctx.stroke();
    }
    for (let y = 0; y <= TEX_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * ZOOM + 0.5);
      ctx.lineTo(TEX_W * ZOOM, y * ZOOM + 0.5);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    for (const id of Object.keys(PARTS) as PartId[]) {
      const r = PARTS[id];
      ctx.strokeStyle = PART_COLORS[id];
      ctx.strokeRect(r.x * ZOOM + 1, r.y * ZOOM + 1, r.w * ZOOM - 2, r.h * ZOOM - 2);
    }
    if (hover) {
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(hover.x * ZOOM + 1, hover.y * ZOOM + 1, ZOOM - 2, ZOOM - 2);
    }
  }, [pixels, hover]);

  // ---------------------------------------------------------------- editing
  const commit = useCallback(
    (next: Uint8ClampedArray, before: Uint8ClampedArray) => {
      undo.current.push(before);
      if (undo.current.length > 100) undo.current.shift();
      redo.current = [];
      onChange(next);
    },
    [onChange],
  );

  const rgba = (): [number, number, number, number] => {
    if (tool === "eraser") return [0, 0, 0, 0];
    const v = parseInt(color.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
  };

  const put = (px: Uint8ClampedArray, x: number, y: number, c: number[]) => {
    if (x < 0 || y < 0 || x >= TEX_W || y >= TEX_H || partAt(x, y) === null) return;
    px.set(c, (y * TEX_W + x) * 4);
  };

  const cellOf = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * TEX_W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * TEX_H);
    return x >= 0 && y >= 0 && x < TEX_W && y < TEX_H ? { x, y } : null;
  };

  const paintAt = (px: Uint8ClampedArray, x: number, y: number) => {
    const c = rgba();
    put(px, x, y, c);
    if (mirror) {
      const m = mirrorPoint(x, y);
      if (m) put(px, m[0], m[1], c);
    }
  };

  const fillAt = (px: Uint8ClampedArray, sx: number, sy: number) => {
    const part = partAt(sx, sy);
    if (!part) return;
    const r = PARTS[part];
    const i0 = (sy * TEX_W + sx) * 4;
    const target = [px[i0], px[i0 + 1], px[i0 + 2], px[i0 + 3]];
    const c = rgba();
    if (target.every((v, k) => v === c[k])) return;
    const same = (x: number, y: number) => {
      const i = (y * TEX_W + x) * 4;
      return px[i] === target[0] && px[i + 1] === target[1] && px[i + 2] === target[2] && px[i + 3] === target[3];
    };
    // flood fill that stays inside the part
    const stack: [number, number][] = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h || !same(x, y)) continue;
      px.set(c, (y * TEX_W + x) * 4);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const cell = cellOf(e);
    if (!cell) return;
    if (tool === "picker") {
      const i = (cell.y * TEX_W + cell.x) * 4;
      if (pixels[i + 3] > 0) {
        setColor(hex(pixels[i], pixels[i + 1], pixels[i + 2]));
        setTool("pencil");
      }
      return;
    }
    const next = new Uint8ClampedArray(pixels);
    if (tool === "fill") {
      fillAt(next, cell.x, cell.y);
      if (mirror) {
        const m = mirrorPoint(cell.x, cell.y);
        if (m) fillAt(next, m[0], m[1]);
      }
      commit(next, pixels);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = pixels;
    paintAt(next, cell.x, cell.y);
    change(next);
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const cell = cellOf(e);
    setHover(cell);
    if (!drawing.current || !cell) return;
    const next = new Uint8ClampedArray(live.current);
    paintAt(next, cell.x, cell.y);
    change(next);
  };

  const onUp = () => {
    if (drawing.current) {
      commit(live.current, drawing.current);
      drawing.current = null;
    }
  };

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(pixels);
    onChange(prev);
  }, [pixels, onChange]);

  const doRedo = useCallback(() => {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(pixels);
    onChange(next);
  }, [pixels, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (e.key === "b") setTool("pencil");
      else if (e.key === "e") setTool("eraser");
      else if (e.key === "g") setTool("fill");
      else if (e.key === "i") setTool("picker");
      else if (e.key === "m") setMirror((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  // ---------------------------------------------------------------- preview + files
  const sheet = useMemo(() => buildSheet(pixelsToCanvas(pixels)), [pixels]);

  const used = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 0) set.add(hex(pixels[i], pixels[i + 1], pixels[i + 2]));
    return [...set].slice(0, 24);
  }, [pixels]);

  const exportGif = () => {
    const scale = 8;
    const { start, count, ms } = sheet.index[gifAnim];
    const w = FRAME_W * scale;
    const h = FRAME_H * scale;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    const frames: Uint8ClampedArray[] = [];
    for (let k = 0; k < count; k++) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(sheet.canvas, (start + k) * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, w, h);
      frames.push(ctx.getImageData(0, 0, w, h).data);
    }
    const gif = encodeGif(frames, w, h, ANIM_FRAMES[gifAnim].frames.length > 1 ? ms : 500);
    download(`skin-${gifAnim}.gif`, new Blob([gif], { type: "image/gif" }));
  };

  const exportPng = () => pixelsToCanvas(pixels).toBlob((b) => b && download("skin-texture.png", b), "image/png");

  const importPng = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      commit(await loadTextureFromUrl(url), pixels);
      setMsg(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not read the file");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const startFrom = (id: string | null) => {
    commit(id ? builtinTexture(id) : new Uint8ClampedArray(TEX_W * TEX_H * 4), pixels);
  };

  const btn = (active: boolean) =>
    `px-3 py-1.5 border-2 text-lg ${active ? "border-yellow text-black bg-yellow" : "border-neon text-yellow hover:text-glow-sm"}`;
  const hoverPart = hover ? partAt(hover.x, hover.y) : null;

  return (
    <div className="flex flex-col gap-4 font-pixel">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neon">START FROM:</span>
        {Object.keys(BUILTIN_SKINS).map((id) => (
          <button key={id} type="button" onClick={() => startFrom(id)} className="border border-neon/60 px-2 py-1 text-yellow hover:text-white">
            {id.replace("_", " ")}
          </button>
        ))}
        <button type="button" onClick={() => startFrom(null)} className="border border-pink/60 px-2 py-1 text-pink hover:text-white">
          blank
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <canvas
            ref={gridRef}
            width={TEX_W * ZOOM}
            height={TEX_H * ZOOM}
            className="w-full h-auto border-2 border-neon touch-none cursor-crosshair"
            style={{ imageRendering: "pixelated" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
          />
          <p className="font-sans text-sm text-gray-300 min-h-5">
            {hoverPart ? (
              <>
                <span style={{ color: PART_COLORS[hoverPart] }}>{PART_NAMES[hoverPart]}</span> · {hover!.x - PARTS[hoverPart].x},{" "}
                {hover!.y - PARTS[hoverPart].y}
              </>
            ) : (
              "Paint inside the outlined parts. Dark cells are not used. Checkerboard = transparent."
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {(["pencil", "eraser", "fill", "picker"] as Tool[]).map((t) => (
              <button key={t} type="button" onClick={() => setTool(t)} className={btn(tool === t)}>
                {t === "pencil" ? "Pencil (B)" : t === "eraser" ? "Eraser (E)" : t === "fill" ? "Fill (G)" : "Picker (I)"}
              </button>
            ))}
            <button type="button" onClick={() => setMirror((v) => !v)} className={btn(mirror)} title="Paint the other arm / leg, or the other half of a part, at the same time">
              Mirror (M)
            </button>
            <button type="button" onClick={doUndo} className={btn(false)}>
              Undo
            </button>
            <button type="button" onClick={doRedo} className={btn(false)}>
              Redo
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 bg-transparent border border-neon" />
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  setColor(c);
                  if (tool === "eraser" || tool === "picker") setTool("pencil");
                }}
                className={`w-7 h-7 border-2 ${color === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          {used.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
              <span>IN THIS SKIN:</span>
              {used.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className="w-5 h-5 border border-white/30" style={{ background: c }} />
              ))}
            </div>
          )}
        </div>

        <div className="xl:w-[380px] flex flex-col gap-3">
          <span className="text-neon">LIVE PREVIEW</span>
          <div className="grid grid-cols-4 gap-2">
            {ANIMS.map((a) => (
              <div key={a} className="flex flex-col items-center gap-1 border border-neon/30 bg-[#060b1e] p-1">
                <AnimatedSkin sheet={sheet} anim={a} className="w-full aspect-[18/32]" />
                <span className="text-[10px] text-gray-300 text-center leading-tight">{ANIM_LABEL[a]}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              value={gifAnim}
              onChange={(e) => setGifAnim(e.target.value as AnimId)}
              className="bg-[#02050f] border border-neon text-white px-2 py-1 font-sans"
            >
              {ANIMS.map((a) => (
                <option key={a} value={a}>
                  {ANIM_LABEL[a]}
                </option>
              ))}
            </select>
            <button type="button" onClick={exportGif} className="border border-neon px-2 py-1 text-yellow hover:text-white">
              Download GIF
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={exportPng} className="border border-neon px-2 py-1 text-yellow hover:text-white">
              Download texture PNG
            </button>
            <label className="border border-neon px-2 py-1 text-yellow hover:text-white cursor-pointer">
              Upload texture PNG
              <input
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importPng(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="font-sans text-xs text-gray-400">
            Texture: {TEX_W} x {TEX_H} PNG. Draw it in any pixel editor using the downloaded PNG as a template, then upload it here.
          </p>
          {msg && <p className="font-sans text-sm text-pink">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
