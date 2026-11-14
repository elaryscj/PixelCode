// app/api/http.ts — one fetch helper for the whole app (adds the login token)
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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && typeof window !== "undefined") {
    // the session ended (password changed elsewhere, account deleted, token expired): sign out here too
    localStorage.removeItem("pixelcode.user");
    localStorage.removeItem("pixelcode.nickname");
    window.dispatchEvent(new Event("pixelcode:nickname-change"));
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`, data ?? {});
  }
  return data as T;
}
