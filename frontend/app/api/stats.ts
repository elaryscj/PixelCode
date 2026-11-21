// app/api/stats.ts — door statistics (admin), best solutions, practice challenges, weekend tournament, blocks, spectating
import { api } from "./http";
import type { DoorChallenge, SubmitResult } from "./game";

const enc = encodeURIComponent;

// ---------------------------------------------------------------- admin STATS
export type ChallengeStat = {
  challengeId: number;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  published: boolean;
  met: number;
  solved: number;
  timeout: number;
  unsolved: number;
  solveRate: number;
  avgAttempts: number;
  avgSolveSeconds: number | null;
  hint: "FEW_DATA" | "TOO_HARD" | "TOO_EASY" | "OK";
};
export type AdminStats = {
  days: number;
  challenges: ChallengeStat[];
  matches: {
    total: number;
    ranked: number;
    bot: number;
    friendly: number;
    players: number;
    avgDurationSeconds: number | null;
    reasons: Record<string, number>;
  };
};
export const getAdminStats = (days: number) => api<AdminStats>(`/admin/stats?days=${days}`);

// ---------------------------------------------------------------- best solutions
export type DoorOutcome = "SOLVED" | "TIMEOUT" | "UNSOLVED";
export type MatchDoor = { challengeId: number; title: string; difficulty: string; outcome: DoorOutcome };
export type SolutionRow = {
  userId?: number;
  nickname?: string;
  outcome: DoorOutcome;
  seconds: number;
  attempts: number;
  chars: number | null;
  source: string | null;
  at: string;
};
export type BestSolutions = {
  challengeId: number;
  title: string;
  difficulty: string;
  description: string;
  inputDescription?: string;
  outputDescription?: string;
  shortest: SolutionRow[];
  fastest: SolutionRow[];
  mine: SolutionRow | null;
};
export const getMatchDoors = (code: string) => api<MatchDoor[]>(`/solutions/match/${enc(code)}`);
export const getBestSolutions = (challengeId: number) => api<BestSolutions>(`/solutions/${challengeId}`);

// ---------------------------------------------------------------- practice with challenges
export type PracticeChallenge = DoorChallenge & { challengeId: number };
export const getPracticeChallenge = (difficulty: string, cp: number, exclude: number[]) =>
  api<PracticeChallenge>(`/practice/challenge?difficulty=${enc(difficulty)}&cp=${cp}&exclude=${exclude.join(",")}`);
export const checkPractice = (challengeId: number, source: string) =>
  api<SubmitResult>(`/practice/challenge/${challengeId}/check`, { method: "POST", body: JSON.stringify({ code: source }) });

// ---------------------------------------------------------------- weekend tournament
export type TournamentRow = {
  place: number;
  userId: number;
  nickname?: string;
  points: number;
  wins: number;
  played: number;
  prize: number;
};
export type Tournament = {
  active: boolean;
  weekend: string;
  startsAt: number;
  endsAt: number;
  serverTime: number;
  prizes: number[];
  minMatches: number;
  points: { win: number; draw: number; botWin: number };
  players: number;
  top: TournamentRow[];
  me: TournamentRow | null;
  last: { weekend: string; winners: TournamentRow[] };
};
export const getTournament = () => api<Tournament>("/tournament");

// ---------------------------------------------------------------- blocking
export type BlockedPlayer = { userId: number; username: string; since: string };
export const getBlocked = () => api<BlockedPlayer[]>("/blocks");
export const blockPlayer = (userId: number) => api<{ blocked: boolean; username: string }>(`/blocks/${userId}`, { method: "POST" });
export const unblockPlayer = (userId: number) => api<null>(`/blocks/${userId}`, { method: "DELETE" });

// ---------------------------------------------------------------- spectating
export type WatchSlot = {
  userId: number;
  nickname: string;
  rating: number;
  skin: string;
  unlocked: number[];
  connected: boolean;
  x: number;
  y: number;
  doors: Record<string, number>;
};
export type WatchState = {
  status: "PLAYING" | "FINISHED" | "NOT_STARTED";
  serverTime?: number;
  elapsedSeconds?: number;
  maxSeconds?: number;
  doorSeconds?: number;
  mapId?: number;
  ranked?: boolean;
  botMatch?: boolean;
  players?: WatchSlot[];
  doorTitles?: string[];
  spectators?: number;
  result: { winnerUserId?: number | null; reason?: string; players?: { userId: number; nickname: string; result: string }[] } | null;
};
export const watchMatch = (code: string) => api<WatchState>(`/games/${enc(code)}/watch`);
