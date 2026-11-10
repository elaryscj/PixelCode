import { Link, useNavigate } from "react-router";
import { getCurrentUser, logoutUser } from "~/api/auth";
import { useTranslation } from "react-i18next";


const HeroNavigation = () => {

  const { t } = useTranslation();
  const navigate = useNavigate();

  return (  
    <div className="mx-auto w-100 flex flex-col gap-4">
      <Link to={'/play'} className="uppercase w-full text-4xl font-pixel bg-pink py-2 px-6 text-center border-2 border-yellow text-black ">{t('play')}</Link>
      <Link to={'/leaderboard'} className="uppercase w-full text-4xl font-pixel border-2 border-neon py-2 px-6 text-center text-yellow transition-shadow duration-150 hover:text-glow-sm hover:border-glow-neon">{t('leaderboard')}</Link>
      <Link to={'/store'} className="uppercase w-full text-4xl font-pixel border-2 border-neon py-2 px-6 text-center text-yellow transition-shadow duration-150 hover:text-glow-sm hover:border-glow-neon">{t('store')}</Link>
      <Link to={'/settings'} className="uppercase w-full text-4xl font-pixel border-2 border-neon py-2 px-6 text-center text-yellow transition-shadow duration-150 hover:text-glow-sm hover:border-glow-neon">{t('settings')}</Link>
      {getCurrentUser()?.admin && (
        <Link to={'/admin'} className="uppercase w-full text-3xl font-pixel border-2 border-yellow py-2 px-6 text-center text-yellow hover:text-glow-sm">
          ADMIN
        </Link>
      )}
      <button
        onClick={() => {
          logoutUser();
          navigate("/login");
        }}
        className="uppercase w-full text-4xl font-pixel border-2 border-pink py-2 px-6 text-center text-pink transition-shadow duration-150 hover:text-glow-sm"
      >
        QUIT
      </button>
    </div>
  );
}
 
export default HeroNavigation;