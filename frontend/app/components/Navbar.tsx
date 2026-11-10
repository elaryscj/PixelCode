import { useTranslation } from "react-i18next";
import { useState } from "react";
import { FaGamepad, FaWifi } from "react-icons/fa";
import UserInfo from "./UserInfo";

const Navbar = () => {
  const { t } = useTranslation();

  return (
    <header className="px-4 py-6 border-b border-neon shadow-neon bg-[#060814]">
      <div className="px-4 max-w-480 mx-auto flex items-center justify-between">
        <div className="flex items-center justify-start gap-2">
          <FaGamepad  className="text-neon text-2xl"/>
          <h1 className="text-yellow text-4xl font-pixel">PIXELCODE</h1>
          <p className="font-pixel text-xl text-neon">{t("server")}</p>
        </div>
        <div className="flex items-center gap-2">
          <FaWifi className="text-neon "/>
          <p className="font-pixel text-xl text-neon">18 ms | </p>
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
 
export default Navbar;