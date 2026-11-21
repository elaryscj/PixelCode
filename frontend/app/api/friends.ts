// app/api/friends.ts — friends, friend requests and duel invitations (FriendController)
import { api } from "./http";
import type { Room } from "./room";

export type FriendStatus = "ONLINE" | "IN_MATCH" | "OFFLINE";
export type FriendEntry = {
  /** id of the friendship / request row (accept, decline, remove) */
  requestId: number;
  userId: number;
  username: string;
  rating: number;
  activeSkin?: string;
  status?: FriendStatus;
  /** code of the match this friend is playing right now (WATCH) */
  watchCode?: string | null;
};
export type FriendList = { friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] };
export type DuelInvite = { fromUserId: number; fromName: string; code: string; expiresAt: number };

const enc = encodeURIComponent;

export const getFriends = () => api<FriendList>("/friends");
export const sendFriendRequest = (username: string) =>
  api<{ accepted: boolean; username: string }>("/friends/requests", { method: "POST", body: JSON.stringify({ username }) });
export const acceptFriend = (requestId: number) => api<null>(`/friends/requests/${requestId}/accept`, { method: "POST" });
/** decline a request, cancel your own, or remove a friend */
export const removeFriend = (requestId: number) => api<null>(`/friends/requests/${requestId}`, { method: "DELETE" });
export const challengeFriend = (userId: number) => api<Room>(`/friends/${userId}/challenge`, { method: "POST" });
/** channel: this player's private WebSocket topic (/topic/inbox/{channel}) */
export const getInvites = () => api<{ invites: DuelInvite[]; requests: number; channel?: string }>("/friends/invites");
export const dismissInvite = (code: string) => api<null>(`/friends/invites/${enc(code)}/dismiss`, { method: "POST" });

/** daily login streak reward (once per UTC day, the server ignores repeats) */
export const claimDailyLogin = () =>
  api<{ claimed: boolean; streak: number; reward: number; nextReward: number; balance: number }>("/progress/daily-login", {
    method: "POST",
  });
