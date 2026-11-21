// app/routes/player.tsx  —  /player/:id : a friend's profile (achievements, season badges, recent matches)
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FaLock, FaTrophy } from "react-icons/fa";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { SkinArt } from "~/components/skins";
import { getCurrentUser } from "~/api/auth";
import { api } from "~/api/http";
import { blockPlayer } from "~/api/stats";

export function meta() {
  return [{ title: "Player | PixelCode Arena" }];
}

type PlayerProfile = {
  userId: number;
  username: string;
  activeSkin?: string;
  rating: number;
  wins: number;
  losses: number;
  place: number;
  loginStreak: number;
  achievements: { code: string; unlockedAt: number | null }[];
  badges: { season: number; place: number; rating: number }[];
  matches: {
    code: string;
    ranked: boolean;
    botMatch?: boolean;
    winnerUserId: number | null;
    finishedAt: number | null;
    players: { userId: number; nickname: string; result: string; delta: number }[];
  }[];
};

const OUTCOME: Record<string, string> = { WIN: "bg-neon text-black", LOSS: "bg-pink text-black", DRAW: "bg-yellow text-black", VOID: "bg-gray-600 text-white" };
const OUTCOME_KEY: Record<string, string> = { WIN: "mr_win", LOSS: "mr_loss", DRAW: "mr_draw", VOID: "mr_void" };

function PlayerScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [p, setP] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate(`/login?next=${encodeURIComponent(`/player/${id}`)}`);
      return;
    }
    api<PlayerProfile>(`/players/${encodeURIComponent(id)}`)
      .then(setP)
      .catch((e) => setError(e instanceof Error ? e.message : t("unexpected_error")));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const block = async () => {
    if (!p || !window.confirm(t("bl_confirm", { name: p.username }))) return;
    try {
      await blockPlayer(p.userId);
      navigate("/friends");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    }
  };
  const isMe = p?.userId === getCurrentUser()?.id;

  const earned = p?.achievements.filter((a) => a.unlockedAt !== null) ?? [];
  const decided = (p?.wins ?? 0) + (p?.losses ?? 0);

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-200 mx-auto font-pixel flex flex-col gap-6 px-4 py-6 enter-up">
        <Link to="/friends" className="self-start border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10">
          &lt; {t("menu_friends")}
        </Link>
        {error && <p className="text-pink text-center text-xl">{error}</p>}
        {!p && !error && <p className="text-neon text-center animate-pulse">{t("loading")}</p>}
        {p && (
          <>
            <div className="relative flex items-center gap-5 border-2 border-neon bg-[#0a0f25] p-4">
              {!isMe && (
                <button
                  onClick={block}
                  className="absolute top-2 end-2 border border-gray-600 text-gray-400 hover:text-pink hover:border-pink text-xs px-2 py-1"
                >
                  ⛔ {t("bl_block")}
                </button>
              )}
              <SkinArt id={p.activeSkin} anim="wave" className="h-28 w-auto shrink-0" />
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="text-yellow text-4xl truncate">{p.username}</h1>
                <span className="text-pink text-xl" dir="ltr">
                  MMR {p.rating} · #{p.place}
                </span>
                <span className="text-sm text-gray-300">
                  {t("pl_record", { w: p.wins, l: p.losses })}
                  {decided > 0 && ` · ${Math.round((p.wins / decided) * 100)}%`}
                  {p.loginStreak > 1 && ` · 🔥 ${p.loginStreak}`}
                </span>
              </div>
            </div>

            {p.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.badges.map((b) => (
                  <span key={b.season} className="border border-yellow text-yellow text-xs px-2 py-1 flex items-center gap-1">
                    <FaTrophy /> {t("pg_badge", { n: b.season, place: b.place })}
                  </span>
                ))}
              </div>
            )}

            <section className="flex flex-col gap-2">
              <h2 className="text-yellow text-2xl" dir="auto">
                {t("pg_achievements")} <span dir="ltr" className="text-sm text-gray-400">{earned.length} / {p.achievements.length}</span>
              </h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {p.achievements.map((a) => (
                  <li
                    key={a.code}
                    title={t(`ach_${a.code}_desc`)}
                    className={`flex items-center gap-2 border px-2 py-2 text-xs ${a.unlockedAt ? "border-yellow text-yellow bg-yellow/5" : "border-neon/15 text-gray-500"}`}
                  >
                    {a.unlockedAt ? <FaTrophy className="shrink-0" /> : <FaLock className="shrink-0" />}
                    <span className="truncate">{t(`ach_${a.code}_name`)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-neon text-2xl">{t("pl_recent")}</h2>
              {p.matches.length === 0 && <p className="font-sans text-gray-400 text-sm">{t("mr_none")}</p>}
              <ul className="flex flex-col gap-1.5">
                {p.matches.map((m) => {
                  const mine = m.players.find((x) => x.userId === p.userId);
                  const rival = m.players.find((x) => x.userId !== p.userId);
                  const r = mine?.result ?? "VOID";
                  return (
                    <li key={m.code} className="flex items-center gap-3 border border-neon/25 bg-[#060b1e] px-3 py-2 text-sm">
                      <span className={`w-16 text-center text-xs py-0.5 ${OUTCOME[r] ?? OUTCOME.VOID}`}>{t(OUTCOME_KEY[r] ?? "mr_void")}</span>
                      <span className="flex-1 truncate text-yellow">
                        {t("mr_vs")} {rival?.nickname ?? "?"}
                      </span>
                      <span className="text-[10px] text-gray-400">{m.botMatch ? t("kind_bot") : m.ranked ? t("kind_ranked") : t("kind_private")}</span>
                      <span dir="ltr" className={`w-16 text-right ${(mine?.delta ?? 0) > 0 ? "text-neon" : (mine?.delta ?? 0) < 0 ? "text-pink" : "text-gray-500"}`}>
                        {(mine?.delta ?? 0) > 0 ? "+" : ""}
                        {mine?.delta ?? 0}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default function PlayerRoute() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <PlayerScreen />}</ClientOnly>;
}
