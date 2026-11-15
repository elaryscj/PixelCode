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

// ---------------------------------------------------------------- ping
// One shared measurement for the whole app: every header shows the same number and only one request
// runs at a time. The value is the median of the last few round trips, so a single slow request
// (the first TLS handshake, a Render cold start) does not make the number jump.
const SAMPLES = 5;
const samples: number[] = [];
const listeners = new Set<(p: number | null) => void>();
let current: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let failures = 0;

async function measure() {
  const t0 = performance.now();
  try {
    const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const ms = performance.now() - t0;
    failures = 0;
    samples.push(ms);
    if (samples.length > SAMPLES) samples.shift();
    const sorted = [...samples].sort((a, b) => a - b);
    // lower median: with 2 samples the slow first one (connection setup) is already ignored
    current = Math.max(1, Math.round(sorted[Math.floor((sorted.length - 1) / 2)]));
  } catch {
    if (++failures >= 2) {
      current = null; // offline / server unreachable
      samples.length = 0;
    }
  }
  listeners.forEach((l) => l(current));
}

/** Round trip to the backend in ms (shared, smoothed, refreshed every 5 s). null until measured or when unreachable. */
export function usePing(): number | null {
  const [ping, setPing] = useState<number | null>(current);
  useEffect(() => {
    listeners.add(setPing);
    setPing(current);
    if (!timer) {
      void measure();
      timer = setInterval(() => void measure(), 5000);
    }
    return () => {
      listeners.delete(setPing);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return ping;
}

/** Tailwind text colour for a ping value: green good, yellow fine, red slow, grey unknown. */
export const pingColor = (p: number | null) =>
  p === null ? "text-gray-500" : p < 100 ? "text-emerald-400" : p < 250 ? "text-yellow" : "text-pink";

export const onlineLabel = (s: LiveStats | null) => (s ? `ONLINE: ${s.online.toLocaleString("en-US")} PLYRS` : "ONLINE: ...");
export const pingLabel = (p: number | null) => (p === null ? "-- MS" : `${p} MS`);
