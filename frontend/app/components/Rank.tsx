import { useTranslation } from "react-i18next";
import Avatar from "./Avatar";

const Rank = ({
  place,
  username,
  mmr,
  isCurrentUser = false,
  userId,
}: {
  place: number;
  username: string;
  mmr: number;
  isCurrentUser?: boolean;
  userId?: number;
}) => {
  const { t } = useTranslation();

  const styling = isCurrentUser
    ? "flex items-center px-3 sm:px-6 py-3 bg-neon/15 border-b-2 border-neon text-neon shadow-[inset_0_0_12px_rgba(1,228,255,0.2)]"
    : place === 1
    ? "flex items-center px-3 sm:px-6 py-3 bg-surface border-b-2 border-yellow text-yellow"
    : place === 2
    ? "flex items-center px-3 sm:px-6 py-3 bg-surface border-b-2 border-silver text-silver"
    : place === 3
    ? "flex items-center px-3 sm:px-6 py-3 bg-surface border-b-2 border-bronze text-bronze"
    : "flex items-center px-3 sm:px-6 py-3 bg-surface border-b-2 border-pink text-white";

  const frame = isCurrentUser
    ? "border-2 border-neon p-2 bg-neon/20 text-neon"
    : place === 1
    ? "border border-yellow p-2"
    : place === 2
    ? "border border-silver p-2"
    : place === 3
    ? "border border-bronze p-2"
    : "border border-neon p-2";

  return (
    <div className={styling}>
      <div className="w-16 sm:w-32 text-base sm:text-2xl font-bold whitespace-nowrap">
        {place <= 3 ? (
          <>
            {["👑", "🥈", "🥉"][place - 1]}{" "}
            <span className="hidden sm:inline">{t(["rank_first", "rank_second", "rank_third"][place - 1])}</span>
          </>
        ) : (
          `#${place}`
        )}
      </div>
      <div className="flex flex-1 items-center gap-2 sm:gap-4 min-w-0">
        <span className={frame}>
          <Avatar className="w-6 h-6" iconClass="text-base" userId={userId ?? null} />
        </span>
        <span className="text-xl sm:text-3xl font-pixel truncate">{username}</span>
        {isCurrentUser && (
          <span className="text-[10px] bg-neon text-black px-2 py-0.5 font-bold uppercase tracking-wider">
            YOU
          </span>
        )}
      </div>
      <div className="w-24 sm:w-40 text-right text-base sm:text-2xl whitespace-nowrap">MMR {mmr}</div>
    </div>
  );
};

export default Rank;