import { Link, useNavigate } from "react-router";
import { logoutUser } from "~/api/auth";
import { useCurrentUser } from "~/lib/currentUser";
import { useTranslation } from "react-i18next";
import { useEffect, useState, type ReactNode } from "react";
import { FaChartBar, FaCog, FaShoppingCart, FaStar, FaTrophy, FaUser, FaUserFriends } from "react-icons/fa";
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

  const badge = (n: number, label: string, pulse = false) =>
    n > 0 && (
      <span
        className={`absolute -top-2 -end-2 min-w-6 h-6 px-1 flex items-center justify-center bg-pink text-black text-xs border-2 border-yellow shadow-[0_0_12px_rgba(254,44,150,0.8)] ${pulse ? "animate-pulse" : ""}`}
        aria-label={label}
        title={label}
      >
        {n > 9 ? "9+" : n}
      </span>
    );

  // the main places of the game: icon tiles, three in a row
  const tiles: { to: string; icon: ReactNode; label: string; extra?: ReactNode }[] = [
    { to: "/leaderboard", icon: <FaTrophy />, label: t("leaderboard") },
    { to: "/friends", icon: <FaUserFriends />, label: t("menu_friends"), extra: badge(requests, t("fr_incoming", { n: requests })) },
    { to: "/progress", icon: <FaStar />, label: t("menu_progress"), extra: badge(unseen, t("menu_new", { n: unseen }), true) },
    { to: "/store", icon: <FaShoppingCart />, label: t("store") },
    { to: "/results", icon: <FaChartBar />, label: t("menu_results") },
    { to: "/profile", icon: <FaUser />, label: t("menu_profile") },
  ];
  const small = "font-pixel text-sm sm:text-base uppercase px-2 py-1 hover:text-glow-sm transition-colors";

  return (
    <nav className="enter-up mx-auto w-full max-w-100 flex flex-col gap-4" style={{ animationDelay: "120ms" }}>
      <Link
        to={"/play"}
        className={`${base} bg-pink border-2 border-yellow text-black text-4xl sm:text-5xl py-4 shadow-[0_0_24px_rgba(254,44,150,0.55)]`}
      >
        ▶ {t("play")}
      </Link>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
        <Link to={"/practice"} className={`${secondary} flex items-center justify-center gap-2 !text-lg sm:!text-xl !px-2 !py-3 leading-tight`}>
          {t("menu_practice")}
        </Link>
        <Link to={"/tournament"} className={`${secondary} flex items-center justify-center gap-2 !text-lg sm:!text-xl !px-2 !py-3 leading-tight !border-yellow/80`}>
          <FaTrophy className="text-yellow shrink-0" /> <span>{t("menu_tournament_short")}</span>
        </Link>
        <button onClick={onHowToPlay} className={`${secondary} flex items-center justify-center !text-lg sm:!text-xl !px-4 !py-3`} title={t("how_to_play")} aria-label={t("how_to_play")}>
          ?
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tiles.map((x) => (
          <Link
            key={x.to}
            to={x.to}
            className="btn-arcade relative flex flex-col items-center justify-center gap-1.5 min-h-20 px-1 py-2 border-2 border-neon/70 bg-[#060b1e]/70 text-yellow hover:border-glow-neon hover:text-glow-sm"
          >
            <span className="text-neon text-2xl">{x.icon}</span>
            <span className="font-pixel uppercase text-xs sm:text-sm leading-tight text-center break-words">{x.label}</span>
            {x.extra}
          </Link>
        ))}
      </div>

      {/* rarely needed: small links, not big buttons */}
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 border-t border-neon/20 pt-3">
        <Link to={"/settings"} className={`${small} text-gray-300 hover:text-yellow flex items-center gap-1.5`}>
          <FaCog /> {t("settings")}
        </Link>
        <Link to={"/lesson"} className={`${small} text-gray-300 hover:text-yellow`}>
          {t("menu_lesson")}
        </Link>
        {/* everyone sees it: teachers find the offer (free trial, subscription) there */}
        {user && (
          <Link to={"/teacher"} className={`${small} text-neon/90 hover:text-neon`}>
            {t("menu_teacher")}
          </Link>
        )}
        {user?.admin && (
          <Link to={"/admin"} className={`${small} text-yellow/90 hover:text-yellow`}>
            ADMIN
          </Link>
        )}
        <button
          onClick={() => {
            logoutUser();
            navigate("/login");
          }}
          className={`${small} text-pink/90 hover:text-pink`}
        >
          {t("menu_quit")}
        </button>
      </div>
    </nav>
  );
};

export default HeroNavigation;
