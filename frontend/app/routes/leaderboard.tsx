import { useTranslation } from "react-i18next";
import TitleLine from "../components/TitleLine";
import PersonalRating from "../components/PersonalRating";
import { FaUser } from "react-icons/fa";
import Rank from "../components/Rank";
import TopRating from "../components/TopRating";

const LeaderBoard = () => {
  const { t } = useTranslation();
  return (
    <>
      <div className="star-background" />
      <div className="lg:block sm:hidden">

        <TitleLine text={"PIXELCODE ARENA"} />
        
        <h1 className="font-pixel text-yellow text-8xl/none text-center text-glow-sm">{t("leaderboard").toUpperCase()}</h1>

        <div className="container max-w-200 mx-auto font-pixel">
          <PersonalRating />

          <TopRating />
        </div>
      </div>
      <h3 className="font-pixel text-4xl text-yellow hover:text-glow-sm text-center lg:hidden">Sorry, the game is not yet available for your device...</h3>
    </>
  );
}

export default LeaderBoard;
