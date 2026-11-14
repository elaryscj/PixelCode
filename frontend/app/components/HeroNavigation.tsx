import { Link, useNavigate } from "react-router";
import { getCurrentUser, logoutUser } from "~/api/auth";
import { useTranslation } from "react-i18next";

const base =
  "btn-arcade uppercase w-full font-pixel text-3xl sm:text-4xl py-3 sm:py-2 px-6 text-center";
const secondary = `${base} border-2 border-neon text-yellow hover:text-glow-sm hover:border-glow-neon`;

const HeroNavigation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <nav className="enter-up mx-auto w-full max-w-100 flex flex-col gap-4" style={{ animationDelay: "120ms" }}>
      <Link
        to={"/play"}
        className={`${base} bg-pink border-2 border-yellow text-black text-4xl sm:text-5xl py-4 shadow-[0_0_24px_rgba(254,44,150,0.55)]`}
      >
        ▶ {t("play")}
      </Link>
      <Link to={"/practice"} className={secondary}>
        PRACTICE
      </Link>
      <div className="grid grid-cols-2 gap-4">
        <Link to={"/leaderboard"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("leaderboard")}
        </Link>
        <Link to={"/store"} className={`${secondary} !text-xl sm:!text-2xl !px-2`}>
          {t("store")}
        </Link>
      </div>
      <Link to={"/settings"} className={secondary}>
        {t("settings")}
      </Link>
      {getCurrentUser()?.admin && (
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
        QUIT
      </button>
    </nav>
  );
};

export default HeroNavigation;
