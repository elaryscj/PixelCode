import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import Rank from "./Rank";
import { getCurrentUser } from "~/api/auth";
import { getLeaderboard, type LeaderboardEntry } from "~/api/leaderboard";

const WIDTHS = ["w-60", "w-48", "w-60", "w-48", "w-60"];

/** Grey placeholder rows shown behind the loading / empty / error panels (Figma: Leaderboard / Rankings) */
const Skeleton = ({ pulse }: { pulse: boolean }) => (
  <div aria-hidden>
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className={`flex items-center gap-6 px-6 h-15 ${i % 2 ? "bg-[#0f1535]" : "bg-[#0a0f25]"}`}>
        <span className={`w-14 h-2.5 ${pulse ? "bg-[#26335f] animate-pulse" : "bg-[#141c3a]"}`} />
        <span className={`w-9 h-9 ${pulse ? "bg-[#26335f] animate-pulse" : "bg-[#0a0f25] border border-[#141c3a]"}`} />
        <span className={`h-2.5 ${WIDTHS[i % WIDTHS.length]} ${pulse ? "bg-[#26335f] animate-pulse" : "bg-[#141c3a]"}`} />
        <span className={`ml-auto w-24 h-2.5 ${pulse ? "bg-[#26335f] animate-pulse" : "bg-[#141c3a]"}`} />
      </div>
    ))}
  </div>
);

const TopRating = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const me = getCurrentUser()?.username;

  const load = useCallback(() => {
    setFailed(false);
    setRows(null);
    getLeaderboard()
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = rows === null && !failed;
  const empty = rows !== null && rows.length === 0;
  const showTable = rows !== null && rows.length > 0;

  const panel = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] max-w-[560px] bg-[#0a0f25] border-2 p-8 text-center";
  const btn = "inline-block mt-5 px-12 py-2 bg-[#ff2d96] border-2 border-yellow text-black text-xl";

  return (
    <div className="mt-8 border-2 border-pink">
      <div className="flex items-center px-6 py-3 border-b-2 border-pink text-xl bg-[#060816] uppercase text-yellow">
        <div className="w-32">{t("place")}</div>
        <div className="flex-1">{t("combatant")}</div>
        <div className="w-40 text-right">{t("score")}</div>
      </div>
      {showTable ? (
        <div className="max-h-[45vh] overflow-y-auto scrollbar-none">
          {rows!.map((item) => (
            <Rank
              key={item.username}
              place={item.place}
              userId={item.id}
              username={item.username}
              mmr={item.rating}
              isCurrentUser={!!me && me.toLowerCase() === item.username.toLowerCase()}
            />
          ))}
        </div>
      ) : (
        <div className="relative">
          <Skeleton pulse={loading} />
          {loading && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] bg-[#050816] border border-neon p-6 text-center">
              <p className="text-yellow text-xl">LOADING RANKINGS...</p>
              <div className="mt-3 h-1.5 bg-[repeating-linear-gradient(90deg,#0b3b4a_0_16px,transparent_16px_24px)] animate-pulse" />
            </div>
          )}
          {empty && (
            <div className={`${panel} border-neon`}>
              <h3 className="text-yellow text-3xl">NO RANKINGS YET</h3>
              <p className="font-sans text-base text-white mt-4">
                There are no ranked results to display. Your saved rank is shown above.
              </p>
              <Link to="/" className={btn}>
                Back to Menu
              </Link>
            </div>
          )}
          {failed && (
            <div className={`${panel} border-pink`}>
              <h3 className="text-pink text-3xl">RANKINGS UNAVAILABLE</h3>
              <p className="font-sans text-base text-white mt-4">
                We couldn&apos;t load the top 10. Your saved rank is still shown above.
              </p>
              <button onClick={load} className={btn}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopRating;
