// app/routes/game.tsx
// Real-time duel: physics run in the browser, but doors, timers, finish and rating are decided by the server.
import { useState, useEffect, useRef, useCallback } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { Link, useParams, useNavigate } from "react-router";
import ChallengeModal from "~/components/game/ChallengeModal";
import GameResultModal from "~/components/game/GameResultModal";
import TouchControls from "~/components/game/TouchControls";
import { SkinArt } from "~/components/skins";
import { getCurrentUser, refreshUser } from "~/api/auth";
import { rematchRoom } from "~/api/room";
import { pingColor, pingLabel, usePing } from "~/lib/liveStats";
import { getToken } from "~/api/http";
import { onGameEvent, sendMove } from "~/api/socket";
import {
  finishMatch,
  getGameState,
  openDoor,
  type DoorChallenge,
  type GameState,
  type MatchResult,
} from "~/api/game";

import { MapLayer, animateMap } from "~/components/game/MapLayer";
import { GROUND_Y, getMap, worldTime, type MapDef } from "~/game/maps";
import {
  CHAR_H,
  CHAR_W,
  DOORS,
  createPlayer,
  doorRespawn,
  floorOf,
  respawn,
  stepPlayer,
  type CrumbleState,
} from "~/game/physics";

function toDeadlines(doors?: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  const now = Date.now();
  for (const [k, sec] of Object.entries(doors ?? {})) out[Number(k)] = now + sec * 1000;
  return out;
}

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

// Header above each arena: floor, player, rating and the running door timer
function PanelHeader({
  name,
  rating,
  floor,
  unlocked,
  doors,
  total,
  floors,
  tone,
}: {
  name: string;
  rating: number | null;
  floor: number;
  unlocked: number[];
  doors: Record<number, number>;
  total: number;
  floors: number;
  tone: "neon" | "pink";
}) {
  const next = [1, 2, 3, 4].find((n) => !unlocked.includes(n));
  const deadline = next !== undefined ? doors[next] : undefined;
  const left = deadline !== undefined ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : total;
  const state = next === undefined ? "CLEAR" : deadline !== undefined ? "ACTIVE" : "LOCKED";
  const badge =
    state === "CLEAR"
      ? "border-neon text-neon"
      : state === "ACTIVE"
        ? "border-yellow text-yellow"
        : "border-pink text-pink";
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-black/20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="leading-tight">
          <div className="text-[9px] text-gray-400 tracking-wider">FLOOR {floor} / {floors}</div>
          <div className={`text-sm truncate max-w-[140px] ${tone === "neon" ? "text-yellow" : "text-yellow"}`}>{name}</div>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 border ${tone === "neon" ? "border-neon text-neon" : "border-pink text-pink"}`}>
          MMR {rating ?? "..."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right leading-tight">
          <div className="text-[9px] text-gray-400 tracking-wider">DOOR TIMER</div>
          <div className={`text-sm ${state === "ACTIVE" && left <= 30 ? "text-pink animate-pulse" : "text-white"}`}>{fmt(left)}</div>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 border ${badge}`}>{state}</span>
      </div>
    </div>
  );
}

function GameScreen() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const token = getToken();
  const localPlayerName = me?.username ?? "Player";

  const [opponentName, setOpponentName] = useState("...");
  const [myRating, setMyRating] = useState(me?.rating ?? 1500);
  const [oppRating, setOppRating] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oppConnected, setOppConnected] = useState(true);
  const ping = usePing();
  // rematch: the rival's invitation (room code) and our own request in flight
  const [rematchOffer, setRematchOffer] = useState<string | null>(null);
  const [rematchBusy, setRematchBusy] = useState(false);

  // --- Match & Timing State (server time) ---
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [hazardHit, setHazardHit] = useState(false);

  const [unlockedCps, setUnlockedCps] = useState<number[]>([]);
  const [offline, setOffline] = useState(false);
  const [offlineLeft, setOfflineLeft] = useState(300);
  useEffect(() => {
    if (!offline) return;
    setOfflineLeft(300);
    const id = setInterval(() => setOfflineLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [offline]);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const [opponentUnlockedCps, setOpponentUnlockedCps] = useState<number[]>([]);

  const [activeChallenge, setActiveChallenge] = useState<DoorChallenge | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nearCheckpoint, setNearCheckpoint] = useState<number | null>(null);

  const gameOver = result !== null;
  const myId = me?.id ?? -1;

  // Refs so the 60fps loop and the event handlers always see the latest values
  const unlockedRef = useRef<number[]>([]);
  const gameOverRef = useRef(false);
  const modalRef = useRef(false);
  const nearRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const opponentIdRef = useRef<number | null>(null);
  unlockedRef.current = unlockedCps;
  gameOverRef.current = gameOver;
  modalRef.current = isModalOpen;
  nearRef.current = nearCheckpoint;

  // The server picks the map (same for both players); nothing moves until we know which one.
  const [map, setMap] = useState<MapDef | null>(null);
  const mapRef = useRef<MapDef | null>(null);
  const crumbleRef = useRef<CrumbleState>(new Map());
  const myArenaRef = useRef<HTMLDivElement | null>(null);
  const oppArenaRef = useRef<HTMLDivElement | null>(null);

  const playerState = useRef(createPlayer(getMap(0)));

  const playerDomRef = useRef<HTMLDivElement | null>(null);
  const opponentDomRef = useRef<HTMLDivElement | null>(null);
  const playerSpriteRef = useRef<HTMLDivElement | null>(null);
  const opponentSpriteRef = useRef<HTMLDivElement | null>(null);
  const opponentState = useRef({
    x: 100 - getMap(0).start.x - CHAR_W,
    y: getMap(0).start.y,
    targetX: 100 - getMap(0).start.x - CHAR_W,
    targetY: getMap(0).start.y,
  });
  // running door timers: door number -> local deadline (ms)
  const [myDoors, setMyDoors] = useState<Record<number, number>>({});
  const [oppDoors, setOppDoors] = useState<Record<number, number>>({});
  const [doorSecondsTotal, setDoorSecondsTotal] = useState(240);
  const [myFloor, setMyFloor] = useState(1);
  const [oppFloor, setOppFloor] = useState(1);
  const floorRef = useRef({ me: 1, opp: 1 });
  const [mySkin, setMySkin] = useState<string>("neon_ronin");
  const [oppSkin, setOppSkin] = useState<string>("neon_ronin");
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // ---------------------------------------------------------------- server state
  const applyState = useCallback(
    (st: GameState, restorePosition: boolean) => {
      if (st.status === "FINISHED" && st.result) {
        setResult(st.result);
        return;
      }
      if (!mapRef.current) {
        const m = getMap(st.mapId);
        mapRef.current = m;
        setMap(m);
        const fresh = createPlayer(m);
        Object.assign(playerState.current, fresh);
        Object.assign(opponentState.current, {
          x: 100 - m.start.x - CHAR_W,
          y: m.start.y,
          targetX: 100 - m.start.x - CHAR_W,
          targetY: m.start.y,
        });
      }
      const curMap = mapRef.current;
      if (st.me) {
        setUnlockedCps((prev) => Array.from(new Set([...prev, ...st.me!.unlocked])));
        setMyRating(st.me.rating);
        if (st.me.skin) setMySkin(st.me.skin);
        setMyDoors(toDeadlines(st.me.doors));
        // The last unlocked door is the respawn point
        const last = Math.max(0, ...st.me.unlocked);
        const cpCoord = curMap.doors.find((c) => c.num === last);
        if (cpCoord && restorePosition) {
          const r = doorRespawn(cpCoord);
          playerState.current.respawnX = r.x;
          playerState.current.respawnY = r.y;
        }
        if (restorePosition && (st.me.x > 0 || st.me.y > 0)) {
          // reconnect: continue from the last known position (US-33)
          playerState.current.x = st.me.x;
          playerState.current.y = Math.max(GROUND_Y, st.me.y);
        }
      }
      if (st.opponent) {
        opponentIdRef.current = st.opponent.userId;
        setOpponentName(st.opponent.nickname);
        setOppRating(st.opponent.rating);
        if (st.opponent.skin) setOppSkin(st.opponent.skin);
        setOppDoors(toDeadlines(st.opponent.doors));
        setOpponentUnlockedCps(st.opponent.unlocked);
        setOppConnected(st.opponent.connected);
      }
      if (st.doorSeconds) setDoorSecondsTotal(st.doorSeconds);
      if (st.maxSeconds !== undefined && st.elapsedSeconds !== undefined) {
        setMatchSeconds(Math.max(0, st.maxSeconds - st.elapsedSeconds));
      }
    },
    [],
  );

  // First load (also the reconnect path): restores doors, timers and position from the server
  useEffect(() => {
    if (!me || !token) {
      navigate("/login");
      return;
    }
    let alive = true;
    getGameState(code)
      .then((st) => {
        if (!alive) return;
        applyState(st, true);
      })
      .catch((e) => {
        if (!alive) return;
        const status = (e as any)?.status;
        if (status === 409) navigate(`/play/${code}`);
        else setLoadError(e instanceof Error ? e.message : "Could not load the match");
      });
    return () => {
      alive = false;
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll as a safety net (also keeps this player marked as present)
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      getGameState(code)
        .then((st) => applyState(st, false))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [code, gameOver, applyState]);

  // Local second-by-second display of the match timer
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => setMatchSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  // ---------------------------------------------------------------- live events (US-14)
  useEffect(() => {
    const off = onGameEvent(code, (data: any) => {
      if (!data) return;
      if (data.type === "MOVE" && data.userId !== myId) {
        // the opponent panel is the mirror image of the map
        opponentState.current.targetX = 100 - data.x - CHAR_W;
        opponentState.current.targetY = data.y;
        setOppConnected(true);
      } else if (data.type === "DOOR_UNLOCKED") {
        const drop = (prev: Record<number, number>) => {
          const next = { ...prev };
          delete next[data.cpNum];
          return next;
        };
        if (data.userId === myId) {
          setUnlockedCps((prev) => Array.from(new Set([...prev, data.cpNum])));
          setMyDoors(drop);
        } else {
          setOpponentUnlockedCps((prev) => Array.from(new Set([...prev, data.cpNum])));
          setOppDoors(drop);
        }
      } else if (data.type === "REMATCH" && data.userId !== myId && data.code) {
        setRematchOffer(String(data.code));
      } else if (data.type === "GAME_OVER" && data.result) {
        setResult(data.result);
      }
    });
    return off;
  }, [code, myId]);

  // After the match: fresh rating for the menu / leaderboard
  useEffect(() => {
    if (gameOver) void refreshUser();
  }, [gameOver]);

  // ---------------------------------------------------------------- actions
  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const triggerRespawn = () => {
    setHazardHit(true);
    setTimeout(() => setHazardHit(false), 400);
    respawn(playerState.current);
  };

  // US-16: ask the server for the challenge; this also starts the door timer
  const openChallenge = async (cpNum: number) => {
    if (gameOverRef.current || modalRef.current) return;
    if (unlockedRef.current.includes(cpNum)) return;
    try {
      const ch = await openDoor(code, cpNum, playerState.current.x, playerState.current.y);
      setMyDoors((prev) => ({ ...prev, [cpNum]: Date.now() + ch.secondsRemaining * 1000 }));
      setActiveChallenge(ch);
      setIsModalOpen(true);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Could not open the door");
    }
  };

  const handleChallengeSuccess = useCallback((cpNum: number) => {
    setIsModalOpen(false);
    setMyDoors((prev) => {
      const next = { ...prev };
      delete next[cpNum];
      return next;
    });
    setUnlockedCps((prev) => Array.from(new Set([...prev, cpNum])));
    const cpCoord = mapRef.current?.doors.find((c) => c.num === cpNum);
    if (cpCoord) {
      const r = doorRespawn(cpCoord);
      playerState.current.respawnX = r.x;
      playerState.current.respawnY = r.y;
    }
  }, []);

  // Rematch: opens a friendly room with the same rival (or joins the one they opened)
  const requestRematch = async () => {
    setRematchBusy(true);
    try {
      const room = await rematchRoom(code);
      navigate(`/play/${room.code}`);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Could not start a rematch");
      setRematchBusy(false);
    }
  };

  // US-15: at the exit the server checks that all doors are open and records the first finish
  const reachExit = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const res = await finishMatch(code, playerState.current.x, playerState.current.y);
      if (res.result) setResult(res.result);
    } catch (e) {
      finishingRef.current = false;
      showNotice(e instanceof Error ? e.message : "Could not finish");
    }
  };

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalRef.current) return;
      keysPressed.current[e.code] = true;
      if ((e.code === "KeyE" || e.code === "Enter") && nearRef.current) {
        void openChallenge(nearRef.current);
      }
      if (e.code === "KeyR") triggerRespawn();
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- 60 FPS loop (US-13)
  useEffect(() => {
    let animId: number;
    let frameCount = 0;

    let last = performance.now();

    let tPrev = worldTime();

    const loop = () => {
      const now = performance.now();
      // frame-rate independent: 120 Hz screens must not play twice as fast
      const dt = Math.min(2.5, Math.max(0.2, (now - last) / 16.667));
      last = now;
      const t = worldTime();
      const map = mapRef.current;

      if (!gameOverRef.current && map) {
        const p = playerState.current;
        const keys = keysPressed.current;
        const typing = modalRef.current;
        const input = typing
          ? { left: false, right: false, jump: false }
          : {
              left: !!(keys["KeyA"] || keys["ArrowLeft"]),
              right: !!(keys["KeyD"] || keys["ArrowRight"]),
              jump: !!(keys["Space"] || keys["KeyW"] || keys["ArrowUp"]),
            };

        const res = stepPlayer(p, input, map, unlockedRef.current, crumbleRef.current, t, tPrev, dt);
        if (res.hitHazard) triggerRespawn();
        if (res.nearDoor !== nearRef.current) setNearCheckpoint(res.nearDoor);
        // Exit: only counts when every door is open; the server confirms the win
        if (res.atExit) void reachExit();

        animateMap(myArenaRef.current, map, t, false, crumbleRef.current);
        animateMap(oppArenaRef.current, map, t, true, null);

        if (playerDomRef.current) {
          playerDomRef.current.style.left = `${p.x}%`;
          playerDomRef.current.style.bottom = `${p.y}%`;
        }
        if (playerSpriteRef.current) {
          const bob = p.isGrounded && Math.abs(p.vx) > 0.08 ? Math.abs(Math.sin(now / 90)) * 3 : 0;
          const squash = p.bounced < 8 ? ` scaleY(${1.25 - p.bounced * 0.03})` : "";
          playerSpriteRef.current.style.transform = `translateY(${-bob}px) scaleX(${p.facingLeft ? -1 : 1})${squash}`;
        }
        const fl = floorOf(map, p.y);
        if (fl !== floorRef.current.me) {
          floorRef.current.me = fl;
          setMyFloor(fl);
        }

        const opp = opponentState.current;
        const oppDx = opp.targetX - opp.x;
        opp.x += oppDx * 0.15;
        opp.y += (opp.targetY - opp.y) * 0.15;
        if (opponentDomRef.current) {
          opponentDomRef.current.style.left = `${opp.x}%`;
          opponentDomRef.current.style.bottom = `${opp.y}%`;
        }
        if (opponentSpriteRef.current && Math.abs(oppDx) > 0.05) {
          // the right panel is mirrored: moving "left" on the map is moving right here
          const bob = Math.abs(Math.sin(now / 90)) * 3;
          opponentSpriteRef.current.style.transform = `translateY(${-bob}px) scaleX(${oppDx > 0 ? 1 : -1})`;
        } else if (opponentSpriteRef.current) {
          opponentSpriteRef.current.style.transform = opponentSpriteRef.current.style.transform.replace(/translateY\([^)]*\)/, "translateY(0px)");
        }
        const oFl = floorOf(map, opp.targetY);
        if (oFl !== floorRef.current.opp) {
          floorRef.current.opp = oFl;
          setOppFloor(oFl);
        }

        // Position + heartbeat to the server (~7 times per second)
        frameCount++;
        if (frameCount % 8 === 0 && token) {
          void sendMove(token, code, p.x, p.y).catch(() => {});
        }
      }
      tPrev = t;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [code, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = Math.floor(matchSeconds / 60);
  const seconds = matchSeconds % 60;
  const timerDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className={`min-h-screen bg-[#050814] flex flex-col p-2 sm:p-4 md:p-6 short:p-1.5 font-pixel select-none relative ${
      hazardHit ? "animate-pulse filter hue-rotate-90" : ""
    }`}>
      
      {/* 1. Header (Logo, Ping, Room Info) */}
      <header className="flex justify-between items-center border-b border-neon/30 pb-3 mb-4 short:pb-1 short:mb-1">
        <div className="flex gap-6 items-center">
          <Link to="/play" className="text-yellow text-xl md:text-2xl leading-none hover:opacity-90 transition-opacity">
            PIXELCODE<br/><span className="text-pink text-xs">ARENA</span>
          </Link>
          <div className="hidden sm:flex text-neon text-[10px] md:text-xs border-l-2 border-neon/30 pl-4 uppercase items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            KZ-SERVER / <span className={pingColor(ping)}>{pingLabel(ping)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-gray-400 text-[10px] md:text-xs flex items-center gap-2 uppercase border border-pink/40 px-3 py-1 bg-pink/5">
            <span className="w-2 h-2 bg-pink inline-block animate-pulse"></span>
            RANKED DUEL #{code}
          </div>
          <Link
            to="/play"
            className="text-[10px] text-gray-500 hover:text-pink border border-gray-800 hover:border-pink px-2 py-1 transition-colors"
          >
            EXIT MATCH
          </Link>
        </div>
      </header>

      {/* 2. Scoreboard (Player 1, Timer, Opponent) */}
      <div className="flex justify-between items-center mb-4 gap-2 short:mb-1">
        
        {/* Local Player (Left) */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex justify-between items-start border-l-4 border-neon pl-3">
            <div>
              <h2 className="text-yellow text-xl md:text-3xl short:text-base uppercase truncate max-w-[180px]">{localPlayerName}</h2>
              <p className="text-neon/70 text-[9px] md:text-[10px]">MMR {myRating}</p>
            </div>
            <span className="border border-neon text-neon px-2 py-0.5 text-[9px] bg-neon/10">YOU</span>
          </div>

          {/* Checkpoint Indicators */}
          <div className="flex items-center gap-1.5 text-xs short:hidden">
            <span className="text-gray-400 text-[10px]">CP:</span>
            {[1, 2, 3, 4].map((num) => (
              <span
                key={num}
                className={`px-2 py-0.5 text-[10px] border transition-all ${
                  unlockedCps.includes(num)
                    ? "bg-neon text-black font-bold border-neon shadow-[0_0_10px_rgba(0,255,204,0.6)]"
                    : "border-neon/40 text-neon/40 bg-neon/5"
                }`}
              >
                {num}
              </span>
            ))}
            <span className="text-neon ml-2 text-[10px]">{unlockedCps.length} / {DOORS} SECURED</span>
          </div>
        </div>

        {/* Central Match Timer */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`text-3xl md:text-5xl tracking-widest font-mono text-glow-sm ${
            matchSeconds < 60 ? "text-pink animate-pulse" : "text-white"
          }`}>
            {timerDisplay}
          </div>
          <div className="text-yellow text-[9px] md:text-[10px] mt-1 uppercase tracking-wider text-center short:hidden">
            UNLOCK ALL 4 DOORS ➔ SECURE EXIT
          </div>
        </div>

        {/* Opponent (Right) */}
        <div className="flex-1 flex flex-col gap-1.5 items-end">
          <div className="flex justify-between items-start border-r-4 border-pink pr-3 w-full flex-row-reverse">
            <div className="text-right">
              <h2 className="text-yellow text-xl md:text-3xl short:text-base uppercase truncate max-w-[180px]">{opponentName}</h2>
              <p className="text-pink/70 text-[9px] md:text-[10px]">MMR {oppRating ?? "..."}</p>
            </div>
            <span className="border border-pink text-pink px-2 py-0.5 text-[9px] bg-pink/10">RIVAL</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-row-reverse short:hidden">
            <span className="text-gray-400 text-[10px]">:CP</span>
            {[1, 2, 3, 4].map((num) => (
              <span
                key={num}
                className={`px-2 py-0.5 text-[10px] border transition-all ${
                  opponentUnlockedCps.includes(num)
                    ? "bg-pink text-black font-bold border-pink shadow-[0_0_10px_rgba(255,0,128,0.6)]"
                    : "border-pink/40 text-pink/40 bg-pink/5"
                }`}
              >
                {num}
              </span>
            ))}
            <span className="text-pink mr-2 text-[10px]">{opponentUnlockedCps.length} / {DOORS} SECURED</span>
          </div>
        </div>

      </div>

      <div className="text-neon text-[10px] mb-2 flex justify-between items-center short:hidden">
        <span>{map ? `${map.name} · ${map.sector}` : "LOADING MAP..."}</span>
        <span className="text-gray-400">{map?.tagline ?? "SYMMETRIC DUEL · FIRST TO SOLVE ALL GATES WINS"}</span>
      </div>

      {/* 3. Dual-Panel Duel Arena */}
      <div
        className="w-full border-2 border-pink/60 p-1 relative flex bg-[#060c20] overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)]"
        style={{ height: "var(--arena-h)" }}
      >
        
        {/* Central Divider Beam */}
        <div className="absolute top-0 bottom-0 left-1/2 w-1.5 bg-gradient-to-b from-neon via-white to-pink -translate-x-1/2 z-30 opacity-75"></div>

        {/* ========================================================= */}
        {/* --- LEFT HALF: LOCAL PLAYER --- */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col border-[2px] border-neon/50 m-0.5 bg-[#081026] overflow-hidden">
          <PanelHeader
            name={localPlayerName}
            rating={myRating}
            floor={myFloor}
            unlocked={unlockedCps}
            doors={myDoors}
            total={doorSecondsTotal}
            floors={map?.floors.length ?? 5}
            tone="neon"
          />
          <div ref={myArenaRef} className="relative flex-1">
            {map && (
              <MapLayer map={map} mirror={false} unlocked={unlockedCps} doors={myDoors} tone="neon" nearCheckpoint={nearCheckpoint} />
            )}

            {/* LOCAL PLAYER (A/D move, Space jumps) */}
            <div
              ref={playerDomRef}
              className="absolute z-20 pointer-events-none"
              style={{
                left: `${playerState.current.x}%`,
                bottom: `${playerState.current.y}%`,
                width: `${CHAR_W}%`,
                height: `${CHAR_H}%`,
              }}
            >
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-0.5 text-[8px] text-neon whitespace-nowrap max-w-[90px] truncate bg-black/60 px-1 border border-neon/40">
                {localPlayerName}
              </div>
              <div ref={playerSpriteRef} className="w-full h-full">
                <SkinArt id={mySkin} size="small" className="w-full h-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* --- RIGHT HALF: OPPONENT (mirror of the same map) --- */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col border-[2px] border-pink/50 m-0.5 bg-[#180a1c] overflow-hidden">
          <PanelHeader
            name={opponentName}
            rating={oppRating}
            floor={oppFloor}
            unlocked={opponentUnlockedCps}
            doors={oppDoors}
            total={doorSecondsTotal}
            floors={map?.floors.length ?? 5}
            tone="pink"
          />
          <div ref={oppArenaRef} className="relative flex-1">
            {map && <MapLayer map={map} mirror unlocked={opponentUnlockedCps} doors={oppDoors} tone="pink" />}

            <div
              ref={opponentDomRef}
              className="absolute z-20 pointer-events-none"
              style={{
                left: `${opponentState.current.x}%`,
                bottom: `${opponentState.current.y}%`,
                width: `${CHAR_W}%`,
                height: `${CHAR_H}%`,
              }}
            >
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-0.5 text-[8px] text-pink whitespace-nowrap max-w-[90px] truncate bg-black/60 px-1 border border-pink/40">
                {opponentName}
              </div>
              <div ref={opponentSpriteRef} className="w-full h-full">
                <SkinArt id={oppSkin} size="small" className="w-full h-full" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Footer Controls & Status */}
      <footer className="flex flex-col sm:flex-row justify-between items-center mt-3 text-[10px] text-gray-400 uppercase gap-2 pointer-coarse:hidden">
        <div className="flex flex-wrap gap-4 items-center">
          <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">A / D</kbd> MOVE</span>
          <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">SPACE</kbd> JUMP</span>
          <span><kbd className="border border-neon text-neon px-2 py-0.5">E</kbd> INTERACT</span>
          <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">R</kbd> RESPAWN</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-neon"></div> CP GATE</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-pink"></div> SPIKE HAZARD</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-yellow"></div> EXIT PORTAL</span>
        </div>
      </footer>

      {/* Phones / tablets: on-screen gamepad + "turn your phone" hint */}
      <TouchControls
        keys={keysPressed.current}
        canInteract={nearCheckpoint !== null && !isModalOpen}
        onInteract={() => nearRef.current && void openChallenge(nearRef.current)}
        onRespawn={triggerRespawn}
      />
      <div className="hidden pointer-coarse:portrait:flex fixed inset-0 z-[55] flex-col items-center justify-center gap-6 bg-[#050814]/95 text-center px-8">
        <div className="text-7xl text-neon animate-bounce">⟳</div>
        <p className="text-yellow text-2xl">ROTATE YOUR PHONE</p>
        <p className="font-sans text-gray-400 text-sm">The arena is played in landscape.</p>
      </div>

      {/* 5. Door challenge (US-16 - US-21): checked by the server */}
      {activeChallenge && (
        <ChallengeModal
          roomCode={code}
          challenge={activeChallenge}
          isOpen={isModalOpen}
          serverUnlocked={unlockedCps.includes(activeChallenge.cpNum)}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleChallengeSuccess}
        />
      )}

      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-pink text-black px-4 py-2 text-xs border-2 border-yellow">
          {notice}
        </div>
      )}
      {!oppConnected && !gameOver && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-yellow text-black px-4 py-1 text-[10px] border-2 border-pink">
          OPPONENT DISCONNECTED - THEY HAVE 5 MINUTES TO RETURN
        </div>
      )}
      {offline && !gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 font-pixel">
          <div className="w-[92vw] max-w-140 border-2 border-pink bg-[#050816] p-6 sm:p-10 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(254,44,150,0.4)]">
            <h2 className="text-pink text-4xl">&#9632; RECONNECTING &#9632;</h2>
            <p className="font-sans text-white text-lg">Connection lost. Reconnect within 05:00</p>
            <div className="border-2 border-pink px-10 py-3 text-pink text-[56px]/none sm:text-[88px]/none">
              {`${String(Math.floor(offlineLeft / 60)).padStart(2, "0")}:${String(offlineLeft % 60).padStart(2, "0")}`}
            </div>
            <div className="w-full border border-neon/40 p-4 flex flex-col items-center gap-3">
              <span className="text-yellow text-xl">RECONNECTING TO SERVER...</span>
              <span className="w-full h-2 bg-neon/20"><span className="block h-full bg-pink animate-pulse w-1/3" /></span>
            </div>
            <p className="font-sans text-gray-400 text-sm">Match will be abandoned if timer expires</p>
          </div>
        </div>
      )}
      {loadError && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 text-pink">
          <p>{loadError}</p>
          <Link to="/play" className="border-2 border-neon text-neon px-4 py-2">BACK</Link>
        </div>
      )}

      {/* 6. Match result & rating (US-24, US-25) - numbers come from the server */}
      {result && (() => {
        const mine = result.players.find((p) => p.userId === myId);
        const opp = result.players.find((p) => p.userId !== myId);
        const mins = Math.floor(result.durationSeconds / 60);
        const secs = result.durationSeconds % 60;
        return (
          <GameResultModal
            isOpen
            isWinner={result.winnerUserId === myId}
            isDraw={result.winnerUserId === null}
            isTechnical={result.technical}
            playerNickname={mine?.nickname ?? localPlayerName}
            opponentNickname={opp?.nickname ?? opponentName}
            oldMmr={mine?.oldRating ?? myRating}
            mmrDelta={mine?.delta ?? 0}
            matchDuration={`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
            mySkin={mySkin}
            oppSkin={oppSkin}
            myCheckpoints={unlockedCps.length}
            oppCheckpoints={opponentUnlockedCps.length}
            myRoomCode={code}
            ranked={result.ranked ?? true}
            mapName={map?.name ?? (result.mapId != null ? getMap(result.mapId).name : undefined)}
            rematchOffered={!!rematchOffer}
            rematchBusy={rematchBusy}
            onRematch={requestRematch}
          />
        );
      })()}

    </div>
  );
}

export default function Game() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <GameScreen />}</ClientOnly>;
}
