// Match results screen (Figma: End game — Victory / Defeat / Technical Win / Technical Loss)
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { FaArrowRight, FaArrowLeft } from "react-icons/fa";
import { SkinArt } from "~/components/skins";
import PhraseBar, { type PhraseId } from "./PhraseBar";

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
  /** ranked queue match (false = private room: no rating change) */
  ranked?: boolean;
  /** the opponent was PIXEL_BOT: no rating change, a small PIXELS reward, no rematch */
  botMatch?: boolean;
  /** PIXELS earned in a bot match */
  botReward?: number;
  mapName?: string;
  /** the rival already asked for a rematch */
  rematchOffered?: boolean;
  rematchBusy?: boolean;
  onRematch?: () => void;
  /** quick phrases still work after the end ("GG") */
  onPhrase?: (p: PhraseId) => void;
  /** the rival's latest phrase, shown on this screen */
  incomingPhrase?: string | null;
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
  ranked = true,
  botMatch = false,
  botReward = 0,
  mapName = "ARENA",
  rematchOffered = false,
  rematchBusy = false,
  onRematch,
  onPhrase,
  incomingPhrase = null,
}: GameResultModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const newMmr = Math.max(0, oldMmr + mmrDelta);
  const title = isDraw ? t("rs_draw") : isTechnical ? (isWinner ? t("rs_tech_win") : t("rs_tech_loss")) : isWinner ? t("rs_victory") : t("rs_defeat");
  const titleColor = isDraw || isWinner ? "text-yellow" : "text-pink";
  const subtitle = isDraw
    ? t("rs_sub_draw")
    : isTechnical
      ? isWinner
        ? t("rs_sub_opp_left")
        : t("rs_sub_you_left")
      : isWinner
        ? t("rs_sub_win")
        : t("rs_sub_loss", { name: opponentNickname });
  const banner = isDraw ? t("rs_banner_draw") : isWinner ? t("rs_banner_win") : t("rs_banner_loss");
  const deltaTxt = `${mmrDelta >= 0 ? "+" : ""}${mmrDelta} MMR`;
  const tag = (mine: boolean) =>
    isDraw ? t("rs_tag_draw") : (mine ? isWinner : !isWinner) ? (isTechnical ? t("rs_tag_tech") : t("rs_tag_exit")) : t("rs_tag_done");

  const Player = ({ mine }: { mine: boolean }) => {
    const color = mine ? "border-neon" : "border-pink";
    const sq = mine ? "bg-neon" : "bg-pink";
    return (
      <div className="flex flex-col items-center gap-2 w-72">
        <span className={`text-xl ${mine ? "text-neon" : "text-pink"}`}>{mine ? t("lb_you_label") : botMatch ? t("lb_bot_label") : t("lb_rival_label")}</span>
        <div className={`relative border-2 ${color} w-60 h-60 bg-[#0a0f24] flex items-center justify-center`}>
          <span className={`absolute -top-1 -right-1 w-3 h-3 ${sq}`} />
          <span className={`absolute -bottom-1 -left-1 w-3 h-3 ${sq}`} />
          <SkinArt
            id={mine ? mySkin : oppSkin}
            anim={isDraw || isTechnical ? "idle" : mine === isWinner ? "win" : "lose"}
            className="w-52 h-52 object-contain"
          />
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

  const exitA = isWinner && !isDraw ? matchDuration : t("rs_not_reached");
  const exitB = !isWinner && !isDraw ? matchDuration : t("rs_not_reached");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050816] font-pixel select-none">
      <div className="grid-background" />
      <div className="relative mx-auto max-w-280 px-6 py-10 flex flex-col items-center gap-6">
        <p className="flex items-center gap-4 text-neon text-xl">
          <span className="w-12 h-0.5 bg-neon" /> {botMatch ? t("kind_bot") : ranked ? t("kind_ranked") : t("kind_private")} / {t("rs_complete")} <span className="w-12 h-0.5 bg-neon" />
        </p>
        <h1 className={`${titleColor} text-glow-sm text-[96px]/none text-center`}>{title}</h1>
        <p className="font-sans text-xl text-gray-300 -mt-2">{subtitle}</p>

        <div className="flex items-start justify-between w-full mt-4">
          <Player mine />
          <div className="flex flex-col items-center gap-3 w-full max-w-120 px-4 mt-8">
            <span className="text-neon text-2xl">{banner}</span>
            <div className="w-full border border-neon bg-[#060b1e] p-6 flex flex-col items-center gap-4">
              <span className="text-neon text-xl">{isTechnical ? t("rs_your_mmr") : t("rs_your_rating")}</span>
              <div className="flex items-center justify-between w-full px-2">
                <div className="flex flex-col">
                  <span className="font-sans text-gray-400 text-base">{t("rs_before")}</span>
                  <span className="text-gray-400 text-[64px]/none">{oldMmr}</span>
                </div>
                <FaArrowRight className="text-neon text-2xl" />
                <div className="flex flex-col items-end">
                  <span className="font-sans text-gray-300 text-base">{t("rs_after")}</span>
                  <span className={`${mmrDelta >= 0 ? "text-yellow" : "text-pink"} text-[64px]/none`}>{newMmr}</span>
                </div>
              </div>
              <div className="w-full border border-neon text-center text-neon text-3xl py-2">{deltaTxt}</div>
            </div>
            <span className="font-sans text-gray-400 text-base">
              {botMatch
                ? t("rs_note_bot", { pixels: botReward })
                : ranked
                  ? t("rs_note_ranked")
                  : t("rs_note_private")}
            </span>
          </div>
          <Player mine={false} />
        </div>

        <div className="w-full border border-neon/50 bg-[#060b1e]">
          <div className="flex items-center justify-between px-5 py-3 text-lg">
            <span className="text-yellow">{t("rs_summary")}</span>
            <span className="font-sans text-gray-400 flex-1 ml-6">{mapName} · #{myRoomCode ?? "—"} · {matchDuration}</span>
            <span className="text-neon w-48 text-left">{playerNickname} / {t("tag_you")}</span>
            <span className="text-pink w-48 text-right truncate">{opponentNickname}</span>
          </div>
          {row(t("rs_checkpoints"), `${myCheckpoints} / 4`, `${oppCheckpoints} / 4`)}
          {row(t("rs_exit_time"), exitA, exitB)}
        </div>

        {(onPhrase || incomingPhrase) && (
          <div className="w-full flex flex-wrap items-center justify-between gap-3">
            {onPhrase && <PhraseBar onPhrase={onPhrase} className="text-sm" />}
            {incomingPhrase && (
              <span className="enter-up bg-white text-black text-base px-3 py-1 border-2 border-pink">
                {opponentNickname}: {incomingPhrase}
              </span>
            )}
          </div>
        )}
        {myRoomCode && (
          <Link to={`/replay/${encodeURIComponent(myRoomCode)}`} className="w-full text-center py-3 text-2xl border-2 border-yellow text-yellow hover:bg-yellow/10">
            ▶ {t("rp_watch")}
          </Link>
        )}

        <p className="font-sans text-gray-400 text-lg">{t("rs_momentum")}</p>
        <div className="flex gap-6 w-full">
          <Link to="/play" className="flex-[1.4] text-center py-4 text-2xl bg-pink border-2 border-yellow text-black">
            {t("rs_find_new")}
          </Link>
          {!botMatch && <button
            type="button"
            onClick={onRematch}
            disabled={!onRematch || rematchBusy}
            title={t("rs_rematch_hint")}
            className={`flex-1 text-center py-4 text-2xl border-2 disabled:opacity-50 ${
              rematchOffered ? "border-yellow text-black bg-yellow animate-pulse" : "border-neon text-yellow"
            }`}
          >
            {rematchBusy ? t("rs_opening") : rematchOffered ? t("rs_accept_rematch") : t("rs_rematch")}
          </button>}
          <Link
            to={myRoomCode ? `/results?match=${encodeURIComponent(myRoomCode)}` : "/results"}
            className="flex-1 text-center py-4 text-2xl border-2 border-neon text-yellow"
          >
            {t("rs_see_results")}
          </Link>
        </div>
        <Link to="/" className="flex items-center gap-2 text-neon text-xl">
          <FaArrowLeft /> {t("rs_back_main")}
        </Link>
      </div>
    </div>
  );
}
