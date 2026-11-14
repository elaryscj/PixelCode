// app/routes/results.tsx  —  /results?match=CODE : "See my results" (stats + recent matches)
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { getCurrentUser, refreshUser } from "~/api/auth";
import { getMatchHistory, type MatchHistoryEntry } from "~/api/game";
import { getMap } from "~/game/maps";

export function meta() {
  return [{ title: "My Results | PixelCode Arena" }];
}

const REASONS: Record<string, string> = {
  FINISH: "Exit reached",
  TIME_LIMIT: "Time limit: more doors open",
  DRAW: "Time limit: level on doors",
  ABSENCE: "Player left the match",
  NO_SHOW: "Player did not join",
  VOID: "Cancelled",
  SERVER_RESTART: "Server restart",
};

const OUTCOME: Record<string, { label: string; cls: string }> = {
  WIN: { label: "WIN", cls: "bg-neon text-black" },
  LOSS: { label: "LOSS", cls: "bg-pink text-black" },
  DRAW: { label: "DRAW", cls: "bg-yellow text-black" },
  VOID: { label: "VOID", cls: "bg-gray-600 text-white" },
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function ago(ms: number | null): string {
  if (!ms) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

export default function Results() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = params.get("match")?.toUpperCase() ?? null;
  const user = getCurrentUser();
  const [matches, setMatches] = useState<MatchHistoryEntry[] | null>(null);
  const [rating, setRating] = useState<number | null>(null); // filled after mount (no SSR mismatch)
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    setRating(user.rating ?? null);
    getMatchHistory(20)
      .then(setMatches)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your matches"));
    refreshUser()
      .then((u) => u && setRating(u.rating))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = (m: MatchHistoryEntry) => m.players.find((p) => p.userId === user?.id);
  const rival = (m: MatchHistoryEntry) => m.players.find((p) => p.userId !== user?.id);
  const list = matches ?? [];
  const count = (r: string) => list.filter((m) => mine(m)?.result === r).length;
  const wins = count("WIN");
  const losses = count("LOSS");
  const draws = count("DRAW");
  const decided = wins + losses + draws;
  const net = list.reduce((sum, m) => sum + (mine(m)?.delta ?? 0), 0);

  const tile = (label: string, value: string, cls = "text-yellow") => (
    <div className="flex-1 min-w-36 border border-neon/50 bg-[#060b1e] px-4 py-3 flex flex-col gap-1">
      <span className="text-[11px] text-gray-400 tracking-wider">{label}</span>
      <span className={`text-3xl ${cls}`}>{value}</span>
    </div>
  );

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-220 mx-auto font-pixel flex flex-col gap-6 px-4 py-6">
        <h1 className="text-yellow text-7xl/none text-center text-glow-sm">MY RESULTS</h1>

        <div className="flex flex-wrap gap-3">
          {tile("CURRENT MMR", rating !== null ? String(rating) : "...", "text-neon")}
          {tile("WINS / LOSSES / DRAWS", `${wins} / ${losses} / ${draws}`)}
          {tile("WIN RATE", decided ? `${Math.round((wins / decided) * 100)}%` : "--")}
          {tile(`MMR, LAST ${list.length || 20}`, `${net >= 0 ? "+" : ""}${net}`, net >= 0 ? "text-neon" : "text-pink")}
        </div>

        {error && <p className="text-pink text-center">{error}</p>}
        {!matches && !error && <p className="text-neon text-center animate-pulse">LOADING MATCHES...</p>}
        {matches && matches.length === 0 && (
          <div className="flex flex-col items-center gap-4 border border-dashed border-neon/40 py-10">
            <p className="text-gray-300">No finished matches yet.</p>
            <Link to="/play" className="bg-pink border-2 border-yellow text-black px-6 py-2">
              FIND A MATCH
            </Link>
          </div>
        )}

        {list.length > 0 && (
          <ul className="flex flex-col gap-2">
            {list.map((m) => {
              const me = mine(m);
              const opp = rival(m);
              const out = OUTCOME[me?.result ?? "VOID"] ?? OUTCOME.VOID;
              const isNew = highlight === m.code;
              const delta = me?.delta ?? 0;
              return (
                <li
                  key={m.code}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-2 bg-[#060b1e] ${
                    isNew ? "border-yellow shadow-[0_0_14px_rgba(253,224,71,0.5)]" : "border-neon/30"
                  }`}
                >
                  <span className={`w-16 text-center text-sm py-1 ${out.cls}`}>{out.label}</span>
                  <div className="flex-1 min-w-48 flex flex-col gap-0.5">
                    <span className="text-yellow text-lg truncate">
                      vs {opp?.nickname ?? "?"}
                      {isNew && <span className="ml-3 text-[10px] text-black bg-yellow px-1.5 py-0.5 align-middle">JUST PLAYED</span>}
                    </span>
                    <span className="font-sans text-xs text-gray-400">
                      {m.mapId != null ? getMap(m.mapId).name : "Classic map"} · {REASONS[m.reason] ?? m.reason}
                      {m.ranked ? " · Ranked" : " · Private room"}
                    </span>
                  </div>
                  <span className="text-gray-300 text-sm w-14 text-right">{mmss(m.durationSeconds)}</span>
                  <span className={`text-lg w-24 text-right ${delta > 0 ? "text-neon" : delta < 0 ? "text-pink" : "text-gray-400"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta} MMR
                  </span>
                  <span className="font-sans text-xs text-gray-500 w-20 text-right">{ago(m.finishedAt)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-center gap-4">
          <Link to="/play" className="bg-pink border-2 border-yellow text-black px-6 py-2">
            FIND A NEW MATCH
          </Link>
          <Link to="/leaderboard" className="border-2 border-neon text-yellow px-6 py-2">
            LEADERBOARD
          </Link>
        </div>
      </div>
    </>
  );
}
