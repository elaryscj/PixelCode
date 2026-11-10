// app/api/leaderboard.ts
import { api } from "./http";

export type LeaderboardEntry = { place: number; username: string; rating: number };
export type MyRank = { place: number; username: string; rating: number; wins: number; losses: number };

export const getLeaderboard = () => api<LeaderboardEntry[]>("/leaderboard");
export const getMyRank = () => api<MyRank>("/leaderboard/me");
