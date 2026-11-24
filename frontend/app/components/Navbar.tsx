import { useTranslation } from "react-i18next";
import { useServerLabel } from "~/lib/serverRegion";
import { FaGamepad } from "react-icons/fa";
import PingBadge from "./PingBadge";
import UserInfo from "./UserInfo";

const Navbar = () => {
  const { t } = useTranslation();
  const serverLabel = useServerLabel();

  return (
    <header className="shrink-0 px-2 sm:px-4 py-[min(1.5rem,2vh)] short:py-1 border-b border-neon shadow-neon bg-[#060814]" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="px-2 sm:px-4 max-w-480 mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center justify-start gap-2">
          <FaGamepad  className="text-neon text-2xl"/>
          <h1 className="text-yellow text-[clamp(20px,4.2vh,36px)] font-pixel">PIXELCODE</h1>
          <p className="hidden md:block font-pixel text-xl text-neon">{serverLabel}</p>
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