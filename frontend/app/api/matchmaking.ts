// app/api/matchmaking.ts — ranked queue
import { api } from "./http";

export type QueueStatus = {
  state: "IDLE" | "SEARCHING" | "MATCHED";
  roomCode?: string;
  waitedSeconds?: number;
  playersInQueue: number;
};

export const joinQueue = () => api<QueueStatus>("/matchmaking/join", { method: "POST" });
export const queueStatus = () => api<QueueStatus>("/matchmaking/status");
export const cancelQueue = () => api<QueueStatus>("/matchmaking/cancel", { method: "POST" });
