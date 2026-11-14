// app/lib/currentUser.ts — the logged-in player as a React hook.
// Server render and the first client render both see `null`, so hydration always matches;
// right after that the real value from localStorage is used, and it stays in sync across tabs.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createElement, Fragment } from "react";
import type { AuthResponse } from "~/api/auth";

const KEY = "pixelcode.user";
const EVENT = "pixelcode:user-change";

let lastRaw: string | null | undefined;
let lastUser: AuthResponse | null = null;

function snapshot(): AuthResponse | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    try {
      lastUser = raw ? (JSON.parse(raw) as AuthResponse) : null;
    } catch {
      lastUser = null;
    }
  }
  return lastUser;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Call after writing or removing the stored user so mounted components refresh. */
export function notifyUserChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useCurrentUser(): AuthResponse | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** true once the component has mounted in the browser. */
export function useHydrated(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}

/**
 * Renders its children only in the browser. Screens that read the login, timers or the
 * socket straight away (match, lobby, profile...) use it so the server never has to guess.
 */
export function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated();
  return createElement(Fragment, null, hydrated ? children() : fallback);
}
