import { api } from "~/api/http";

export type AdminChallenge = {
  id: number;
  title: string;
  description: string;
  functionName: string;
  difficulty: string;
  published: boolean;
};

export type ChallengeForm = {
  title: string;
  description: string;
  inputDescription: string;
  outputDescription: string;
  functionName: string;
  starterCode: string;
  examples: string;
  testsJson: string;
  referenceSolution: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

export const listChallenges = () => api<AdminChallenge[]>("/admin/challenges");
export const createChallenge = (f: ChallengeForm) =>
  api<AdminChallenge>("/admin/challenges", { method: "POST", body: JSON.stringify(f) });
export const withdrawChallenge = (id: number) =>
  api<AdminChallenge>(`/admin/challenges/${id}/withdraw`, { method: "POST" });
export const publishChallenge = (id: number) =>
  api<AdminChallenge>(`/admin/challenges/${id}/publish`, { method: "POST" });

/** animated = made in the skin editor (a texture); otherwise an older single picture */
export type AdminCosmetic = {
  id: string;
  name: string;
  price: number;
  published: boolean;
  animated?: boolean;
  /** exclusive prize for the season top 3 (never sold) */
  seasonReward?: boolean;
  awardedSeason?: number | null;
};
export const listCosmetics = () => api<AdminCosmetic[]>("/admin/cosmetics");
/** texture: PNG data URL of the skin texture (see game/skinRig.ts) */
export const createCosmetic = (name: string, price: number, texture: string, seasonReward = false) =>
  api<AdminCosmetic>("/admin/cosmetics", { method: "POST", body: JSON.stringify({ name, price, texture, seasonReward }) });
export const updateCosmetic = (id: string, name: string, price: number, texture: string, seasonReward = false) =>
  api<AdminCosmetic>(`/admin/cosmetics/${id.replace("c_", "")}`, {
    method: "PUT",
    body: JSON.stringify({ name, price, texture, seasonReward }),
  });
export const getCosmeticTexture = (id: string) =>
  api<AdminCosmetic & { texture: string | null }>(`/admin/cosmetics/${id.replace("c_", "")}/texture`);
export const toggleCosmetic = (id: string, publish: boolean) =>
  api<AdminCosmetic>(`/admin/cosmetics/${id.replace("c_", "")}/${publish ? "publish" : "withdraw"}`, { method: "POST" });

export type AdminUser = { id: number; username: string; rating: number; pixels: number; teacher?: boolean };
/** Teacher mode: the player may create lessons (/teacher). */
export const setTeacher = (id: number, teacher: boolean) =>
  api<AdminUser>(`/admin/users/${id}/teacher`, { method: "POST", body: JSON.stringify({ teacher }) });
export const searchUsers = (q: string) => api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}`);
export const changeBalance = (id: number, mode: "set" | "add", amount: number) =>
  api<AdminUser>(`/admin/users/${id}/balance`, { method: "POST", body: JSON.stringify({ mode, amount }) });
