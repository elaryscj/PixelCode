import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { FaChevronLeft } from "react-icons/fa";

const NavbarPrev = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // inside a lobby the way back leads to the mode selection, everywhere else to the menu
  const inLobby = /^\/play\/[^/]+$/.test(pathname);

  return (
    <header className="px-4 py-5 border-b border-neon shadow-neon sticky top-0 z-30 bg-[#050816]/95 border-glow-sm-neon">
      <div className="px-4 max-w-480 mx-auto flex items-center justify-between">
        <Link
          to={inLobby ? "/play" : "/"}
          className="flex items-center gap-2 font-pixel text-yellow px-4 py-1.5 border-2 border-pink rounded-sm text-2xl hover:bg-pink/10"
        >
          <FaChevronLeft className="text-sm" /> {inLobby ? "BACK" : t("menu")}
        </Link>
        <div className="flex items-center gap-4 font-pixel text-xl">
          <span className="text-neon">{t("server")}</span>
          <span className="w-2 h-2 rounded-full bg-yellow" />
          <span className="text-white">ONLINE: 24,810 PLYRS</span>
        </div>
      </div>
    </header>
  );
};

export default NavbarPrev;
