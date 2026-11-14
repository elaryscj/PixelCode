// app/lib/liveStats.ts — real numbers for the header lines (players online, ping), instead of hardcoded ones
import { useEffect, useState } from "react";
import { API_BASE } from "~/api/http";

export type LiveStats = { online: number; inQueue: number; activeMatches: number };

/** Players active in the last 5 minutes (refreshed every 30 s). null until the first answer. */
export function useLiveStats(): LiveStats | null {
  const [stats, setStats] = useState<LiveStats | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${API_BASE}/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => alive && s && setStats(s))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return stats;
}

/** Round trip to the backend in ms (measured every `everyMs`). null until measured or when offline. */
export function usePing(everyMs = 5000): number | null {
  const [ping, setPing] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const measure = async () => {
      const t0 = performance.now();
      try {
        const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        if (alive) setPing(r.ok ? Math.round(performance.now() - t0) : null);
      } catch {
        if (alive) setPing(null);
      }
    };
    void measure();
    const id = setInterval(measure, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [everyMs]);
  return ping;
}

export const onlineLabel = (s: LiveStats | null) => (s ? `ONLINE: ${s.online.toLocaleString("en-US")} PLYRS` : "ONLINE: ...");
export const pingLabel = (p: number | null) => (p === null ? "-- MS" : `${p} MS`);
