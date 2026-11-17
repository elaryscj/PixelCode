// app/api/progress.ts — daily quests, achievements and seasons (ProgressController)
import { api } from "./http";

export type Quest = { code: string; progress: number; target: number; reward: number; completedAt: number | null };
export type Achievement = { code: string; reward: number; target: number; progress: number; unlockedAt: number | null };
export type SeasonBadge = { season: number; place: number; username: string; rating: number; reward: number; skinId?: string | null };
export type SeasonInfo = {
  number: number;
  startsAt: number;
  endsAt: number;
  minMatches: number;
  /** PIXELS for places 1..10 */
  rewards: number[];
  serverTime: number;
  /** exclusive skin the top `skinPlaces` get when this season ends (null if none) */
  rewardSkin: { id: string; name: string } | null;
  skinPlaces: number;
};

export type Progress = {
  quests: Quest[];
  questsResetAt: number;
  achievements: Achievement[];
  season: SeasonInfo & { myMatches: number; myPlace: number | null };
  badges: SeasonBadge[];
};

export type CurrentSeason = SeasonInfo & { lastSeason: number | null; lastTop: SeasonBadge[] };

export const getProgress = () => api<Progress>("/progress");
export const getCurrentSeason = () => api<CurrentSeason>("/seasons/current");
/** rewards not seen on the PROGRESS screen yet (menu badge) */
export const getUnseen = () => api<{ count: number }>("/progress/unseen");
export const markProgressSeen = () => api<null>("/progress/seen", { method: "POST" });

/** "3d 4h", "5h 12m", "9m": time left until `at` (server clock offset applied by the caller). */
export function timeLeft(ms: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return t("pg_left_dh", { d, h });
  if (h > 0) return t("pg_left_hm", { h, m });
  return t("pg_left_m", { m: Math.max(1, m) });
}
