// app/components/SeasonPrize.tsx — the exclusive skin the season's top places win (animated preview)
import { useTranslation } from "react-i18next";
import { SkinArt } from "~/components/skins";
import type { SeasonInfo } from "~/api/progress";

export default function SeasonPrize({ season }: { season: SeasonInfo }) {
  const { t } = useTranslation();
  if (!season.rewardSkin) return null;
  return (
    <div className="flex items-center gap-3 border border-yellow/60 bg-yellow/5 px-3 py-2">
      <SkinArt id={season.rewardSkin.id} anim="dance" className="h-16 w-auto shrink-0" />
      <p className="font-sans text-xs sm:text-sm text-gray-200">
        {t("pg_season_skin", { n: season.skinPlaces, name: season.rewardSkin.name })}
      </p>
    </div>
  );
}
