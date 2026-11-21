// Admin STATS: how every challenge really plays (met / solved by code / opened by the timer), to rebalance levels.
import { useEffect, useState } from "react";
import { getAdminStats, type AdminStats, type ChallengeStat } from "~/api/stats";

const HINT: Record<ChallengeStat["hint"], { text: string; cls: string }> = {
  OK: { text: "OK", cls: "text-neon" },
  TOO_HARD: { text: "TOO HARD", cls: "text-pink" },
  TOO_EASY: { text: "TOO EASY", cls: "text-yellow" },
  FEW_DATA: { text: "few data", cls: "text-gray-500" },
};

const fmt = (s: number | null | undefined) => (s == null ? "-" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

export default function ChallengeStats() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"met" | "solveRate" | "avgAttempts">("met");

  useEffect(() => {
    setError(null);
    getAdminStats(days)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the statistics"));
  }, [days]);

  const rows = [...(data?.challenges ?? [])].sort((a, b) =>
    sort === "solveRate" ? a.solveRate - b.solveRate : sort === "avgAttempts" ? b.avgAttempts - a.avgAttempts : b.met - a.met,
  );
  const m = data?.matches;

  return (
    <section>
      <h2 className="text-neon text-3xl mt-10 mb-3">&gt; STATS: MATCHES AND CHALLENGES</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 border text-lg ${d === days ? "border-yellow text-yellow bg-yellow/10" : "border-neon/50 text-neon"}`}
          >
            {d} DAYS
          </button>
        ))}
      </div>
      {error && <p className="text-pink text-xl font-sans">[!] {error}</p>}
      {m && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 font-sans">
          {[
            ["Matches", m.total],
            ["Quick Play vs players", m.ranked],
            ["vs PIXEL_BOT", m.bot],
            ["Friendly rooms", m.friendly],
            ["Different players", m.players],
            ["Average length", fmt(m.avgDurationSeconds)],
            ...Object.entries(m.reasons).map(([k, v]) => [`Ended by ${k}`, v] as [string, number]),
          ].map(([k, v]) => (
            <div key={String(k)} className="border border-neon/40 bg-[#070c1e]/90 px-3 py-2">
              <div className="text-gray-400 text-xs">{k}</div>
              <div className="text-yellow text-xl">{v}</div>
            </div>
          ))}
        </div>
      )}
      <p className="font-sans text-gray-400 text-sm mb-2">
        Solved = opened with correct code; timer = opened by the 4-minute timer; unsolved = the match ended first.
        Hint compares the solve rate with the level (EASY under 60% = too hard; MEDIUM 40-92%; HARD 25-85%), from 5 meetings.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full font-sans text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="text-yellow text-left border-b border-neon/40">
              <th className="py-2 pr-2">Challenge</th>
              <th className="pr-2">Level</th>
              <th className="pr-2 cursor-pointer" onClick={() => setSort("met")}>Met{sort === "met" ? " ▼" : ""}</th>
              <th className="pr-2 cursor-pointer" onClick={() => setSort("solveRate")}>Solved{sort === "solveRate" ? " ▲" : ""}</th>
              <th className="pr-2">Timer</th>
              <th className="pr-2">Unsolved</th>
              <th className="pr-2 cursor-pointer" onClick={() => setSort("avgAttempts")}>Attempts{sort === "avgAttempts" ? " ▼" : ""}</th>
              <th className="pr-2">Solve time</th>
              <th>Hint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.challengeId} className={`border-b border-neon/10 ${r.published ? "" : "opacity-50"}`}>
                <td className="py-1.5 pr-2 text-white">{r.title}</td>
                <td className="pr-2">{r.difficulty}</td>
                <td className="pr-2">{r.met}</td>
                <td className="pr-2">{r.solved} ({r.solveRate}%)</td>
                <td className="pr-2">{r.timeout}</td>
                <td className="pr-2">{r.unsolved}</td>
                <td className="pr-2">{r.avgAttempts}</td>
                <td className="pr-2">{fmt(r.avgSolveSeconds)}</td>
                <td className={HINT[r.hint].cls}>{HINT[r.hint].text}</td>
              </tr>
            ))}
            {data && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-gray-400">No doors opened in this period yet (counted from now on).</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
