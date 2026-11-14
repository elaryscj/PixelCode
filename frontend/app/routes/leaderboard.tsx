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
      <div className="w-full px-3 sm:px-4 py-6 enter-up">

        <TitleLine text={"PIXELCODE ARENA"} />
        
        <h1 className="font-pixel text-yellow text-[13vw]/none sm:text-7xl/none lg:text-8xl/none text-center text-glow-sm my-4">{t("leaderboard").toUpperCase()}</h1>

        <div className="container max-w-200 mx-auto font-pixel">
          <PersonalRating />

          <TopRating />
        </div>
      </div>
    </>
  );
}

export default LeaderBoard;
