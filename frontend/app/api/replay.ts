// app/api/replay.ts — a recorded match (ReplayController); only its two players can load it
import { api } from "./http";

export type ReplayAttempt = { t: number; passed: boolean; passedCount: number; total: number; code: string };
export type ReplayEvent = { t: number; userId: number; type: "OPEN" | "UNLOCK" | "EMOTE" | "PHRASE"; cp?: number; detail?: string };
export type ReplayPlayer = {
  userId: number;
  nickname: string;
  skin?: string;
  /** flat [t, x*10, y*10, t, x*10, y*10, ...], t = ms since the start */
  track: number[];
};
export type ReplayDoor = {
  cp: number;
  title: string;
  difficulty: string;
  description: string;
  /** userId -> that player's submissions on this door (oldest first) */
  attempts: Record<string, ReplayAttempt[]>;
};
export type Replay = {
  code: string;
  mapId: number;
  startedAt: number;
  result: { winnerUserId: number | null; reason: string; durationSeconds: number; ranked?: boolean; botMatch?: boolean } | null;
  players: ReplayPlayer[];
  doors: ReplayDoor[];
  events: ReplayEvent[];
};

export const getReplay = (code: string) => api<Replay>(`/replays/${encodeURIComponent(code)}`);

/** Position at time t (ms) by linear interpolation of the recorded track. */
export function positionAt(track: number[], t: number): { x: number; y: number } {
  const n = track.length / 3;
  if (n === 0) return { x: 0, y: 0 };
  if (t <= track[0]) return { x: track[1] / 10, y: track[2] / 10 };
  let lo = 0;
  let hi = n - 1;
  if (t >= track[hi * 3]) return { x: track[hi * 3 + 1] / 10, y: track[hi * 3 + 2] / 10 };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid * 3] <= t) lo = mid;
    else hi = mid;
  }
  const t0 = track[lo * 3];
  const t1 = track[hi * 3];
  const k = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  // a jump of more than 15 units between samples is a respawn: no sliding across the map
  const x0 = track[lo * 3 + 1] / 10;
  const y0 = track[lo * 3 + 2] / 10;
  const x1 = track[hi * 3 + 1] / 10;
  const y1 = track[hi * 3 + 2] / 10;
  if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 15) return k < 1 ? { x: x0, y: y0 } : { x: x1, y: y1 };
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k };
}
