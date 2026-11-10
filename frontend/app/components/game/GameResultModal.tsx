// Match results screen (Figma: End game — Victory / Defeat / Technical Win / Technical Loss)
import { Link } from "react-router";
import { FaArrowRight, FaArrowLeft } from "react-icons/fa";
import { SkinArt } from "~/components/skins";

interface GameResultModalProps {
  isOpen: boolean;
  isWinner: boolean;
  playerNickname: string;
  opponentNickname: string;
  oldMmr: number;
  mmrDelta: number;
  matchDuration: string;
  isTechnical?: boolean;
  isDraw?: boolean;
  mySkin?: string;
  oppSkin?: string;
  myCheckpoints?: number;
  oppCheckpoints?: number;
  myRoomCode?: string;
}

export default function GameResultModal({
  isOpen,
  isWinner,
  playerNickname,
  opponentNickname,
  oldMmr,
  mmrDelta,
  matchDuration,
  isTechnical = false,
  isDraw = false,
  mySkin,
  oppSkin,
  myCheckpoints = 0,
  oppCheckpoints = 0,
  myRoomCode,
}: GameResultModalProps) {
  if (!isOpen) return null;

  const newMmr = Math.max(0, oldMmr + mmrDelta);
  const title = isDraw ? "Draw" : isTechnical ? (isWinner ? "Technical Win" : "Technical Loss") : isWinner ? "VICTORY!" : "DEFEAT";
  const titleColor = isDraw || isWinner ? "text-yellow" : "text-pink";
  const subtitle = isDraw
    ? "Nobody reached the exit in time."
    : isTechnical
      ? isWinner
        ? "Opponent did not return in time"
        : "You did not return in time"
      : isWinner
        ? "Circuit conquered. You reached the exit first."
        : `${opponentNickname} reached the exit first.`;
  const banner = isDraw ? "THE DUEL IS A DRAW" : isWinner ? "YOU WIN THE DUEL" : "YOU LOSE THE DUEL";
  const deltaTxt = `${mmrDelta >= 0 ? "+" : ""}${mmrDelta} MMR`;
  const tag = (mine: boolean) =>
    isDraw ? "DRAW" : (mine ? isWinner : !isWinner) ? (isTechnical ? "WINNER / TECHNICAL WIN" : "WINNER / EXIT SECURED") : "DUEL COMPLETE";

  const Player = ({ mine }: { mine: boolean }) => {
    const color = mine ? "border-neon" : "border-pink";
    const sq = mine ? "bg-neon" : "bg-pink";
    return (
      <div className="flex flex-col items-center gap-2 w-72">
        <span className={`text-xl ${mine ? "text-neon" : "text-pink"}`}>{mine ? "PLAYER 01 / YOU" : "PLAYER 02 / RIVAL"}</span>
        <div className={`relative border-2 ${color} w-60 h-60 bg-[#0a0f24] flex items-center justify-center`}>
          <span className={`absolute -top-1 -right-1 w-3 h-3 ${sq}`} />
          <span className={`absolute -bottom-1 -left-1 w-3 h-3 ${sq}`} />
          <SkinArt id={mine ? mySkin : oppSkin} size="large" className="w-52 h-52 object-contain" />
        </div>
        <span className="text-yellow text-5xl truncate max-w-full">{mine ? playerNickname : opponentNickname}</span>
        <span className="text-yellow text-base">{tag(mine)}</span>
      </div>
    );
  };

  const row = (label: string, a: string, b: string) => (
    <div className="flex items-center justify-between px-5 py-3 border-t border-neon/30 font-sans text-lg">
      <span className="text-gray-400 flex-1">{label}</span>
      <span className="text-white w-48 text-left">{a}</span>
      <span className="text-white w-48 text-right">{b}</span>
    </div>
  );

  const exitA = isWinner && !isDraw ? matchDuration : "NOT REACHED";
  const exitB = !isWinner && !isDraw ? matchDuration : "NOT REACHED";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050816] font-pixel select-none">
      <div className="grid-background" />
      <div className="relative mx-auto max-w-280 px-6 py-10 flex flex-col items-center gap-6">
        <p className="flex items-center gap-4 text-neon text-xl">
          <span className="w-12 h-0.5 bg-neon" /> RANKED DUEL / MATCH COMPLETE <span className="w-12 h-0.5 bg-neon" />
        </p>
        <h1 className={`${titleColor} text-glow-sm text-[96px]/none text-center`}>{title}</h1>
        <p className="font-sans text-xl text-gray-300 -mt-2">{subtitle}</p>

        <div className="flex items-start justify-between w-full mt-4">
          <Player mine />
          <div className="flex flex-col items-center gap-3 w-120 mt-8">
            <span className="text-neon text-2xl">{banner}</span>
            <div className="w-full border border-neon bg-[#060b1e] p-6 flex flex-col items-center gap-4">
              <span className="text-neon text-xl">{isTechnical ? "YOUR MMR" : "YOUR MATCHMAKING RATING"}</span>
              <div className="flex items-center justify-between w-full px-2">
                <div className="flex flex-col">
                  <span className="font-sans text-gray-400 text-base">BEFORE</span>
                  <span className="text-gray-400 text-[64px]/none">{oldMmr}</span>
                </div>
                <FaArrowRight className="text-neon text-2xl" />
                <div className="flex flex-col items-end">
                  <span className="font-sans text-gray-300 text-base">AFTER</span>
                  <span className={`${mmrDelta >= 0 ? "text-yellow" : "text-pink"} text-[64px]/none`}>{newMmr}</span>
                </div>
              </div>
              <div className="w-full border border-neon text-center text-neon text-3xl py-2">{deltaTxt}</div>
            </div>
            <span className="font-sans text-gray-400 text-base">RATING UPDATED · RANKED RESULT SAVED</span>
          </div>
          <Player mine={false} />
        </div>

        <div className="w-full border border-neon/50 bg-[#060b1e]">
          <div className="flex items-center justify-between px-5 py-3 text-lg">
            <span className="text-yellow">MATCH SUMMARY</span>
            <span className="font-sans text-gray-400 flex-1 ml-6">MIRROR CIRCUIT · #{myRoomCode ?? "—"} · {matchDuration}</span>
            <span className="text-neon w-48 text-left">{playerNickname} / YOU</span>
            <span className="text-pink w-48 text-right truncate">{opponentNickname}</span>
          </div>
          {row("Checkpoints secured", `${myCheckpoints} / 4`, `${oppCheckpoints} / 4`)}
          {row("Exit time", exitA, exitB)}
        </div>

        <p className="font-sans text-gray-400 text-lg">Keep the momentum. Your next rival is waiting.</p>
        <div className="flex gap-6 w-full">
          <Link to="/play" className="flex-[1.4] text-center py-4 text-2xl bg-pink border-2 border-yellow text-black">
            FIND A NEW MATCH
          </Link>
          <Link to="/play" className="flex-1 text-center py-4 text-2xl border-2 border-neon text-yellow">
            REMATCH
          </Link>
          <Link to="/profile" className="flex-1 text-center py-4 text-2xl border-2 border-neon text-yellow">
            SEE MY RESULTS
          </Link>
        </div>
        <Link to="/" className="flex items-center gap-2 text-neon text-xl">
          <FaArrowLeft /> BACK TO MAIN PAGE
        </Link>
      </div>
    </div>
  );
}
