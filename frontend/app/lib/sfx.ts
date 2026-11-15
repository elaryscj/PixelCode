// app/lib/sfx.ts — retro sound effects synthesised with Web Audio (no files to download).
// Every sound is a few square/triangle oscillators or a burst of noise, like an 8-bit console.
// The volume is a separate setting from the music ("sfxVolume", 0..1).

const KEY = "sfxVolume";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function getSfxVolume(): number {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? 0.6 : Math.min(1, Math.max(0, Number(v)));
  } catch {
    return 0.6;
  }
}

export function setSfxVolume(v: number) {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* keep it for this session only */
  }
  if (master) master.gain.value = v * 0.5;
}

function audio(): { ac: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = getSfxVolume() * 0.5;
    master.connect(ctx.destination);
  }
  // browsers start audio suspended until the first tap / key press
  if (ctx.state === "suspended") void ctx.resume();
  return { ac: ctx, out: master! };
}

function tone(
  freq: number,
  dur: number,
  { type = "square", at = 0, to, vol = 0.6 }: { type?: OscillatorType; at?: number; to?: number; vol?: number } = {},
) {
  const a = audio();
  if (!a || getSfxVolume() === 0) return;
  const t = a.ac.currentTime + at;
  const osc = a.ac.createOscillator();
  const g = a.ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, { at = 0, vol = 0.5, lowpass = 1800 } = {}) {
  const a = audio();
  if (!a || getSfxVolume() === 0) return;
  if (!noiseBuf) {
    noiseBuf = a.ac.createBuffer(1, a.ac.sampleRate * 0.5, a.ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.ac.currentTime + at;
  const src = a.ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = lowpass;
  const g = a.ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  /** Call from any user gesture so later sounds are allowed to play. */
  unlock() {
    audio();
  },
  jump() {
    tone(260, 0.12, { to: 620, vol: 0.25 });
  },
  hazard() {
    noise(0.35, { vol: 0.7, lowpass: 900 });
    tone(180, 0.35, { type: "sawtooth", to: 50, vol: 0.35 });
  },
  doorOpen() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { at: i * 0.07, vol: 0.3 }));
    tone(1568, 0.3, { at: 0.28, type: "triangle", vol: 0.25 });
  },
  rivalDoor() {
    tone(330, 0.12, { vol: 0.25 });
    tone(247, 0.22, { at: 0.12, vol: 0.25 });
  },
  wrong() {
    tone(140, 0.18, { type: "sawtooth", vol: 0.3 });
    tone(110, 0.25, { at: 0.16, type: "sawtooth", vol: 0.3 });
  },
  tick() {
    tone(1200, 0.04, { vol: 0.15 });
  },
  fight() {
    tone(392, 0.1, { vol: 0.3 });
    tone(523, 0.1, { at: 0.1, vol: 0.3 });
    tone(784, 0.35, { at: 0.2, vol: 0.35 });
    noise(0.25, { at: 0.2, vol: 0.25, lowpass: 4000 });
  },
  victory() {
    const n = [523, 659, 784, 1047, 784, 1047];
    n.forEach((f, i) => tone(f, i === n.length - 1 ? 0.6 : 0.13, { at: i * 0.12, vol: 0.32 }));
    n.forEach((f, i) => tone(f / 2, 0.13, { at: i * 0.12, type: "triangle", vol: 0.25 }));
  },
  defeat() {
    [392, 370, 349, 262].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.22, { at: i * 0.22, type: "triangle", vol: 0.35 }));
  },
};
