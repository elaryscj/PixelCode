import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { APP_VERSION } from "~/version";

const Footer = () => {

  const { t } = useTranslation();

  return (  
    <footer className="px-4 border-t border-neon shadow-neon bg-[#060814]">
      <div className="max-w-480 text-center flex items-center justify-between mx-auto">
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 mr-2">
            <p className="uppercase text-l font-pixel text-neon">{t('footer_text')}</p>
            <p className="uppercase text-md font-pixel text-yellow">{APP_VERSION}</p>
          </div>
        </div>
        {/* the documents payment providers and parents look for */}
        <nav className="flex flex-wrap justify-end gap-x-4 gap-y-1 font-pixel text-sm sm:text-base py-2">
          <Link to="/offer" className="text-gray-400 hover:text-neon">{t("lg_offer")}</Link>
          <Link to="/privacy" className="text-gray-400 hover:text-neon">{t("lg_privacy")}</Link>
          <Link to="/contacts" className="text-gray-400 hover:text-neon">{t("lg_contacts")}</Link>
        </nav>
      </div>
    </footer>
  );
}
 
export default Footer;