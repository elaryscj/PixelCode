// app/routes/lobby.tsx  —  /play/:code : the assigned match (five-minute join window, US-32)
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { FaCheck, FaCopy, FaLink } from "react-icons/fa";
import Avatar from "~/components/Avatar";
import { getRoom, leaveRoom, readyRoom, voteMap, type Room } from "~/api/room";
import MapVote from "~/components/game/MapVote";
import { getCurrentUser } from "~/api/auth";
import { getClient, useRoomSocket } from "~/api/socket";

// The socket pushes every lobby change; polling is only the safety net. Fast while the socket is down.
const POLL_MS = 1000;
const POLL_MS_LIVE = 4000;

const LobbyScreen = () => {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const offset = useRef(0); // server time - local time
  // Polls, socket refreshes and button calls overlap: only the newest answer may update the screen,
  // otherwise an older poll lands after "Join Match" and the button flickers back.
  const seq = useRef(0);
  const { lastEvent } = useRoomSocket(code);

  const applyRoom = useCallback((r: Room, ticket: number) => {
    if (ticket < seq.current) return;
    seq.current = ticket;
    offset.current = r.serverTime - Date.now();
    setRoom(r);
  }, []);

  const load = useCallback(async () => {
    const ticket = ++seq.current;
    try {
      const r = await getRoom(code);
      applyRoom(r, ticket);
      setError(null);
      if (r.roomStatus === "FINISHED") navigate("/play");
    } catch (e) {
      if ((e as { status?: number })?.status === 404) navigate("/play");
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    }
  }, [code, t, navigate, applyRoom]);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    let alive = true;
    const tick = async () => {
      await load();
      if (alive) id = setTimeout(tick, getClient().connected ? POLL_MS_LIVE : POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(id);
    };
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

  // Invite link: opens the room for a friend (signing in first if needed). Phones get the share sheet.
  const shareInvite = async () => {
    const url = `${window.location.origin}/join/${code}`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "PixelCode Arena", text: t("inv_share_text"), url });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // the player closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt(t("inv_copy_prompt"), url);
    }
  };

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
    const ticket = ++seq.current;
    try {
      applyRoom(await readyRoom(code), ticket);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (mapId: number | null) => {
    // optimistic: show the pick at once, the server echoes it back
    const ticket = ++seq.current;
    setRoom((r) =>
      r ? { ...r, players: r.players.map((p) => (p.userId === user?.id ? { ...p, mapVote: mapId } : p)) } : r,
    );
    try {
      applyRoom(await voteMap(code, mapId), ticket);
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
  // Vote first, then join: the join button only unlocks once you have picked a map.
  const voted = me?.mapVote != null;
  const vote = (
    <MapVote myVote={me?.mapVote} rivalVote={rival?.mapVote} disabled={!canVote} onVote={handleVote} />
  );
  const mm = left === null ? "" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  // Until the first answer arrives we do not know if this is a ranked or a private room:
  // show a loader instead of flashing the private-room screen.
  if (!room) {
    return error ? (
      <div className="flex flex-col items-center gap-4 font-pixel py-12">
        <p className="text-pink text-xl text-center">{error}</p>
        <button onClick={() => navigate("/play")} className="text-neon text-xl uppercase hover:text-yellow">
          {t("back")}
        </button>
      </div>
    ) : (
      <ScreenLoading />
    );
  }

  // a duel against PIXEL_BOT runs like a ranked one (match found, vote, join), just without rating
  if (room.ranked || room.botMatch) {
    const bot = !!room.botMatch;
    const card = (p: (typeof players)[number] | undefined, mine: boolean) => (
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-36 sm:w-64">
        <span className={`font-pixel text-xs sm:text-xl text-center ${mine ? "text-neon" : "text-pink"}`}>
          {mine ? t("lb_you_label") : bot ? t("lb_bot_label") : t("lb_rival_label")}
        </span>
        <div className={`relative p-3 border-2 ${mine ? "border-neon shadow-neon" : "border-pink"}`}>
          {["-top-1.5 -left-1.5", "-top-1.5 -right-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((c) => (
            <span key={c} className={`absolute w-3 h-3 ${c} ${mine ? "bg-neon" : "bg-pink"}`} />
          ))}
          <Avatar
            className="w-28 h-28 sm:w-52 sm:h-52"
            iconClass={`text-8xl ${mine ? "text-neon" : "text-pink"}`}
            {...(p ? { userId: p.userId } : { src: null })}
          />
        </div>
        <span className="font-pixel text-yellow text-xl sm:text-3xl truncate max-w-full">{p?.nickname ?? "..."}</span>
        <span className="font-pixel text-pink text-xl">MMR {p?.rating ?? "---"}</span>
        <span className="font-pixel text-gray-400 text-xs sm:text-base text-center">
          {!mine && bot ? t("lb_bot_status") : p ? `${t("lb_connected")} \u00B7 ${p.ready ? t("ready").toUpperCase() : t("lb_awaiting")}` : t("lb_waiting")}
        </span>
      </div>
    );
    return (
      <>
        <div className="star-background" />
        <div className="flex flex-col items-center gap-6 sm:gap-8 mx-auto w-full px-4 font-pixel py-6 enter-up">
          <h1 className="text-yellow text-[12vw]/none sm:text-[80px]/none lg:text-[112px]/none text-glow-sm text-center">{t("lb_title")}</h1>
          <p className="text-neon text-base sm:text-2xl text-center">
            {bot ? t("lb_bot_sub") : t("lb_ranked_sub")}
          </p>
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
            <p className="text-yellow text-2xl sm:text-4xl text-center">{me?.ready ? t("lb_joined") : t("lb_join_within", { time: mm || "05:00" })}</p>
            <div className="w-full h-1 bg-neon" />
            {me?.ready ? (
              <p className="text-neon text-2xl text-center">{t("lb_waiting_rival")}<span className="blink-caret">...</span></p>
            ) : (
              <button
                onClick={handleReady}
                disabled={busy || !me || !voted || status !== "READY"}
                className="btn-arcade w-full py-3 bg-pink border-2 border-yellow text-black text-2xl sm:text-3xl disabled:opacity-40 disabled:pointer-events-none"
              >
                {busy ? t("lb_joining") : voted ? t("lb_join_match") : t("lb_pick_map")}
              </button>
            )}
            <p className="font-sans text-gray-400 text-base text-center">
              {me?.ready
                ? t("lb_hint_joined")
                : voted
                  ? t("lb_hint_voted")
                  : t("lb_hint_vote")}
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
        <h1 className="text-yellow text-[14vw]/none sm:text-[96px]/none lg:text-[136px]/none text-glow-sm text-center">{t("room_code")}</h1>
        <div className="flex items-center gap-4">
          <span className="text-pink text-[13vw]/none sm:text-[96px]/none tracking-widest text-glow-sm">{code}</span>
          <button onClick={copyCode} className="p-2 border border-pink text-pink text-3xl" title={t("copy")}>
            {copied ? <FaCheck /> : <FaCopy />}
          </button>
        </div>

        <p className="text-neon/80 text-sm sm:text-xl -mt-4 text-center">{t("lb_private_sub")}</p>

        {players.length < 2 && (
          <button
            onClick={shareInvite}
            className="btn-arcade flex items-center gap-3 uppercase text-xl sm:text-2xl px-6 py-2 border-2 border-neon text-yellow hover:text-glow-sm"
          >
            {linkCopied ? <FaCheck className="text-neon" /> : <FaLink className="text-neon" />}
            {linkCopied ? t("inv_link_copied") : t("inv_invite_friend")}
          </button>
        )}

        {left !== null && (
          <p className="text-center text-2xl text-yellow">
            {t("lb_join_within_caps")} <span className={left < 60 ? "text-pink" : "text-neon"}>{mm}</span>
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
                  <span className={`border p-0.5 ${p ? "border-neon" : "border-dashed border-neon/40"}`}>
                    {p ? (
                      <Avatar className="w-10 h-10" iconClass="text-xl text-neon" userId={p.userId} />
                    ) : (
                      // empty seat: a neutral placeholder, never the viewer's own picture
                      <span className="w-10 h-10 flex items-center justify-center text-neon/40 text-2xl">?</span>
                    )}
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
          disabled={busy || !me || me.ready || !voted || status !== "READY"}
          className="btn-arcade w-full uppercase text-3xl sm:text-4xl py-3 bg-pink border-2 border-yellow text-black disabled:opacity-40 disabled:pointer-events-none"
        >
          {me?.ready
            ? rival?.ready
              ? t("ready")
              : t("lb_waiting_rival_btn")
            : status !== "READY"
              ? t("waiting_player")
              : voted
                ? t("ready")
                : t("lb_pick_map")}
        </button>
        <button onClick={handleLeave} className="uppercase text-xl text-neon hover:text-yellow">
          {t("lb_leave")}
        </button>

        {error && <p className="text-pink text-xl text-center">{error}</p>}
      </div>
    </>
  );
};

export default function Lobby() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <LobbyScreen />}</ClientOnly>;
}
