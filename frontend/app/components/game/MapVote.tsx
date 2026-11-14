// app/components/game/MapVote.tsx
// Lobby map vote: each player picks one map (click again to take the vote back).
// When the match starts the server decides: same vote wins, two votes = coin flip, no votes = random.
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
  const agreed = myVote != null && myVote === rivalVote;
  const hint =
    myVote == null
      ? "PICK THE MAP YOU WANT TO PLAY"
      : agreed
        ? "YOU BOTH PICKED IT: THIS MAP IS LOCKED IN"
        : rivalVote == null
          ? "YOUR VOTE COUNTS UNLESS YOUR RIVAL PICKS ANOTHER MAP"
          : "DIFFERENT PICKS: A COIN FLIP DECIDES BETWEEN THEM";

  return (
    <div className="w-full flex flex-col gap-3 font-pixel">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-yellow text-2xl">MAP VOTE</span>
        <span className={`text-sm ${agreed ? "text-neon" : "text-gray-400"}`}>{hint}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-[#081026] pointer-events-none">
                <MapLayer map={m} mirror={false} unlocked={[]} doors={{}} tone="neon" />
              </div>
              <div className="px-2 py-1.5 flex flex-col gap-0.5">
                <span className={`text-xs ${mine ? "text-neon" : "text-yellow"}`}>{m.name}</span>
                <span className="font-sans text-[11px] leading-tight text-gray-400 line-clamp-2">{m.tagline}</span>
              </div>
              <div className="absolute top-1 right-1 flex gap-1">
                {mine && <span className="bg-neon text-black text-[10px] px-1.5 py-0.5">YOU</span>}
                {theirs && <span className="bg-pink text-black text-[10px] px-1.5 py-0.5">RIVAL</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
