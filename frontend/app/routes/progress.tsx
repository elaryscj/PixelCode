// app/routes/progress.tsx  —  /progress : daily quests, achievements and the ranked season
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FaCheck, FaLock, FaTrophy } from "react-icons/fa";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { getProgress, markProgressSeen, timeLeft, type Achievement, type Progress, type Quest } from "~/api/progress";
import SeasonPrize from "~/components/SeasonPrize";

export function meta() {
  return [{ title: "Progress | PixelCode Arena" }];
}

const Bar = ({ value, max, done, min = 0 }: { value: number; max: number; done: boolean; min?: number }) => (
  <div className="h-2 w-full bg-[#141c3a]" dir="ltr">
    <div
      className={`h-full ${done ? "bg-neon" : "bg-pink"}`}
      style={{ width: `${Math.max(0, Math.min(100, ((value - min) / Math.max(1, max - min)) * 100))}%` }}
    />
  </div>
);

/** a rating goal starts at the starting rating, not at zero */
const START_RATING = 1500;

const Pixels = ({ n }: { n: number }) => (
  <span dir="ltr" className="text-yellow whitespace-nowrap">
    +{n} PX
  </span>
);

function QuestCard({ q }: { q: Quest }) {
  const { t } = useTranslation();
  const done = q.completedAt !== null;
  return (
    <li className={`flex flex-col gap-2 border-2 px-4 py-3 bg-[#060b1e] ${done ? "border-neon" : "border-neon/30"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-sans text-sm sm:text-base text-gray-100">{t(`quest_${q.code}`, { n: q.target })}</span>
        <Pixels n={q.reward} />
      </div>
      <Bar value={q.progress} max={q.target} done={done} />
      <span dir="ltr" className={`text-xs text-start ${done ? "text-neon" : "text-gray-400"}`}>
        {done ? `✔ ${t("pg_done")}` : `${q.progress} / ${q.target}`}
      </span>
    </li>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const { t } = useTranslation();
  const done = a.unlockedAt !== null;
  const showBar = !done && a.target > 1;
  return (
    <li
      className={`flex flex-col gap-2 border-2 px-4 py-3 ${
        done ? "border-yellow bg-yellow/5 shadow-[0_0_12px_rgba(253,224,71,0.25)]" : "border-neon/20 bg-[#060b1e]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-xl ${done ? "text-yellow" : "text-gray-600"}`}>{done ? <FaTrophy /> : <FaLock />}</span>
        <span className={`flex-1 text-lg leading-tight ${done ? "text-yellow" : "text-gray-300"}`}>{t(`ach_${a.code}_name`)}</span>
        <Pixels n={a.reward} />
      </div>
      <span className="font-sans text-xs sm:text-sm text-gray-400">{t(`ach_${a.code}_desc`)}</span>
      {showBar && (
        <>
          <Bar value={a.progress} max={a.target} done={false} min={a.code.startsWith("RATING_") ? START_RATING : 0} />
          <span dir="ltr" className="text-xs text-gray-500 text-start">
            {a.progress} / {a.target}
          </span>
        </>
      )}
      {done && (
        <span className="text-xs text-neon flex items-center gap-1">
          <FaCheck /> {new Date(a.unlockedAt!).toLocaleDateString()}
        </span>
      )}
    </li>
  );
}

function ProgressScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // server time - local time
  const [, tick] = useState(0);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate(`/login?next=${encodeURIComponent("/progress")}`);
      return;
    }
    getProgress()
      .then((p) => {
        setOffset(p.season.serverTime - Date.now());
        setData(p);
        // everything is on screen now: the menu badge goes away
        markProgressSeen()
          .then(() => window.dispatchEvent(new Event("pixelcode:progress-seen")))
          .catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("unexpected_error")));
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now() + offset;
  const earned = data?.achievements.filter((a) => a.unlockedAt !== null).length ?? 0;
  const season = data?.season;

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-220 mx-auto font-pixel flex flex-col gap-8 px-4 py-6 enter-up">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10">
            &lt; {t("menu")}
          </Link>
          <Link to="/leaderboard" className="text-xs text-neon uppercase hover:text-white">
            {t("leaderboard")}
          </Link>
        </div>
        <h1 className="text-yellow text-[13vw]/none sm:text-7xl/none text-center text-glow-sm">{t("pg_title")}</h1>

        {error && <p className="text-pink text-center">{error}</p>}
        {!data && !error && <p className="text-neon text-center animate-pulse">{t("loading")}</p>}

        {data && season && (
          <>
            {/* season */}
            <section className="border-2 border-pink bg-[#0a0f25] px-4 py-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-pink text-3xl">{t("pg_season", { n: season.number })}</h2>
                <span className="text-sm text-neon">{t("pg_season_ends", { time: timeLeft(season.endsAt - now, t) })}</span>
              </div>
              <p className="font-sans text-sm text-gray-300">
                {t("pg_season_rules", { n: season.minMatches, first: season.rewards[0], last: season.rewards[season.rewards.length - 1] })}
              </p>
              <SeasonPrize season={season} />
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-36 border border-neon/50 bg-[#060b1e] px-4 py-2 flex flex-col">
                  <span className="text-[11px] text-gray-400">{t("pg_season_matches")}</span>
                  <span dir="ltr" className="text-2xl text-yellow text-start">
                    {season.myMatches}
                    {season.myMatches < season.minMatches && <span className="text-gray-500 text-base"> / {season.minMatches}</span>}
                  </span>
                </div>
                <div className="flex-1 min-w-36 border border-neon/50 bg-[#060b1e] px-4 py-2 flex flex-col">
                  <span className="text-[11px] text-gray-400">{t("pg_season_place")}</span>
                  <span dir="ltr" className="text-2xl text-neon text-start">{season.myPlace ? `#${season.myPlace}` : "--"}</span>
                </div>
              </div>
              {data.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.badges.map((b) => (
                    <span key={b.season} className="border border-yellow text-yellow text-xs px-2 py-1 flex items-center gap-1">
                      <FaTrophy /> {t("pg_badge", { n: b.season, place: b.place })}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* daily quests */}
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-neon text-3xl">{t("pg_quests")}</h2>
                <span className="text-sm text-gray-400">{t("pg_quests_reset", { time: timeLeft(data.questsResetAt - now, t) })}</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.quests.map((q) => (
                  <QuestCard key={q.code} q={q} />
                ))}
              </ul>
              <p className="font-sans text-xs text-gray-500">{t("pg_quests_hint")}</p>
            </section>

            {/* achievements */}
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-yellow text-3xl">{t("pg_achievements")}</h2>
                <span dir="ltr" className="text-sm text-gray-400">
                  {earned} / {data.achievements.length}
                </span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.achievements.map((a) => (
                  <AchievementCard key={a.code} a={a} />
                ))}
              </ul>
            </section>

            <div className="flex justify-center">
              <Link to="/play" className="bg-pink border-2 border-yellow text-black px-8 py-2 text-xl">
                ▶ {t("play")}
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function ProgressRoute() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <ProgressScreen />}</ClientOnly>;
}
