import { SiInstagram, SiTwitch, SiGmail } from "react-icons/si";
import { useTranslation } from "react-i18next";

const Footer = () => {

  const { t } = useTranslation();

  return (  
    <footer className="px-4 border-t border-neon shadow-neon bg-[#060814]">
      <div className="max-w-480 text-center flex items-center justify-between mx-auto">
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 mr-2">
            <p className="uppercase text-l font-pixel text-neon">{t('footer_text')}</p>
            <p className="uppercase text-md font-pixel text-yellow">v1.0-beta</p>
          </div>
        </div>
        <div className="flex gap-2 items-center justify-center">
          <a href="" className="border p-2 border-neon hover:border-glow-sm-neon hover:text-glow-sm">
            <SiInstagram  className="text-yellow"/>
          </a>
          <a href="" className="border p-2 border-neon hover:border-glow-sm-neon hover:text-glow-sm">
            <SiTwitch  className="text-yellow"/>
          </a>
          <a href="" className="border p-2 border-neon hover:border-glow-sm-neon hover:text-glow-sm">
            <SiGmail  className="text-yellow"/>
          </a>
        </div>
      </div>
    </footer>
  );
}
 
export default Footer;