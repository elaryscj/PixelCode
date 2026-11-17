// app/components/skins.tsx — skins shared by the store, the game, practice, results and the admin page.
// Every skin is a pixel texture (see game/skinRig.ts) animated in place: idle, walk, jump, fall, think, win, lose.
// Built-in skins live in game/builtinSkins.ts; skins made by an administrator come from the server.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactElement } from "react";
import { API_BASE } from "~/api/http";
import { BUILTIN_SKINS, pixelSkinToCanvas } from "~/game/builtinSkins";
import { FRAME_H, FRAME_W, TEX_H, TEX_W, buildSheet, type AnimId, type Sheet } from "~/game/skinRig";

export type SkinId = "neon_ronin" | "crimson_cipher" | "byte_knight" | "pumpkin_phantom";
export type SkinSize = "large" | "small";
export type { AnimId };

const DEFAULT_SKIN = "neon_ronin";

export const textureUrl = (id: string) => `${API_BASE}/cosmetics/${encodeURIComponent(id)}/texture`;
export const legacyImageUrl = (id: string) => `${API_BASE}/cosmetics/${encodeURIComponent(id)}/image`;

/** null = an older admin skin that is only a picture (shown as it is, not animated) */
const sheets = new Map<string, Promise<Sheet | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function loadSheet(id: string | null | undefined): Promise<Sheet | null> {
  const key = id && (id in BUILTIN_SKINS || id.startsWith("c_")) ? id : DEFAULT_SKIN;
  let p = sheets.get(key);
  if (!p) {
    p = key.startsWith("c_")
      ? loadImage(textureUrl(key)).then((img) =>
          img && img.naturalWidth === TEX_W && img.naturalHeight === TEX_H ? buildSheet(img) : null,
        )
      : Promise.resolve(buildSheet(pixelSkinToCanvas(BUILTIN_SKINS[key])));
    sheets.set(key, p);
  }
  return p;
}

/** after an admin changes a skin: draw it again from the new texture */
export function forgetSkin(id: string) {
  sheets.delete(id);
}

export type SkinHandle = { setAnim: (anim: AnimId) => void };

type AnimatedProps = {
  id?: string | null;
  /** animation to play; the game changes it every frame through the ref instead (no re-render) */
  anim?: AnimId;
  /** draw from this sheet instead of loading `id` (the editor's live preview) */
  sheet?: Sheet | null;
  className?: string;
  title?: string;
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** One skin, animated in a FRAME_W x FRAME_H canvas scaled up without blurring. */
export const AnimatedSkin = forwardRef<SkinHandle, AnimatedProps>(function AnimatedSkin(
  { id, anim = "idle", sheet: given, className, title },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sheet, setSheet] = useState<Sheet | null | undefined>(given ?? undefined);
  const state = useRef({ anim, since: 0, drawn: "" });

  useImperativeHandle(ref, () => ({
    setAnim(a: AnimId) {
      if (state.current.anim !== a) {
        state.current.anim = a;
        state.current.since = performance.now();
      }
    },
  }));

  useEffect(() => {
    if (state.current.anim !== anim) {
      state.current.anim = anim;
      state.current.since = performance.now();
    }
  }, [anim]);

  useEffect(() => {
    if (given !== undefined) {
      setSheet(given);
      state.current.drawn = "";
      return;
    }
    let alive = true;
    setSheet(undefined);
    loadSheet(id).then((s) => alive && setSheet(s));
    return () => {
      alive = false;
    };
  }, [id, given]);

  useEffect(() => {
    if (!sheet) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    state.current.drawn = "";
    const still = reducedMotion();
    let raf = 0;
    const tick = () => {
      const { anim: a, since } = state.current;
      const info = sheet.index[a];
      const k = still ? 0 : Math.floor((performance.now() - since) / info.ms) % info.count;
      const key = `${a}:${k}`;
      if (key !== state.current.drawn) {
        state.current.drawn = key;
        ctx.clearRect(0, 0, FRAME_W, FRAME_H);
        ctx.drawImage(sheet.canvas, (info.start + k) * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sheet]);

  if (sheet === null && id) {
    // an older admin skin made from a single picture
    return (
      <img
        src={legacyImageUrl(id)}
        alt=""
        title={title}
        draggable={false}
        className={className}
        style={{ imageRendering: "pixelated", objectFit: "contain", objectPosition: "center bottom" }}
      />
    );
  }
  return (
    <canvas
      ref={canvasRef}
      width={FRAME_W}
      height={FRAME_H}
      title={title}
      className={className}
      style={{ imageRendering: "pixelated", objectFit: "contain", objectPosition: "center bottom" }}
    />
  );
});

/** Draws a skin by id (idle unless told otherwise). `size` is kept for older callers; the art is the same. */
export function SkinArt({
  id,
  anim = "idle",
  className,
}: {
  id?: string | null;
  size?: SkinSize;
  anim?: AnimId;
  className?: string;
}): ReactElement {
  return <AnimatedSkin id={id} anim={anim} className={className} />;
}
