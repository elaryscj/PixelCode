// app/routes/lobby.tsx  —  /play/:code : the assigned match (five-minute join window, US-32)
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { FaCheck, FaCopy } from "react-icons/fa";
import Avatar from "~/components/Avatar";
import { getRoom, leaveRoom, readyRoom, voteMap, type Room } from "~/api/room";
import MapVote from "~/components/game/MapVote";
import { getCurrentUser } from "~/api/auth";
import { useRoomSocket } from "~/api/socket";

const POLL_MS = 1000;

const LobbyScreen = () => {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const offset = useRef(0); // server time - local time
  const { lastEvent } = useRoomSocket(code);

  const load = useCallback(async () => {
    try {
      const r = await getRoom(code);
      offset.current = r.serverTime - Date.now();
      setRoom(r);
      setError(null);
      if (r.roomStatus === "FINISHED") navigate("/play");
    } catch (e) {
      if ((e as { status?: number })?.status === 404) navigate("/play");
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    }
  }, [code, t, navigate]);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "GAME_STARTED") navigate(`/play/${code}/game`);
    else if (lastEvent.type === "MATCH_CANCELLED" || lastEvent.type === "ROOM_CLOSED") navigate("/play");
    else load();
  }, [lastEvent, load, code, navigate]);

  // Both players ready -> the match starts
  useEffect(() => {
    if (room?.roomStatus === "PLAYING") navigate(`/play/${code}/game`);
  }, [room?.roomStatus, code, navigate]);

  // Countdown of the join window (server time)
  useEffect(() => {
    const id = setInterval(() => {
      if (room?.joinDeadline) {
        setLeft(Math.max(0, Math.round((room.joinDeadline - (Date.now() + offset.current)) / 1000)));
      } else {
        setLeft(null);
      }
    }, 500);
    return () => clearInterval(id);
  }, [room?.joinDeadline]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  const handleReady = async () => {
    setBusy(true);
    try {
      setRoom(await readyRoom(code));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (mapId: number | null) => {
    // optimistic: show the pick at once, the server echoes it back
    setRoom((r) =>
      r ? { ...r, players: r.players.map((p) => (p.userId === user?.id ? { ...p, mapVote: mapId } : p)) } : r,
    );
    try {
      setRoom(await voteMap(code, mapId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
      void load();
    }
  };

  const handleLeave = async () => {
    try {
      await leaveRoom(code);
    } catch {
      /* ignore */
    }
    navigate("/play");
  };

  const players = room?.players ?? [];
  const status = room?.roomStatus;
  const me = players.find((p) => p.userId === user?.id);
  const rival = players.find((p) => p.userId !== user?.id);
  const canVote = !!me && (status === "WAITING" || status === "READY");
  const vote = (
    <MapVote myVote={me?.mapVote} rivalVote={rival?.mapVote} disabled={!canVote} onVote={handleVote} />
  );
  const mm = left === null ? "" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  if (room?.ranked) {
    const card = (p: (typeof players)[number] | undefined, mine: boolean) => (
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-36 sm:w-64">
        <span className={`font-pixel text-xs sm:text-xl text-center ${mine ? "text-neon" : "text-pink"}`}>
          {mine ? "PLAYER 01 / YOU" : "PLAYER 02 / RIVAL"}
        </span>
        <div className={`relative p-3 border-2 ${mine ? "border-neon shadow-neon" : "border-pink"}`}>
          {["-top-1.5 -left-1.5", "-top-1.5 -right-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((c) => (
            <span key={c} className={`absolute w-3 h-3 ${c} ${mine ? "bg-neon" : "bg-pink"}`} />
          ))}
          <Avatar
            className="w-28 h-28 sm:w-52 sm:h-52"
            iconClass={`text-8xl ${mine ? "text-neon" : "text-pink"}`}
            userId={p?.userId ?? null}
          />
        </div>
        <span className="font-pixel text-yellow text-xl sm:text-3xl truncate max-w-full">{p?.nickname ?? "..."}</span>
        <span className="font-pixel text-pink text-xl">MMR {p?.rating ?? "---"}</span>
        <span className="font-pixel text-gray-400 text-xs sm:text-base text-center">{p ? `CONNECTED \u00B7 ${p.ready ? "READY" : "AWAITING JOIN"}` : "WAITING"}</span>
      </div>
    );
    return (
      <>
        <div className="star-background" />
        <div className="flex flex-col items-center gap-6 sm:gap-8 mx-auto w-full px-4 font-pixel py-6 enter-up">
          <h1 className="text-yellow text-[12vw]/none sm:text-[80px]/none lg:text-[112px]/none text-glow-sm text-center">WAITING TO JOIN</h1>
          <p className="text-neon text-base sm:text-2xl text-center">MATCH FOUND / RANKED DUEL / 1 VS 1</p>
          <div className="flex items-center gap-3 sm:gap-10">
            {card(me, true)}
            <div className="flex flex-col items-center gap-2 self-stretch justify-center">
              <span className="w-0.5 flex-1 bg-neon/50" />
              <span className="border-2 border-yellow text-yellow text-3xl sm:text-5xl px-3 sm:px-5 py-2 sm:py-3 text-glow-sm">VS</span>
              <span className="w-0.5 flex-1 bg-neon/50" />
            </div>
            {card(rival, false)}
          </div>
          <div className="w-full max-w-180">{vote}</div>
          <div className="w-full max-w-150 border border-neon bg-[#060b1e] p-4 sm:p-6 flex flex-col items-center gap-4">
            <p className="text-yellow text-2xl sm:text-4xl text-center">{me?.ready ? "Joined" : `Join within ${mm || "05:00"}`}</p>
            <div className="w-full h-1 bg-neon" />
            {me?.ready ? (
              <p className="text-neon text-2xl">WAITING FOR YOUR RIVAL...</p>
            ) : (
              <button
                onClick={handleReady}
                disabled={busy || !me || status !== "READY"}
                className="btn-arcade w-full py-3 bg-pink border-2 border-yellow text-black text-2xl sm:text-3xl disabled:opacity-50"
              >
                Join Match
              </button>
            )}
            <p className="font-sans text-gray-400 text-base">
              {me?.ready ? "Your duel begins as soon as both players have joined." : "Confirm before the timer ends to enter the arena."}
            </p>
          </div>
          {error && <p className="text-pink text-xl text-center">{error}</p>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="star-background" />
      <div className="flex flex-col items-center gap-6 sm:gap-8 mx-auto w-full max-w-175 px-4 py-6 font-pixel enter-up">
        <h1 className="text-yellow text-[14vw]/none sm:text-[96px]/none lg:text-[136px]/none text-glow-sm text-center">Room Code</h1>
        <div className="flex items-center gap-4">
          <span className="text-pink text-[13vw]/none sm:text-[96px]/none tracking-widest text-glow-sm">{code}</span>
          <button onClick={copyCode} className="p-2 border border-pink text-pink text-3xl" title="Copy">
            {copied ? <FaCheck /> : <FaCopy />}
          </button>
        </div>

        <p className="text-neon/80 text-sm sm:text-xl -mt-4 text-center">PRIVATE ROOM · FRIENDLY MATCH, RATING UNCHANGED</p>

        {left !== null && (
          <p className="text-center text-2xl text-yellow">
            JOIN WITHIN <span className={left < 60 ? "text-pink" : "text-neon"}>{mm}</span>
          </p>
        )}

        <ul className="flex flex-col gap-3 w-full">
          {[0, 1].map((i) => {
            const p = players[i];
            return (
              <li
                key={i}
                className={`flex items-center justify-between px-4 py-3 border-2 ${
                  p ? "border-neon bg-surface" : "border-dashed border-neon/40"
                }`}
              >
                <span className="flex items-center gap-3 text-xl sm:text-3xl text-yellow min-w-0 truncate">
                  <span className="border border-neon p-0.5">
                    <Avatar className="w-10 h-10" iconClass="text-xl text-neon" userId={p?.userId ?? null} />
                  </span>
                  {p ? (
                    <>
                      {p.nickname} <span className="text-pink text-base sm:text-2xl">({p.rating ?? "?"} MMR)</span>
                    </>
                  ) : (
                    <span className="text-neon/60">{t("waiting_player")}</span>
                  )}
                </span>
                {p?.ready && <span className="text-neon text-xl">{t("ready").toUpperCase()}</span>}
              </li>
            );
          })}
        </ul>

        {vote}

        <button
          onClick={handleReady}
          disabled={busy || !me || me.ready || status !== "READY"}
          className="btn-arcade w-full uppercase text-3xl sm:text-4xl py-3 bg-pink border-2 border-yellow text-black disabled:opacity-40 disabled:pointer-events-none"
        >
          {me?.ready ? t("ready") : "READY"}
        </button>
        <button onClick={handleLeave} className="uppercase text-xl text-neon hover:text-yellow">
          LEAVE ROOM
        </button>

        {error && <p className="text-pink text-xl text-center">{error}</p>}
      </div>
    </>
  );
};

export default function Lobby() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <LobbyScreen />}</ClientOnly>;
}
