// app/components/game/fx.ts — throwaway visual effects for the arena, done with the
// Web Animations API so they never trigger a React re-render during the 60 FPS loop.

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Square pixel particles flying out of a point. x / y are arena percentages
 * (x from the left, y from the bottom), the same units the physics uses.
 */
export function burst(
  arena: HTMLElement | null,
  x: number,
  y: number,
  { color = "#01E4FF", count = 18, spread = 70, size = 6, up = 0 }: { color?: string; count?: number; spread?: number; size?: number; up?: number } = {},
) {
  if (!arena || reduced()) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const s = size * (0.5 + Math.random());
    Object.assign(p.style, {
      position: "absolute",
      left: `${x}%`,
      bottom: `${y}%`,
      width: `${s}px`,
      height: `${s}px`,
      background: color,
      boxShadow: `0 0 6px ${color}`,
      zIndex: "25",
      pointerEvents: "none",
    });
    arena.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dist = spread * (0.4 + Math.random() * 0.8);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - up;
    p.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 30}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 450 + Math.random() * 350, easing: "cubic-bezier(.2,.7,.4,1)" },
    ).onfinish = () => p.remove();
  }
}

/**
 * Little symbols rising over a figure's head (emotes): a heart for a wave, notes for a dance.
 * x / y are arena percentages of the spot above the head.
 */
export function floatIcon(arena: HTMLElement | null, x: number, y: number, kind: "heart" | "notes") {
  if (!arena) return;
  const glyphs = kind === "heart" ? ["♥"] : ["♪", "♫", "♪"];
  const color = kind === "heart" ? "#fe2c96" : "#01e4ff";
  glyphs.forEach((g, i) => {
    const el = document.createElement("div");
    el.textContent = g;
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}%`,
      bottom: `${y}%`,
      transform: "translateX(-50%)",
      color,
      fontSize: kind === "heart" ? "22px" : "16px",
      lineHeight: "1",
      textShadow: `0 0 8px ${color}`,
      zIndex: "26",
      pointerEvents: "none",
      fontFamily: "monospace",
    });
    arena.appendChild(el);
    if (reduced()) {
      setTimeout(() => el.remove(), 900);
      return;
    }
    const side = kind === "notes" ? (i - 1) * 14 : 0;
    el.animate(
      [
        { transform: "translate(-50%, 0) scale(0.6)", opacity: 0 },
        { transform: `translate(calc(-50% + ${side * 0.4}px), -14px) scale(1.15)`, opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${side}px), -46px) scale(1)`, opacity: 0 },
      ],
      { duration: 1100, delay: i * 160, easing: "ease-out", fill: "backwards" },
    ).onfinish = () => el.remove();
  });
}

/** Short camera shake on any element. */
export function shake(el: HTMLElement | null, strength = 8) {
  if (!el || reduced()) return;
  const k = (n: number) => `translate(${(Math.random() - 0.5) * n}px, ${(Math.random() - 0.5) * n}px)`;
  el.animate(
    [{ transform: k(strength) }, { transform: k(strength) }, { transform: k(strength * 0.6) }, { transform: k(strength * 0.3) }, { transform: "none" }],
    { duration: 280, easing: "steps(5)" },
  );
}

/** Full-panel colour flash. */
export function flash(el: HTMLElement | null, color = "rgba(1,228,255,0.35)") {
  if (!el) return;
  const f = document.createElement("div");
  Object.assign(f.style, { position: "absolute", inset: "0", background: color, zIndex: "26", pointerEvents: "none" });
  el.appendChild(f);
  f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced() ? 1 : 420, easing: "ease-out" }).onfinish = () => f.remove();
}

/** Confetti over the whole screen (victory). */
export function confetti(count = 90) {
  if (typeof document === "undefined" || reduced()) return;
  const colors = ["#FDE047", "#FE2C96", "#01E4FF", "#ffffff"];
  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "70", pointerEvents: "none", overflow: "hidden" });
  document.body.appendChild(layer);
  let left = count;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const s = 6 + Math.random() * 8;
    Object.assign(p.style, {
      position: "absolute",
      left: `${Math.random() * 100}%`,
      top: "-20px",
      width: `${s}px`,
      height: `${s * (0.6 + Math.random())}px`,
      background: colors[i % colors.length],
    });
    layer.appendChild(p);
    const drift = (Math.random() - 0.5) * 240;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)" },
        { transform: `translate(${drift}px, ${window.innerHeight + 60}px) rotate(${720 * (Math.random() - 0.5)}deg)` },
      ],
      { duration: 1800 + Math.random() * 1600, delay: Math.random() * 600, easing: "cubic-bezier(.3,.1,.6,1)" },
    ).onfinish = () => {
      p.remove();
      if (--left === 0) layer.remove();
    };
  }
}

/**
 * Dust puffs at the feet: a small one when jumping, a bigger one when landing (`strength` 0..1 from the
 * fall speed). Puffs roll sideways along the floor and fade. x / y are arena percentages of the feet.
 */
export function dust(arena: HTMLElement | null, x: number, y: number, kind: "jump" | "land", strength = 0.5) {
  if (!arena || reduced()) return;
  const n = kind === "jump" ? 5 : 4 + Math.round(strength * 6);
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    const side = i % 2 === 0 ? -1 : 1;
    const s = (kind === "jump" ? 5 : 6 + strength * 6) * (0.6 + Math.random() * 0.7);
    Object.assign(p.style, {
      position: "absolute",
      left: `${x}%`,
      bottom: `${y}%`,
      width: `${s}px`,
      height: `${s}px`,
      marginLeft: `${-s / 2}px`,
      background: "rgba(214,222,240,0.75)",
      boxShadow: "0 0 4px rgba(214,222,240,0.5)",
      borderRadius: "2px",
      zIndex: "19",
      pointerEvents: "none",
    });
    arena.appendChild(p);
    const dx = side * (8 + Math.random() * (kind === "jump" ? 14 : 18 + strength * 22));
    const dy = -(2 + Math.random() * (kind === "jump" ? 6 : 8));
    p.animate(
      [
        { transform: "translate(0,0) scale(0.6)", opacity: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.25)`, opacity: 0 },
      ],
      { duration: 320 + Math.random() * 260, easing: "cubic-bezier(.15,.8,.35,1)" },
    ).onfinish = () => p.remove();
  }
}

/**
 * A door opening: steam bursting out at both sides of its foot and sparks falling from the frame.
 * x = the door's centre, y = its floor (arena percentages).
 */
export function doorOpenFx(arena: HTMLElement | null, x: number, y: number, tint = "#01E4FF") {
  if (!arena || reduced()) return;
  const add = (style: Partial<CSSStyleDeclaration>) => {
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", pointerEvents: "none", zIndex: "21", ...style });
    arena.appendChild(el);
    return el;
  };
  // steam: big soft puffs rolling sideways and up
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const s = 14 + Math.random() * 18;
    const el = add({
      left: `${x}%`,
      bottom: `${y + Math.random() * 3}%`,
      width: `${s}px`,
      height: `${s}px`,
      marginLeft: `${-s / 2}px`,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(235,242,255,0.75), rgba(235,242,255,0) 70%)",
    });
    const dx = side * (20 + Math.random() * 40);
    const dy = -(18 + Math.random() * 50);
    el.animate(
      [
        { transform: "translate(0,0) scale(0.5)", opacity: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.8)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 600, delay: Math.random() * 120, easing: "cubic-bezier(.1,.7,.3,1)", fill: "backwards" },
    ).onfinish = () => el.remove();
  }
  // sparks: short bright streaks falling from the top of the frame
  for (let i = 0; i < 14; i++) {
    const el = add({
      left: `${x + (Math.random() - 0.5) * 6}%`,
      bottom: `${y + 8 + Math.random() * 3}%`,
      width: "2px",
      height: `${4 + Math.random() * 5}px`,
      background: i % 3 === 0 ? tint : "#fde047",
      boxShadow: `0 0 6px ${i % 3 === 0 ? tint : "#fde047"}`,
    });
    const dx = (Math.random() - 0.5) * 70;
    const dy = 30 + Math.random() * 60;
    el.animate(
      [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ],
      { duration: 380 + Math.random() * 380, easing: "cubic-bezier(.4,0,1,1)" },
    ).onfinish = () => el.remove();
  }
}
