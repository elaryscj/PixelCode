// app/components/SeasonBanner.tsx — the running season and last season's podium, above the leaderboard
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { FaTrophy } from "react-icons/fa";
import { getCurrentSeason, timeLeft, type CurrentSeason } from "~/api/progress";
import SeasonPrize from "./SeasonPrize";

const MEDAL = ["text-yellow", "text-gray-300", "text-[#cd7f32]"];

export default function SeasonBanner() {
  const { t } = useTranslation();
  const [season, setSeason] = useState<CurrentSeason | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    getCurrentSeason()
      .then((s) => {
        setOffset(s.serverTime - Date.now());
        setSeason(s);
      })
      .catch(() => {});
  }, []);

  if (!season) return null;
  return (
    <div className="mb-6 border-2 border-pink bg-[#0a0f25] px-4 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-pink text-2xl">{t("pg_season", { n: season.number })}</span>
        <span className="text-sm text-neon">{t("pg_season_ends", { time: timeLeft(season.endsAt - (Date.now() + offset), t) })}</span>
      </div>
      <p className="font-sans text-xs sm:text-sm text-gray-400">
        {t("pg_season_rules", { n: season.minMatches, first: season.rewards[0], last: season.rewards[season.rewards.length - 1] })}{" "}
        <Link to="/progress" className="text-neon hover:text-white whitespace-nowrap">
          {t("pg_title")} &gt;
        </Link>
      </p>
      <SeasonPrize season={season} />
      {season.lastTop.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-400">{t("lb_last_season", { n: season.lastSeason })}</span>
          {season.lastTop.slice(0, 3).map((r, i) => (
            <span key={r.place} className={`flex items-center gap-1 ${MEDAL[i]}`}>
              <FaTrophy /> {r.username} <span dir="ltr" className="text-gray-500">{r.rating}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
