// app/lib/nickname.ts
import { useSyncExternalStore } from "react";

const KEY = "pixelcode.nickname";
const EVENT = "pixelcode:nickname-change";

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

// Read the saved nickname (browser only)
export function getNickname(): string | null {
  return localStorage.getItem(KEY);
}

// Save it and tell every component using useNickname() to re-render
export function saveNickname(name: string) {
  localStorage.setItem(KEY, name.trim());
  window.dispatchEvent(new Event(EVENT));
}

export function isValidNickname(name: string) {
  const n = name.trim();
  return n.length >= NICKNAME_MIN && n.length <= NICKNAME_MAX;
}

// How React listens for changes
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback); // changes in this tab
  window.addEventListener("storage", callback); // changes in other tabs
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Use this in components. Returns null on the server and when nothing is saved.
export function useNickname() {
  return useSyncExternalStore(subscribe, getNickname, () => null);
}