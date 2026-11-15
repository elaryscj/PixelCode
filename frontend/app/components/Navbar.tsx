import { useTranslation } from "react-i18next";
import { FaGamepad } from "react-icons/fa";
import PingBadge from "./PingBadge";
import UserInfo from "./UserInfo";

const Navbar = () => {
  const { t } = useTranslation();

  return (
    <header className="px-2 sm:px-4 py-4 sm:py-6 border-b border-neon shadow-neon bg-[#060814]" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="px-2 sm:px-4 max-w-480 mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center justify-start gap-2">
          <FaGamepad  className="text-neon text-2xl"/>
          <h1 className="text-yellow text-2xl sm:text-4xl font-pixel">PIXELCODE</h1>
          <p className="hidden md:block font-pixel text-xl text-neon">{t("server")}</p>
        </div>
        <div className="flex items-center gap-2">
          <PingBadge className="hidden sm:inline-flex font-pixel text-xl" />
          <p className="hidden sm:block font-pixel text-xl text-neon">|</p>
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
 
export default Navbar;