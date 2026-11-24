// app/components/game/MapVote.tsx
// Lobby map vote: each player picks one map (click again to take the vote back).
// When the match starts the server decides: same vote wins, two votes = coin flip, no votes = random.
import { useTranslation } from "react-i18next";
import { MAPS } from "~/game/maps";
import { MapLayer } from "./MapLayer";

export default function MapVote({
  myVote,
  rivalVote,
  disabled,
  onVote,
}: {
  myVote: number | null | undefined;
  rivalVote: number | null | undefined;
  disabled?: boolean;
  onVote: (mapId: number | null) => void;
}) {
  const { t } = useTranslation();
  const agreed = myVote != null && myVote === rivalVote;
  const hint =
    myVote == null
      ? t("mv_pick")
      : agreed
        ? t("mv_locked")
        : rivalVote == null
          ? t("mv_counts")
          : t("mv_coin");

  return (
    <div className="w-full flex flex-col gap-[min(0.75rem,1vh)] font-pixel">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-yellow text-[clamp(13px,2.6vh,24px)]">{t("mv_title")}</span>
        <span className={`text-sm ${agreed ? "text-neon" : "text-gray-400"}`}>{hint}</span>
      </div>
      <div className="grid grid-cols-3 gap-[min(0.75rem,1vh)]">
        {MAPS.map((m) => {
          const mine = myVote === m.id;
          const theirs = rivalVote === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onVote(mine ? null : m.id)}
              title={m.tagline}
              className={`group relative flex flex-col text-left border-2 bg-[#060b1e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                mine && theirs
                  ? "border-yellow shadow-[0_0_14px_rgba(253,224,71,0.6)]"
                  : mine
                    ? "border-neon shadow-neon"
                    : theirs
                      ? "border-pink"
                      : "border-neon/25 hover:border-neon/70"
              }`}
            >
              {/* static mini preview of the real map */}
              <div className="relative w-full aspect-[4/3] max-h-[11vh] overflow-hidden bg-[#081026] pointer-events-none">
                <MapLayer map={m} mirror={false} unlocked={[]} doors={{}} tone="neon" />
              </div>
              <div className="px-2 py-1.5 flex flex-col gap-0.5">
                <span className={`text-xs ${mine ? "text-neon" : "text-yellow"}`}>{m.name}</span>
                <span className="font-sans text-[11px] leading-tight text-gray-400 line-clamp-2 [@media(max-height:820px)]:hidden">{m.tagline}</span>
              </div>
              <div className="absolute top-1 right-1 flex gap-1">
                {mine && <span className="bg-neon text-black text-[10px] px-1.5 py-0.5">{t("tag_you")}</span>}
                {theirs && <span className="bg-pink text-black text-[10px] px-1.5 py-0.5">{t("tag_rival")}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
