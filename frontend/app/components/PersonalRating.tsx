import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Avatar from "./Avatar";
import { getCurrentUser } from "~/api/auth";
import { getMyRank, type MyRank } from "~/api/leaderboard";

const PersonalRating = () => {
  const { t } = useTranslation();
  const user = getCurrentUser();
  const [mine, setMine] = useState<MyRank | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getMyRank()
      .then((r) => alive && setMine(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return (
    <div className="w-full border border-neon border-glow-sm-neon p-4 flex items-center justify-between bg-[#060816]">
      <div className="flex items-center justify-center gap-4 bg-[#060816]">
        <div className="px-2">
          <p className="font-pixel text-neon">{t("your_rank")}</p>
          <p className="font-pixel text-yellow text-3xl/none">
            # <span className="text-4xl">{mine ? mine.place : "-"}</span>
          </p>
        </div>
        <div className="p-1 border border-pink">
          <Avatar className="w-12 h-12" iconClass="text-3xl text-pink" />
        </div>
        <h2 className="text-3xl text-yellow">{user?.username ?? "Guest"}</h2>
      </div>

      <div className="text-end flex items-center justify-center gap-4">
        <div>
          <p className="uppercase font-pixel text-2xl text-yellow">{t("current_mmr")}</p>
          <p className="text-pink font-pixel text-xl">MMR {mine?.rating ?? user?.rating ?? 1500}</p>
          {mine && (
            <p className="text-neon font-pixel text-sm">
              W {mine.wins} · L {mine.losses}
            </p>
          )}
        </div>
        <p className="text-2xl text-neon text-glow-sm">●</p>
      </div>
    </div>
  );
};

export default PersonalRating;
