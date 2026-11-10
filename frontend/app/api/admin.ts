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
};

export const listChallenges = () => api<AdminChallenge[]>("/admin/challenges");
export const createChallenge = (f: ChallengeForm) =>
  api<AdminChallenge>("/admin/challenges", { method: "POST", body: JSON.stringify(f) });
export const withdrawChallenge = (id: number) =>
  api<AdminChallenge>(`/admin/challenges/${id}/withdraw`, { method: "POST" });
export const publishChallenge = (id: number) =>
  api<AdminChallenge>(`/admin/challenges/${id}/publish`, { method: "POST" });

export type AdminCosmetic = { id: string; name: string; price: number; published: boolean };
export const listCosmetics = () => api<AdminCosmetic[]>("/admin/cosmetics");
export const createCosmetic = (name: string, price: number, image: string) =>
  api<AdminCosmetic>("/admin/cosmetics", { method: "POST", body: JSON.stringify({ name, price, image }) });
export const toggleCosmetic = (id: string, publish: boolean) =>
  api<AdminCosmetic>(`/admin/cosmetics/${id.replace("c_", "")}/${publish ? "publish" : "withdraw"}`, { method: "POST" });

export type AdminUser = { id: number; username: string; rating: number; pixels: number };
export const searchUsers = (q: string) => api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}`);
export const changeBalance = (id: number, mode: "set" | "add", amount: number) =>
  api<AdminUser>(`/admin/users/${id}/balance`, { method: "POST", body: JSON.stringify({ mode, amount }) });
