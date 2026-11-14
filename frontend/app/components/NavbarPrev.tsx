import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { FaChevronLeft } from "react-icons/fa";
import { onlineLabel, useLiveStats } from "~/lib/liveStats";
import PingBadge from "./PingBadge";

const NavbarPrev = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const stats = useLiveStats();
  // inside a lobby the way back leads to the mode selection, everywhere else to the menu
  const inLobby = /^\/play\/[^/]+$/.test(pathname);

  return (
    <header style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }} className="px-2 sm:px-4 py-3 sm:py-5 border-b border-neon shadow-neon sticky top-0 z-30 bg-[#050816]/95 border-glow-sm-neon">
      <div className="px-2 sm:px-4 max-w-480 mx-auto flex items-center justify-between gap-3">
        <Link
          to={inLobby ? "/play" : "/"}
          className="flex items-center gap-2 font-pixel text-yellow btn-arcade shrink-0 px-3 sm:px-4 py-1.5 border-2 border-pink rounded-sm text-xl sm:text-2xl hover:bg-pink/10"
        >
          <FaChevronLeft className="text-sm" /> {inLobby ? "BACK" : t("menu")}
        </Link>
        <div className="flex items-center gap-2 sm:gap-4 font-pixel text-base sm:text-xl min-w-0">
          <span className="hidden lg:inline text-neon">{t("server")}</span>
          <span className="hidden lg:inline-block w-2 h-2 rounded-full bg-yellow" />
          <PingBadge />
          <span className="w-2 h-2 rounded-full bg-yellow" />
          <span className="text-white truncate">{onlineLabel(stats)}</span>
        </div>
      </div>
    </header>
  );
};

export default NavbarPrev;
