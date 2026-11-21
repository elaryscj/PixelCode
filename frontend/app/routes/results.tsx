// app/routes/results.tsx  —  /results?match=CODE : "See my results" (stats + recent matches)
import { useEffect, useState } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getCurrentUser, refreshUser } from "~/api/auth";
import { getMatchHistory, type MatchHistoryEntry } from "~/api/game";
import { getMap } from "~/game/maps";
import { getProgress } from "~/api/progress";
import { blockPlayer, getMatchDoors, type MatchDoor } from "~/api/stats";

type Reward = { key: string; label: string; reward: number };

export function meta() {
  return [{ title: "My Results | PixelCode Arena" }];
}

// how a match ended -> translation key (see language-config/locales)
const REASON_KEYS: Record<string, string> = {
  FINISH: "mr_reason_finish",
  TIME_LIMIT: "mr_reason_time",
  DRAW: "mr_reason_draw",
  ABSENCE: "mr_reason_absence",
  NO_SHOW: "mr_reason_noshow",
  VOID: "mr_reason_void",
  SERVER_RESTART: "mr_reason_restart",
};

const OUTCOME: Record<string, { key: string; cls: string }> = {
  WIN: { key: "mr_win", cls: "bg-neon text-black" },
  LOSS: { key: "mr_loss", cls: "bg-pink text-black" },
  DRAW: { key: "mr_draw", cls: "bg-yellow text-black" },
  VOID: { key: "mr_void", cls: "bg-gray-600 text-white" },
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function ago(ms: number | null, t: TFunction): string {
  if (!ms) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return t("mr_just_now");
  if (s < 3600) return t("mr_min_ago", { n: Math.floor(s / 60) });
  if (s < 86400) return t("mr_h_ago", { n: Math.floor(s / 3600) });
  return new Date(ms).toLocaleDateString();
}

function ResultsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = params.get("match")?.toUpperCase() ?? null;
  const user = getCurrentUser();
  const [matches, setMatches] = useState<MatchHistoryEntry[] | null>(null);
  const [rating, setRating] = useState<number | null>(null); // filled after mount (no SSR mismatch)
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  /** match code -> its doors (loaded when "SOLUTIONS" is opened) */
  const [doors, setDoors] = useState<Record<string, MatchDoor[] | "loading">>({});
  const [open, setOpen] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Record<number, boolean>>({});

  const toggleDoors = (code: string) => {
    if (open === code) {
      setOpen(null);
      return;
    }
    setOpen(code);
    if (!doors[code]) {
      setDoors((d) => ({ ...d, [code]: "loading" }));
      getMatchDoors(code)
        .then((list) => setDoors((d) => ({ ...d, [code]: list })))
        .catch(() => setDoors((d) => ({ ...d, [code]: [] })));
    }
  };

  const block = async (userId: number, name: string) => {
    if (!window.confirm(t("bl_confirm", { name }))) return;
    try {
      await blockPlayer(userId);
      setBlocked((b) => ({ ...b, [userId]: true }));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t("cm_unavailable"));
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    setRating(user.rating ?? null);
    getMatchHistory(20)
      .then(setMatches)
      .catch((e) => setError(e instanceof Error ? e.message : t("mr_err_load")));
    refreshUser()
      .then((u) => u && setRating(u.rating))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // quests and achievements completed during the match just played (shown once, under the stats)
  useEffect(() => {
    const m = highlight ? matches?.find((x) => x.code === highlight) : null;
    if (!m?.finishedAt) return;
    const from = m.finishedAt - (m.durationSeconds + 60) * 1000;
    const to = m.finishedAt + 60_000;
    const inMatch = (at: number | null) => at !== null && at >= from && at <= to;
    getProgress()
      .then((p) => {
        const list: Reward[] = [];
        for (const q of p.quests)
          if (inMatch(q.completedAt)) list.push({ key: `q-${q.code}`, label: t(`quest_${q.code}`, { n: q.target }), reward: q.reward });
        for (const a of p.achievements)
          if (inMatch(a.unlockedAt)) list.push({ key: `a-${a.code}`, label: t(`ach_${a.code}_name`), reward: a.reward });
        setRewards(list);
      })
      .catch(() => {});
  }, [matches, highlight]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <span dir="ltr" className={`text-3xl text-start ${cls}`}>{value}</span>
    </div>
  );

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-220 mx-auto font-pixel flex flex-col gap-6 px-4 py-6">
        <h1 className="text-yellow text-7xl/none text-center text-glow-sm">{t("menu_results")}</h1>

        <div className="flex flex-wrap gap-3">
          {tile(t("mr_current_mmr"), rating !== null ? String(rating) : "...", "text-neon")}
          {tile(t("mr_wld"), `${wins} / ${losses} / ${draws}`)}
          {tile(t("mr_win_rate"), decided ? `${Math.round((wins / decided) * 100)}%` : "--")}
          {tile(t("mr_mmr_last", { n: list.length || 20 }), `${net >= 0 ? "+" : ""}${net}`, net >= 0 ? "text-neon" : "text-pink")}
        </div>

        {rewards.length > 0 && (
          <div className="border-2 border-yellow bg-yellow/5 px-4 py-3 flex flex-col gap-2 shadow-[0_0_14px_rgba(253,224,71,0.35)]">
            <span className="text-yellow text-xl">★ {t("rs_rewards")}</span>
            <ul className="flex flex-col gap-1">
              {rewards.map((r) => (
                <li key={r.key} className="flex justify-between gap-3 font-sans text-sm text-gray-100">
                  <span>{r.label}</span>
                  <span dir="ltr" className="font-pixel text-yellow whitespace-nowrap">+{r.reward} PX</span>
                </li>
              ))}
            </ul>
            <Link to="/progress" className="self-start text-neon text-sm hover:text-white">
              {t("rs_see_progress")} &gt;
            </Link>
          </div>
        )}

        {error && <p className="text-pink text-center">{error}</p>}
        {!matches && !error && <p className="text-neon text-center animate-pulse">{t("mr_loading")}</p>}
        {matches && matches.length === 0 && (
          <div className="flex flex-col items-center gap-4 border border-dashed border-neon/40 py-10">
            <p className="text-gray-300">{t("mr_none")}</p>
            <Link to="/play" className="bg-pink border-2 border-yellow text-black px-6 py-2">
              {t("mr_find_match")}
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
                  <span className={`w-16 text-center text-sm py-1 ${out.cls}`}>{t(out.key)}</span>
                  <div className="flex-1 min-w-48 flex flex-col gap-0.5">
                    <span className="text-yellow text-lg truncate">
                      {t("mr_vs")} {opp?.nickname ?? "?"}
                      {isNew && <span className="ml-3 text-[10px] text-black bg-yellow px-1.5 py-0.5 align-middle">{t("mr_just_played")}</span>}
                    </span>
                    <span className="font-sans text-xs text-gray-400">
                      {m.mapId != null ? getMap(m.mapId).name : t("mr_classic_map")} · {REASON_KEYS[m.reason] ? t(REASON_KEYS[m.reason]) : m.reason}
                      {" · "}
                      {m.botMatch ? t("kind_bot") : m.ranked ? t("kind_ranked") : t("kind_private")}
                    </span>
                  </div>
                  <span dir="ltr" className="text-gray-300 text-sm w-14 text-right">{mmss(m.durationSeconds)}</span>
                  <span dir="ltr" className={`text-lg w-24 text-right ${delta > 0 ? "text-neon" : delta < 0 ? "text-pink" : "text-gray-400"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta} MMR
                  </span>
                  <span className="font-sans text-xs text-gray-500 w-20 text-right">{ago(m.finishedAt, t)}</span>
                  {m.replay && (
                    <Link to={`/replay/${encodeURIComponent(m.code)}`} className="border border-yellow/70 text-yellow text-xs px-2 py-1 hover:bg-yellow/10">
                      ▶ {t("rp_short")}
                    </Link>
                  )}
                  <button
                    onClick={() => toggleDoors(m.code)}
                    aria-expanded={open === m.code}
                    className="border border-neon/70 text-neon text-xs px-2 py-1 hover:bg-neon/10"
                  >
                    &lt;/&gt; {t("bs_short")}
                  </button>
                  {opp && !m.botMatch && opp.userId != null && (
                    blocked[opp.userId] ? (
                      <span className="text-[10px] text-gray-500">{t("bl_done")}</span>
                    ) : (
                      <button
                        onClick={() => block(opp.userId!, opp.nickname)}
                        title={t("bl_block")}
                        className="border border-pink/50 text-pink/80 text-xs px-2 py-1 hover:bg-pink/10"
                      >
                        ⛔
                      </button>
                    )
                  )}
                  {open === m.code && (
                    <div className="basis-full border-t border-neon/20 pt-2 mt-1 flex flex-col gap-1 font-sans text-sm">
                      {doors[m.code] === "loading" && <span className="text-neon animate-pulse">{t("mr_loading")}</span>}
                      {Array.isArray(doors[m.code]) && (doors[m.code] as MatchDoor[]).length === 0 && (
                        <span className="text-gray-400">{t("bs_no_doors")}</span>
                      )}
                      {Array.isArray(doors[m.code]) &&
                        (doors[m.code] as MatchDoor[]).map((d) => (
                          <Link
                            key={d.challengeId}
                            to={`/solutions/${d.challengeId}`}
                            className="flex justify-between gap-3 px-2 py-1 border border-neon/20 hover:border-neon"
                          >
                            <span className="text-yellow truncate">{d.title}</span>
                            <span className={d.outcome === "SOLVED" ? "text-neon" : d.outcome === "TIMEOUT" ? "text-yellow" : "text-pink"}>
                              {t(`bs_${d.outcome.toLowerCase()}`)} · {t("bs_see")} &gt;
                            </span>
                          </Link>
                        ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-center gap-4">
          <Link to="/play" className="bg-pink border-2 border-yellow text-black px-6 py-2">
            {t("rs_find_new")}
          </Link>
          <Link to="/leaderboard" className="border-2 border-neon text-yellow px-6 py-2">
            {t("leaderboard").toUpperCase()}
          </Link>
        </div>
      </div>
    </>
  );
}

export default function Results() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <ResultsScreen />}</ClientOnly>;
}
