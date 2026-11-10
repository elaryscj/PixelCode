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
export const openDoor = (code: string, cp: number) =>
  api<DoorChallenge>(`/games/${enc(code)}/doors/${cp}/open`, { method: "POST" });
export const submitDoor = (code: string, cp: number, source: string) =>
  api<SubmitResult>(`/games/${enc(code)}/doors/${cp}/submit`, { method: "POST", body: JSON.stringify({ code: source }) });
export const finishMatch = (code: string) =>
  api<{ status: string; result: MatchResult }>(`/games/${enc(code)}/finish`, { method: "POST" });
