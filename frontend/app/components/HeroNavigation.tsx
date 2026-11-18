import { Link, useNavigate } from "react-router";
import { logoutUser } from "~/api/auth";
import { useCurrentUser } from "~/lib/currentUser";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { getUnseen } from "~/api/progress";
import { getInvites } from "~/api/friends";

const base =
  "btn-arcade uppercase w-full font-pixel text-3xl sm:text-4xl py-3 sm:py-2 px-6 text-center";
const secondary = `${base} border-2 border-neon text-yellow hover:text-glow-sm hover:border-glow-neon`;

const HeroNavigation = ({ onHowToPlay }: { onHowToPlay?: () => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  // new quests / achievements / season places not looked at yet
  const [unseen, setUnseen] = useState(0);
  // friend requests waiting for an answer (kept fresh by SocialPulse's polling)
  const [requests, setRequests] = useState(0);
  useEffect(() => {
    if (!user) return;
    getInvites().then((r) => setRequests(r.requests)).catch(() => {});
    const onCount = (e: Event) => setRequests(Number((e as CustomEvent).detail) || 0);
    window.addEventListener("pixelcode:friend-requests", onCount);
    return () => window.removeEventListener("pixelcode:friend-requests", onCount);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) {
      setUnseen(0);
      return;
    }
    let alive = true;
    const load = () => getUnseen().then((r) => alive && setUnseen(r.count)).catch(() => {});
    void load();
    const cleared = () => setUnseen(0);
    window.addEventListener("pixelcode:progress-seen", cleared);
    return () => {
      alive = false;
      window.removeEventListener("pixelcode:progress-seen", cleared);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav className="enter-up mx-auto w-full max-w-100 flex flex-col gap-4" style={{ animationDelay: "120ms" }}>
      <Link
        to={"/play"}
        className={`${base} bg-pink border-2 border-yellow text-black text-4xl sm:text-5xl py-4 shadow-[0_0_24px_rgba(254,44,150,0.55)]`}
      >
        ▶ {t("play")}
      </Link>
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Link to={"/practice"} className={secondary}>
          {t("menu_practice")}
        </Link>
        <button onClick={onHowToPlay} className={`${secondary} !px-4`} title={t("how_to_play")} aria-label={t("how_to_play")}>
          ?
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Link to={"/leaderboard"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("leaderboard")}
        </Link>
        <Link to={"/store"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("store")}
        </Link>
        {/* match history used to be reachable only from the post-match screen */}
        <Link to={"/results"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("menu_results")}
        </Link>
        <Link to={"/profile"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("menu_profile")}
        </Link>
        <Link to={"/progress"} className={`${secondary} !text-xl sm:!text-2xl !px-2 relative`}>
          {t("menu_progress")}
          {unseen > 0 && (
            <span
              className="absolute -top-2.5 -end-2.5 min-w-7 h-7 px-1.5 flex items-center justify-center bg-pink text-black text-sm border-2 border-yellow shadow-[0_0_12px_rgba(254,44,150,0.8)] animate-pulse"
              aria-label={t("menu_new", { n: unseen })}
              title={t("menu_new", { n: unseen })}
            >
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Link>
        <Link to={"/friends"} className={`${secondary} !text-xl sm:!text-2xl !px-2 relative`}>
          {t("menu_friends")}
          {requests > 0 && (
            <span
              className="absolute -top-2.5 -end-2.5 min-w-7 h-7 px-1.5 flex items-center justify-center bg-pink text-black text-sm border-2 border-yellow shadow-[0_0_12px_rgba(254,44,150,0.8)]"
              aria-label={t("fr_incoming", { n: requests })}
              title={t("fr_incoming", { n: requests })}
            >
              {requests > 9 ? "9+" : requests}
            </span>
          )}
        </Link>
        <Link to={"/settings"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("settings")}
        </Link>
        <Link to={"/lesson"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("menu_lesson")}
        </Link>
      </div>
      {user?.teacher && (
        <Link to={"/teacher"} className={`${base} border-2 border-neon text-neon hover:text-glow-sm`}>
          {t("menu_teacher")}
        </Link>
      )}
      {user?.admin && (
        <Link to={"/admin"} className={`${base} border-2 border-yellow text-yellow hover:text-glow-sm`}>
          ADMIN
        </Link>
      )}
      <button
        onClick={() => {
          logoutUser();
          navigate("/login");
        }}
        className={`${base} border-2 border-pink text-pink hover:text-glow-sm`}
      >
        {t("menu_quit")}
      </button>
    </nav>
  );
};

export default HeroNavigation;
