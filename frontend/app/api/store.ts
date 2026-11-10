// app/api/store.ts — skins store (prices and balance live on the server)
import { api } from "./http";

export type StoreState = {
  balance: number;
  owned: string[];
  active: string;
  prices: Record<string, number>;
  /** skins published by administrators */
  catalog?: { id: string; name: string }[];
};

export const getStore = () => api<StoreState>("/store");
export const buySkin = (id: string) => api<StoreState>(`/store/buy/${encodeURIComponent(id)}`, { method: "POST" });
export const equipSkin = (id: string) => api<StoreState>(`/store/equip/${encodeURIComponent(id)}`, { method: "POST" });
