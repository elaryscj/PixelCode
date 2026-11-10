import { useTranslation } from "react-i18next";

const LeaderBoard = () => {

  const { t } = useTranslation();

  return (  
    <div className="mt-8 border-2 border-pink">

      <div className="flex items-center px-6 py-3 border-b-2 border-pink text-xl uppercase text-yellow">
        <div className="w-32">{t("place")}</div>
        <div className="flex-1">{t("combatant")}</div>
        <div className="w-40 text-right">{t("score")}</div>
      </div>
    </div>
  );
}
 
export default LeaderBoard;