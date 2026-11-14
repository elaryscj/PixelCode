// app/api/auth.ts
// Client for AuthController (/api/auth/register, /api/auth/login)
import { saveNickname } from "~/lib/nickname";
import { saveAvatar } from "~/lib/avatar";

export type AuthResponse = {
  id: number;
  username: string;
  rating: number;
  message: string;
  token: string;
  wins: number;
  losses: number;
  admin: boolean;
  pixels?: number;
  activeSkin?: string;
  avatarUrl?: string | null;
};

/** The avatar is large, so it lives in its own storage key and not inside the login record. */
function persistUser(data: AuthResponse) {
  const { avatarUrl, ...rest } = data;
  localStorage.setItem("pixelcode.user", JSON.stringify(rest));
  saveAvatar(avatarUrl ?? null);
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
const BASE_URL = `${API_ORIGIN}/api/auth`;

async function authRequest(path: string, body: { username: string; password: string; email?: string }): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.message ?? data?.error ?? `Authentication failed (${res.status})`;
    throw new AuthError(res.status, errorMsg);
  }

  // Save profile and notify entire app via nickname store
  if (typeof window !== "undefined" && data?.username) {
    persistUser(data);
    saveNickname(data.username);
  }

  return data as AuthResponse;
}

export function registerUser(username: string, password: string, email: string): Promise<AuthResponse> {
  return authRequest("/register", { username, password, email });
}

export function loginUser(username: string, password: string): Promise<AuthResponse> {
  return authRequest("/login", { username, password });
}

export function getCurrentUser(): AuthResponse | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("pixelcode.user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthResponse;
  } catch {
    return null;
  }
}

/** Swap the stored login token (after a password change the old one no longer works). */
export function updateStoredToken(token: string): void {
  const u = getCurrentUser();
  if (!u) return;
  localStorage.setItem("pixelcode.user", JSON.stringify({ ...u, token }));
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("pixelcode.user");
  localStorage.removeItem("pixelcode.nickname");
  saveAvatar(null);
  window.dispatchEvent(new Event("pixelcode:nickname-change"));
}

/** Re-reads rating / wins / losses from the server and updates the stored profile. */
export async function refreshUser(): Promise<AuthResponse | null> {
  if (typeof window === "undefined") return null;
  const token = getCurrentUser()?.token;
  if (!token) return null;
  try {
    const res = await fetch(`${BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (res.status === 401) {
      logoutUser();
      return null;
    }
    if (!res.ok) return getCurrentUser();
    const data = (await res.json()) as AuthResponse;
    persistUser(data);
    window.dispatchEvent(new Event("pixelcode:nickname-change"));
    return data;
  } catch {
    return getCurrentUser();
  }
}


async function plainPost(path: string, body: object): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new AuthError(res.status, data?.message ?? data?.error ?? `Request failed (${res.status})`);
  }
}

/** Always succeeds for a well-formed address - the server never reveals whether the account exists. */
export const requestPasswordReset = (email: string) => plainPost("/forgot", { email });
export const resetPassword = (token: string, password: string) => plainPost("/reset", { token, password });
