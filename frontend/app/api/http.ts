// app/api/http.ts — one fetch helper for the whole app (adds the login token and the player's language)
import i18n from "i18next";
const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
export const API_BASE = `${API_ORIGIN}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, any> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pixelcode.user");
    return raw ? (JSON.parse(raw)?.token ?? null) : null;
  } catch {
    return null;
  }
}

const RETRY_DELAYS_MS = [600, 1500];

/**
 * Reads (GET) are retried when the server is briefly unreachable or answers 502/503/504 (a restart, a cold
 * start on the free hosting). Writes are never retried automatically: a purchase must not happen twice.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const idempotent = (init.method ?? "GET").toUpperCase() === "GET";
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (idempotent && [502, 503, 504].includes(res.status) && attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return res;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (idempotent && attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      // fetch() only throws on network problems: say so instead of "Failed to fetch"
      throw new ApiError(0, i18n.t("err_offline"), {});
    }
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    // the server answers errors and challenge texts in this language (see backend i18n/Lang.java)
    "Accept-Language": i18n.language || "en",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const res = await fetchWithRetry(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && typeof window !== "undefined") {
    // the session ended (password changed elsewhere, account deleted, token expired): sign out here too
    localStorage.removeItem("pixelcode.user");
    localStorage.removeItem("pixelcode.nickname");
    window.dispatchEvent(new Event("pixelcode:nickname-change"));
    window.dispatchEvent(new Event("pixelcode:user-change"));
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`, data ?? {});
  }
  return data as T;
}
