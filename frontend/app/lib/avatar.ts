// app/lib/avatar.ts — the player's avatar (a small data URL) is kept next to the login, in its own key
import { useSyncExternalStore } from "react";

const KEY = "pixelcode.avatar";
const EVENT = "pixelcode:avatar-change";

export function getAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveAvatar(dataUrl: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (dataUrl) localStorage.setItem(KEY, dataUrl);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked - the avatar just will not be cached */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useAvatar() {
  return useSyncExternalStore(subscribe, getAvatar, () => null);
}
