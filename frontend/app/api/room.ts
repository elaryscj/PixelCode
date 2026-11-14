// app/api/room.ts — rooms: create / join / ready / leave
import { api, ApiError } from "./http";
export { ApiError };

export type RoomStatus = "WAITING" | "READY" | "PLAYING" | "FINISHED";

export type Player = {
  id: number;
  userId: number;
  nickname: string;
  ready: boolean;
  rating: number | null;
  /** map this player voted for in the lobby (null = no preference) */
  mapVote?: number | null;
};

export type Room = {
  id: number;
  code: string;
  roomStatus: RoomStatus;
  status?: RoomStatus;
  /** created by the ranked queue: starts automatically */
  ranked?: boolean;
  players: Player[];
  /** server time (ms) when an unjoined player loses the match (5-minute window) */
  joinDeadline: number | null;
  /** map picked when the match started */
  mapId?: number | null;
  serverTime: number;
};

const enc = encodeURIComponent;

export const createRoom = () => api<Room>("/rooms", { method: "POST" });
export const getRoom = (code: string) => api<Room>(`/rooms/${enc(code)}`);
export const joinRoom = (code: string) => api<Room>(`/rooms/${enc(code)}/join`, { method: "POST" });
export const readyRoom = (code: string) => api<Room>(`/rooms/${enc(code)}/ready`, { method: "POST" });
export const voteMap = (code: string, mapId: number | null) =>
  api<Room>(`/rooms/${enc(code)}/vote`, { method: "POST", body: JSON.stringify({ mapId }) });
/** After a finished match: opens (or joins) a friendly rematch room with the same rival. */
export const rematchRoom = (finishedCode: string) => api<Room>(`/rooms/${enc(finishedCode)}/rematch`, { method: "POST" });
export const leaveRoom = (code: string) => api<null>(`/rooms/${enc(code)}/leave`, { method: "POST" });
export const myRoom = () => api<Room | null>("/rooms/mine");
