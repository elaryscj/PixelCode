// app/api/game.ts — running match (server decides everything that matters)
import { api } from "./http";

export type MatchPlayerResult = {
  userId: number;
  nickname: string;
  result: "WIN" | "LOSS" | "DRAW" | "VOID" | null;
  oldRating: number;
  delta: number;
  newRating: number;
};

export type MatchResult = {
  code: string;
  /** ranked queue match; private rooms change no rating */
  ranked?: boolean;
  /** map the match was played on (null for matches from before map voting) */
  mapId?: number | null;
  reason: string;
  technical: boolean;
  winnerUserId: number | null;
  winnerNickname: string | null;
  durationSeconds: number;
  players: MatchPlayerResult[];
};

export type SlotView = {
  userId: number;
  nickname: string;
  rating: number;
  unlocked: number[];
  connected: boolean;
  skin?: string;
  x: number;
  y: number;
  doors?: Record<string, number>;
};

export type GameState = {
  status: "PLAYING" | "FINISHED";
  serverTime?: number;
  elapsedSeconds?: number;
  maxSeconds?: number;
  doorSeconds?: number;
  me?: SlotView;
  opponent?: SlotView | null;
  doorTitles?: string[];
  mapId?: number;
  result: MatchResult | null;
};

export type DoorChallenge = {
  cpNum: number;
  title: string;
  difficulty: "EASY";
  description: string;
  inputDescription: string;
  outputDescription: string;
  functionName: string;
  initialCode: string;
  examples: string[];
  secondsRemaining: number;
};

export type SubmitResult = {
  passed: boolean;
  passedCount: number;
  total: number;
  errorMessage: string | null;
  details: { index: number; passed: boolean; visible: boolean; input?: string; expected?: string; actual?: string }[];
  unlocked: boolean;
  matchOver: boolean;
  secondsRemaining: number;
};

const enc = encodeURIComponent;

export const getGameState = (code: string) => api<GameState>(`/games/${enc(code)}`);
/** `x`/`y`: where the player stands; the server checks they are really at the door. */
export const openDoor = (code: string, cp: number, x: number, y: number) =>
  api<DoorChallenge>(`/games/${enc(code)}/doors/${cp}/open`, { method: "POST", body: JSON.stringify({ x, y }) });
export const submitDoor = (code: string, cp: number, source: string) =>
  api<SubmitResult>(`/games/${enc(code)}/doors/${cp}/submit`, { method: "POST", body: JSON.stringify({ code: source }) });
/** `x`/`y`: where the player stands; the server checks they are really at the exit. */
export const finishMatch = (code: string, x: number, y: number) =>
  api<{ status: string; result: MatchResult }>(`/games/${enc(code)}/finish`, { method: "POST", body: JSON.stringify({ x, y }) });

/** One finished match in "See my results" (newest first). */
export type MatchHistoryEntry = MatchResult & {
  ranked: boolean;
  mapId: number | null;
  finishedAt: number | null;
};

export const getMatchHistory = (limit = 20) => api<MatchHistoryEntry[]>(`/games/history?limit=${limit}`);
