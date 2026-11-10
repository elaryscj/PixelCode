// app/routes/play.tsx  —  /play : ranked matchmaking, or create / join a private room
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { ApiError, createRoom, getRoom, joinRoom, myRoom, type Room } from "~/api/room";
import { cancelQueue, joinQueue, queueStatus } from "~/api/matchmaking";
import { getCurrentUser, refreshUser } from "~/api/auth";
import Avatar from "~/components/Avatar";

const btn =
  "uppercase w-full text-3xl font-pixel py-2 px-6 text-center border-2 disabled:opacity-40 disabled:pointer-events-none";

const Play = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentUser());
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [waited, setWaited] = useState(0);
  const [inQueue, setInQueue] = useState(0);
  const [current, setCurrent] = useState<Room | null>(null);
  const [bannedUntil, setBannedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!bannedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [bannedUntil]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  // Fresh rating + "return to my match" (reconnect, US-33)
  useEffect(() => {
    let alive = true;
    refreshUser().then((u) => alive && u && setUser(u));
    if (getCurrentUser()) {
      myRoom()
        .then((r) => alive && setCurrent(r))
        .catch(() => {});
    }
    return () => {
      alive = false;
      stopPolling();
    };
  }, []);

  const goToRoom = (room: Room | string) => {
    const roomCode = typeof room === "string" ? room : room.code;
    const status = typeof room === "string" ? null : room.roomStatus;
    navigate(status === "PLAYING" ? `/play/${roomCode}/game` : `/play/${roomCode}`);
  };

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.data?.bannedUntil) {
      setNow(Date.now());
      setBannedUntil(Number(e.data.bannedUntil));
    }
    if (e instanceof ApiError && e.data?.roomCode) {
      // already in a match: offer to return to it
      myRoom().then(setCurrent).catch(() => {});
    }
    setError(e instanceof Error ? e.message : t("unexpected_error"));
  };

  const poll = useCallback(async () => {
    try {
      const s = await queueStatus();
      setInQueue(s.playersInQueue);
      setWaited(s.waitedSeconds ?? 0);
      if (s.state === "MATCHED" && s.roomCode) {
        stopPolling();
        setSearching(false);
        // a running match goes straight into the game, otherwise into the lobby
        const room = await getRoom(s.roomCode).catch(() => null);
        navigate(room?.roomStatus === "PLAYING" ? `/play/${s.roomCode}/game` : `/play/${s.roomCode}`);
      } else if (s.state === "IDLE") {
        stopPolling();
        setSearching(false);
      }
    } catch (e) {
      stopPolling();
      setSearching(false);
      fail(e);
    }
  }, [navigate]);

  const handleFind = async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await joinQueue();
      if (s.state === "MATCHED" && s.roomCode) {
        const room = await getRoom(s.roomCode).catch(() => null);
        navigate(room?.roomStatus === "PLAYING" ? `/play/${s.roomCode}/game` : `/play/${s.roomCode}`);
        return;
      }
      setSearching(true);
      setWaited(0);
      setInQueue(s.playersInQueue);
      stopPolling();
      timer.current = setInterval(poll, 1000);
      void poll();
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    stopPolling();
    setSearching(false);
    try {
      await cancelQueue();
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      goToRoom(await createRoom());
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return;
    setLoading(true);
    setError(null);
    try {
      goToRoom(await joinRoom(roomCode));
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  if (bannedUntil && bannedUntil > now) {
    const sec = Math.max(0, Math.round((bannedUntil - now) / 1000));
    const hms = [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
    return (
      <>
        <div className="grid-background" />
        <div className="mx-auto w-150 border-2 border-pink bg-[#090d1f] p-8 flex flex-col gap-6 font-pixel shadow-[0_0_30px_rgba(254,44,150,0.3)]">
          <div className="flex items-center justify-between border-b-2 border-pink pb-3 text-pink text-3xl">
            <span>&gt; MATCHMAKING BLOCKED</span>
            <span className="w-3 h-3 bg-pink" />
          </div>
          <h2 className="text-white text-5xl/tight">You are banned from matchmaking</h2>
          <p className="font-sans text-gray-400 text-lg">
            Matchmaking is temporarily unavailable for your account. You can play again when the restriction expires.
          </p>
          <div className="border border-pink p-5 flex items-center justify-between">
            <span className="font-sans text-gray-400 text-base">REMAINING DURATION</span>
            <span className="text-pink text-5xl">{hms}</span>
          </div>
          <p className="font-sans text-gray-500 text-sm">Restriction applies to ranked matchmaking only.</p>
          <Link to="/" className="text-center py-3 bg-pink border-2 border-yellow text-black text-2xl">
            Back to Menu
          </Link>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="star-background" />
        <h2 className="font-pixel text-4xl text-yellow text-glow-sm text-center">PLEASE LOG IN FIRST</h2>
        <Link to="/login" className={`${btn} max-w-100 bg-pink border-yellow text-black`}>
          LOG IN / REGISTER
        </Link>
      </div>
    );
  }

  if (searching) {
    return (
      <>
        <div className="grid-background" />
        <div className="star-background" />
        <div className="flex flex-col items-center gap-6 mx-auto w-full font-pixel mt-12">
          <div className="flex items-center gap-4 border border-neon bg-[#060816] px-4 py-2">
            <span className="border-2 border-pink p-1">
              <Avatar className="w-16 h-16" iconClass="text-4xl text-pink" />
            </span>
            <div className="text-left">
              <div className="text-yellow text-3xl">{user.username}</div>
              <div className="text-pink text-xl">MMR {user.rating}</div>
            </div>
          </div>
          <h1 className="text-yellow/80 text-[88px]/none md:text-[136px]/none text-glow-sm text-center">Finding a match</h1>
          <p className="text-pink text-4xl text-center">Warm your fingers)</p>
          <p className="text-neon text-xl text-center">
            {waited}s · {inQueue} in queue
          </p>
          <button onClick={handleCancel} className={`${btn} max-w-80 border-pink text-yellow`}>
            CANCEL
          </button>
          {error && <p className="text-pink text-xl text-center">{error}</p>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid-background" />
      <div className="star-background" />
      <div className="flex flex-col gap-6 mx-auto w-130 mt-4">
        <h1 className="font-pixel text-center text-glow-sm leading-none flex flex-col gap-4">
          <span className="text-yellow text-[104px]/none">CHOOSE</span>
          <span className="text-pink text-[104px]/none">MODE</span>
        </h1>

        {current && current.roomStatus !== "FINISHED" && (
          <button onClick={() => goToRoom(current)} className={`${btn} bg-neon border-yellow text-black`}>
            {current.roomStatus === "PLAYING" ? "Return to match" : "Return to lobby"} {current.code}
          </button>
        )}

        <button onClick={handleFind} disabled={loading} className={`${btn} bg-pink border-yellow text-black`}>
          QUICK PLAY
        </button>
        <button onClick={handleCreate} disabled={loading} className={`${btn} border-neon text-yellow`}>
          {t("create_room")}
        </button>

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <label htmlFor="room-code" className="font-pixel text-neon text-2xl">
            [{t("room_code")}]
          </label>
          <input
            id="room-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="..A1B2C3.."
            className="py-2 px-3 text-3xl tracking-widest text-center bg-transparent border-2 border-neon font-pixel text-yellow outline-none focus:border-glow-neon-sm"
          />
          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className={`${btn} border-neon text-yellow hover:text-glow-sm hover:border-glow-neon`}
          >
            {t("join_room")}
          </button>
        </form>

        {loading && <p className="font-pixel text-neon text-xl text-center">{t("loading")}</p>}
        {error && <p className="font-pixel text-pink text-xl text-center">{error}</p>}
      </div>
    </>
  );
};

export default Play;
