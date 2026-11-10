// app/routes/game.tsx
// Real-time duel: physics run in the browser, but doors, timers, finish and rating are decided by the server.
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import ChallengeModal from "~/components/game/ChallengeModal";
import GameResultModal from "~/components/game/GameResultModal";
import { SkinArt } from "~/components/skins";
import { getCurrentUser, refreshUser } from "~/api/auth";
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

// --- Physics Constants (units: % of one arena panel, per 60 FPS frame) ---
const GRAVITY = 0.038;
const MOVE_SPEED = 0.42;
const JUMP_FORCE = 1.08; // peak ~14.8 units: every step of the map below is <= 11 units high
const FRICTION = 0.82;
const CHAR_W = 6; // Width in percentage
const CHAR_H = 11; // Height in percentage
const PLATFORM_H = 2.6; // drawn thickness (collision is one-way, on the top edge)
const GROUND_Y = 3;

// "Mirror circuit" (see the design): 5 floors connected by small ledges. `y` is the TOP of the platform.
// Both players get the same map (US-12); the right panel is its mirror.
interface PlatformDef {
  x: number;
  y: number;
  w: number;
}

const PLATFORMS: PlatformDef[] = [
  { x: 0, y: GROUND_Y, w: 100 }, // F1 ground
  { x: 84.5, y: 12.5, w: 15.5 }, // ledge F1 -> F2
  { x: 0, y: 22, w: 79 }, // F2
  { x: 0, y: 31.5, w: 17 }, // ledge F2 -> F3
  { x: 24, y: 41.5, w: 76 }, // F3
  { x: 46, y: 51, w: 17 }, // ledge F3 -> F4
  { x: 0, y: 61, w: 39 }, // F4 (left)
  { x: 54, y: 61, w: 46 }, // F4 (right)
  { x: 0, y: 70.5, w: 17 }, // ledge F4 -> F5
  { x: 20.5, y: 80, w: 79.5 }, // F5
];

const FLOOR_LABELS = [
  { label: "F1", y: GROUND_Y },
  { label: "F2", y: 22 },
  { label: "F3", y: 41.5 },
  { label: "F4", y: 61 },
  { label: "F5", y: 80 },
];

// Locked doors block the way to the next ledge until the challenge is solved.
const DOOR_W = 6.5;
const DOOR_H = 10;
const BARRIER_H = 18; // taller than a jump, so a locked door cannot be hopped over
const CHECKPOINT_COORDS = [
  { num: 1, x: 45, y: 22 },
  { num: 2, x: 32, y: 41.5 },
  { num: 3, x: 23, y: 61 },
  { num: 4, x: 60, y: 80 },
];

const HAZARDS = [
  { x: 61, y: 22, w: 9 },
  { x: 36, y: 80, w: 9 },
];

const EXIT_POS = { x: 75, y: 80, w: 22, h: 12 };
const DOORS = 4;
const START = { x: 4, y: GROUND_Y };

function toDeadlines(doors?: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  const now = Date.now();
  for (const [k, sec] of Object.entries(doors ?? {})) out[Number(k)] = now + sec * 1000;
  return out;
}

const floorOf = (y: number) => FLOOR_LABELS.filter((f) => f.y <= y + 0.5).length || 1;

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

// One arena: platforms, doors, spikes and the finish. `mirror` flips the map for the opponent panel.
function MapLayer({
  mirror,
  unlocked,
  doors,
  tone,
  nearCheckpoint = null,
}: {
  mirror: boolean;
  unlocked: number[];
  doors: Record<number, number>;
  tone: "neon" | "pink";
  nearCheckpoint?: number | null;
}) {
  const mx = (x: number, w = 0) => (mirror ? 100 - x - w : x);
  const line = tone === "neon" ? "border-neon bg-neon/15" : "border-pink bg-pink/15";
  const tick = tone === "neon" ? "bg-neon/40" : "bg-pink/40";
  const allOpen = unlocked.length >= DOORS;

  return (
    <>
      {/* side walls */}
      <div className="absolute top-0 bottom-0 left-0 w-[1.6%] bg-[#10213d] border-r border-neon/30 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-[1.6%] bg-[#10213d] border-l border-neon/30 pointer-events-none" />

      {/* floor labels */}
      {FLOOR_LABELS.map((f) => (
        <span
          key={f.label}
          className="absolute text-[9px] text-white/25 pointer-events-none"
          style={{ [mirror ? "right" : "left"]: "3%", bottom: `${f.y + PLATFORM_H}%` }}
        >
          {f.label}
        </span>
      ))}

      {/* Platforms */}
      {PLATFORMS.map((p, i) => (
        <div
          key={i}
          className={`absolute border-t-2 ${line} flex items-center justify-around overflow-hidden pointer-events-none`}
          style={{ left: `${mx(p.x, p.w)}%`, bottom: `${p.y - PLATFORM_H}%`, width: `${p.w}%`, height: `${PLATFORM_H}%` }}
        >
          {[...Array(Math.floor(p.w / 5))].map((_, j) => (
            <div key={j} className={`h-full w-1 ${tick}`}></div>
          ))}
        </div>
      ))}

      {/* Security doors: sealed -> timer running -> open. A locked door is a wall; it opens only with E next to it. */}
      {CHECKPOINT_COORDS.map((cp) => {
        const isUnlocked = unlocked.includes(cp.num);
        const isActive = !isUnlocked && cp.num in doors;
        const near = !mirror && nearCheckpoint === cp.num;
        const src = isUnlocked ? "/doors/door-open.png" : isActive ? "/doors/door-active.png" : "/doors/door-locked.png";
        return (
          <div key={cp.num} className="pointer-events-none">
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute"
              style={{
                left: `${mx(cp.x, DOOR_W)}%`,
                bottom: `${cp.y}%`,
                width: `${DOOR_W}%`,
                height: `${DOOR_H}%`,
                objectFit: "fill",
                imageRendering: "pixelated",
                filter: isActive
                  ? "drop-shadow(0 0 6px #facc15)"
                  : near
                    ? "drop-shadow(0 0 8px #01E4FF)"
                    : isUnlocked
                      ? "none"
                      : "drop-shadow(0 0 3px rgba(255,42,133,0.7))",
              }}
            />
            <span
              className={`absolute text-[8px] leading-none ${isUnlocked ? "text-emerald-300" : "text-white/60"}`}
              style={{
                left: `${mx(cp.x, DOOR_W)}%`,
                width: `${DOOR_W}%`,
                textAlign: "center",
                bottom: `${cp.y + DOOR_H + 0.6}%`,
              }}
            >
              CP{cp.num}
            </span>

            {/* "press E" bubble above the door you are standing at */}
            {near && !isUnlocked && (
              <span
                className="absolute z-30 flex items-center justify-center w-6 h-6 bg-yellow text-black text-xs font-bold border-2 border-black animate-bounce"
                style={{
                  left: `${mx(cp.x + DOOR_W / 2)}%`,
                  transform: "translateX(-50%)",
                  bottom: `${cp.y + DOOR_H + 4}%`,
                }}
              >
                E
              </span>
            )}

            {/* laser wall: this is what actually blocks movement */}
            {!isUnlocked && (
              <div
                className="absolute bg-gradient-to-t from-pink via-red-500 to-pink opacity-60 animate-pulse"
                style={{
                  left: `${mx(cp.x + DOOR_W / 2 - 0.4, 0.8)}%`,
                  bottom: `${cp.y + DOOR_H}%`,
                  width: "0.8%",
                  height: `${BARRIER_H - DOOR_H}%`,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Spikes */}
      {HAZARDS.map((h, i) => (
        <div
          key={i}
          className="absolute flex items-end justify-between pointer-events-none"
          style={{ left: `${mx(h.x, h.w)}%`, bottom: `${h.y}%`, width: `${h.w}%`, height: "4%" }}
        >
          {[...Array(Math.floor(h.w / 2.2))].map((_, j) => (
            <div
              key={j}
              className="w-2 h-full bg-pink"
              style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
            ></div>
          ))}
        </div>
      ))}

      {/* FINISH */}
      <div
        className="absolute flex flex-col items-center justify-end pointer-events-none"
        style={{
          left: `${mx(EXIT_POS.x, EXIT_POS.w)}%`,
          bottom: `${EXIT_POS.y}%`,
          width: `${EXIT_POS.w}%`,
          height: `${EXIT_POS.h}%`,
        }}
      >
        <span className={`text-[10px] mb-1 ${allOpen ? "text-yellow text-glow-sm animate-pulse" : "text-gray-500"}`}>
          {allOpen ? "FINISH" : `FINISH ${unlocked.length}/${DOORS}`}
        </span>
        <div
          className={`w-full h-4 border ${allOpen ? "border-yellow shadow-[0_0_14px_rgba(255,215,0,0.8)]" : "border-gray-600 opacity-50"}`}
          style={{ background: "repeating-conic-gradient(#facc15 0% 25%, #111827 0% 50%) 0 0 / 16px 16px" }}
        />
      </div>
    </>
  );
}

// Header above each arena: floor, player, rating and the running door timer
function PanelHeader({
  name,
  rating,
  floor,
  unlocked,
  doors,
  total,
  tone,
}: {
  name: string;
  rating: number | null;
  floor: number;
  unlocked: number[];
  doors: Record<number, number>;
  total: number;
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
          <div className="text-[9px] text-gray-400 tracking-wider">FLOOR {floor} / 5</div>
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

export default function Game() {
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

  const playerState = useRef({
    x: START.x,
    y: START.y,
    vx: 0,
    vy: 0,
    isGrounded: true,
    facingLeft: false,
    respawnX: START.x,
    respawnY: START.y,
    coyote: 0,
  });

  const playerDomRef = useRef<HTMLDivElement | null>(null);
  const opponentDomRef = useRef<HTMLDivElement | null>(null);
  const playerSpriteRef = useRef<HTMLDivElement | null>(null);
  const opponentSpriteRef = useRef<HTMLDivElement | null>(null);
  const opponentState = useRef({
    x: 100 - START.x - CHAR_W,
    y: START.y,
    targetX: 100 - START.x - CHAR_W,
    targetY: START.y,
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
      if (st.me) {
        setUnlockedCps((prev) => Array.from(new Set([...prev, ...st.me!.unlocked])));
        setMyRating(st.me.rating);
        if (st.me.skin) setMySkin(st.me.skin);
        setMyDoors(toDeadlines(st.me.doors));
        // The last unlocked door is the respawn point
        const last = Math.max(0, ...st.me.unlocked);
        const cpCoord = CHECKPOINT_COORDS.find((c) => c.num === last);
        if (cpCoord) {
          playerState.current.respawnX = cpCoord.x + DOOR_W + 1;
          playerState.current.respawnY = cpCoord.y;
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
    const p = playerState.current;
    p.x = p.respawnX;
    p.y = p.respawnY;
    p.vx = 0;
    p.vy = 0;
  };

  // US-16: ask the server for the challenge; this also starts the door timer
  const openChallenge = async (cpNum: number) => {
    if (gameOverRef.current || modalRef.current) return;
    if (unlockedRef.current.includes(cpNum)) return;
    try {
      const ch = await openDoor(code, cpNum);
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
    const cpCoord = CHECKPOINT_COORDS.find((c) => c.num === cpNum);
    if (cpCoord) {
      playerState.current.respawnX = cpCoord.x + DOOR_W + 1;
      playerState.current.respawnY = cpCoord.y;
    }
  }, []);

  // US-15: at the exit the server checks that all doors are open and records the first finish
  const reachExit = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const res = await finishMatch(code);
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

    const loop = () => {
      const now = performance.now();
      // frame-rate independent: 120 Hz screens must not play twice as fast
      const dt = Math.min(2.5, Math.max(0.2, (now - last) / 16.667));
      last = now;

      if (!gameOverRef.current) {
        const p = playerState.current;
        const keys = keysPressed.current;
        const unlocked = unlockedRef.current;
        const typing = modalRef.current;

        if (!typing) {
          if (keys["KeyA"] || keys["ArrowLeft"]) {
            p.vx -= MOVE_SPEED * 0.25 * dt;
            p.facingLeft = true;
          }
          if (keys["KeyD"] || keys["ArrowRight"]) {
            p.vx += MOVE_SPEED * 0.25 * dt;
            p.facingLeft = false;
          }
          if ((keys["Space"] || keys["KeyW"] || keys["ArrowUp"]) && (p.isGrounded || p.coyote > 0)) {
            p.vy = JUMP_FORCE;
            p.isGrounded = false;
            p.coyote = 0;
          }
        }

        p.vx *= Math.pow(FRICTION, dt);
        p.vy -= GRAVITY * dt;

        const prevX = p.x;
        const prevY = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < 1) {
          p.x = 1;
          p.vx = 0;
        }
        if (p.x > 100 - CHAR_W - 1) {
          p.x = 100 - CHAR_W - 1;
          p.vx = 0;
        }

        // A locked door is a solid wall from both sides (US-13)
        for (const cp of CHECKPOINT_COORDS) {
          if (unlocked.includes(cp.num)) continue;
          const left = cp.x;
          const right = cp.x + DOOR_W;
          const sameHeight = p.y < cp.y + BARRIER_H && p.y + CHAR_H > cp.y + 1;
          if (sameHeight && p.x + CHAR_W > left && p.x < right) {
            if (prevX + CHAR_W <= left + 0.01) {
              p.x = left - CHAR_W;
              p.vx = Math.min(p.vx, 0);
            } else if (prevX >= right - 0.01) {
              p.x = right;
              p.vx = Math.max(p.vx, 0);
            }
          }
        }

        // One-way platforms: land on the top edge when falling
        p.isGrounded = false;
        let standingOn: PlatformDef | null = null;
        for (const plat of PLATFORMS) {
          const horizontallyInside = p.x + CHAR_W > plat.x + 0.5 && p.x < plat.x + plat.w - 0.5;
          if (horizontallyInside && prevY >= plat.y - 0.6 && p.y <= plat.y && p.vy <= 0) {
            p.y = plat.y;
            p.vy = 0;
            p.isGrounded = true;
            standingOn = plat;
            break;
          }
        }

        if (p.y < GROUND_Y) {
          p.y = GROUND_Y;
          p.vy = 0;
          p.isGrounded = true;
        }
        // a few frames of grace after walking off an edge
        p.coyote = p.isGrounded ? 5 : Math.max(0, p.coyote - dt);
        if (p.y > 92) {
          p.y = 92;
          p.vy = Math.min(p.vy, 0);
        }

        // Spikes send you back to the last safe spot (not to the very start)
        let hitHazard = false;
        for (const h of HAZARDS) {
          if (p.x + CHAR_W > h.x + 1 && p.x < h.x + h.w - 1 && p.y <= h.y + 3 && p.y >= h.y - 1) {
            hitHazard = true;
            break;
          }
        }
        if (hitHazard) {
          triggerRespawn();
        } else if (p.isGrounded && standingOn && standingOn.w >= 30) {
          const nearSpikes = HAZARDS.some(
            (h) => Math.abs(p.y - h.y) < 1 && p.x + CHAR_W > h.x - 5 && p.x < h.x + h.w + 5,
          );
          if (!nearSpikes) {
            p.respawnX = p.x;
            p.respawnY = p.y;
          }
        }

        // Proximity prompt for the next locked door
        let activeNearCp: number | null = null;
        for (const cp of CHECKPOINT_COORDS) {
          if (!unlocked.includes(cp.num)) {
            const dx = Math.abs(p.x + CHAR_W / 2 - (cp.x + DOOR_W / 2));
            if (dx < 10 && Math.abs(p.y - cp.y) < 6) {
              activeNearCp = cp.num;
              break;
            }
          }
        }
        if (activeNearCp !== nearRef.current) setNearCheckpoint(activeNearCp);

        // Exit: only counts when every door is open; the server confirms the win
        if (
          unlocked.length >= DOORS &&
          p.x + CHAR_W >= EXIT_POS.x &&
          p.x <= EXIT_POS.x + EXIT_POS.w &&
          p.y >= EXIT_POS.y - 0.5 &&
          p.y <= EXIT_POS.y + EXIT_POS.h
        ) {
          void reachExit();
        }

        if (playerDomRef.current) {
          playerDomRef.current.style.left = `${p.x}%`;
          playerDomRef.current.style.bottom = `${p.y}%`;
        }
        if (playerSpriteRef.current) {
          const bob = p.isGrounded && Math.abs(p.vx) > 0.08 ? Math.abs(Math.sin(now / 90)) * 3 : 0;
          playerSpriteRef.current.style.transform = `translateY(${-bob}px) scaleX(${p.facingLeft ? -1 : 1})`;
        }
        const fl = floorOf(p.y);
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
        const oFl = floorOf(opp.targetY);
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
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [code, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = Math.floor(matchSeconds / 60);
  const seconds = matchSeconds % 60;
  const timerDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className={`min-h-screen bg-[#050814] flex flex-col p-4 md:p-6 font-pixel select-none relative ${
      hazardHit ? "animate-pulse filter hue-rotate-90" : ""
    }`}>
      
      {/* 1. Header (Logo, Ping, Room Info) */}
      <header className="flex justify-between items-center border-b border-neon/30 pb-3 mb-4">
        <div className="flex gap-6 items-center">
          <Link to="/play" className="text-yellow text-xl md:text-2xl leading-none hover:opacity-90 transition-opacity">
            PIXELCODE<br/><span className="text-pink text-xs">ARENA</span>
          </Link>
          <div className="hidden sm:flex text-neon text-[10px] md:text-xs border-l-2 border-neon/30 pl-4 uppercase items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            KZ-SERVER / 18 MS
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
      <div className="flex justify-between items-center mb-4 gap-2">
        
        {/* Local Player (Left) */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex justify-between items-start border-l-4 border-neon pl-3">
            <div>
              <h2 className="text-yellow text-xl md:text-3xl uppercase truncate max-w-[180px]">{localPlayerName}</h2>
              <p className="text-neon/70 text-[9px] md:text-[10px]">MMR {myRating}</p>
            </div>
            <span className="border border-neon text-neon px-2 py-0.5 text-[9px] bg-neon/10">YOU</span>
          </div>

          {/* Checkpoint Indicators */}
          <div className="flex items-center gap-1.5 text-xs">
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
          <div className="text-yellow text-[9px] md:text-[10px] mt-1 uppercase tracking-wider text-center">
            UNLOCK ALL 4 DOORS ➔ SECURE EXIT
          </div>
        </div>

        {/* Opponent (Right) */}
        <div className="flex-1 flex flex-col gap-1.5 items-end">
          <div className="flex justify-between items-start border-r-4 border-pink pr-3 w-full flex-row-reverse">
            <div className="text-right">
              <h2 className="text-yellow text-xl md:text-3xl uppercase truncate max-w-[180px]">{opponentName}</h2>
              <p className="text-pink/70 text-[9px] md:text-[10px]">MMR {oppRating ?? "..."}</p>
            </div>
            <span className="border border-pink text-pink px-2 py-0.5 text-[9px] bg-pink/10">RIVAL</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-row-reverse">
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

      <div className="text-neon text-[10px] mb-2 flex justify-between items-center">
        <span>MIRROR CIRCUIT · SECTOR 04</span>
        <span className="text-gray-400">SYMMETRIC DUEL · FIRST TO SOLVE ALL GATES WINS</span>
      </div>

      {/* 3. Dual-Panel Duel Arena */}
      <div
        className="w-full border-2 border-pink/60 p-1 relative flex bg-[#060c20] overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)]"
        style={{ height: "max(520px, calc(100vh - 380px))" }}
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
            tone="neon"
          />
          <div className="relative flex-1">
            <MapLayer mirror={false} unlocked={unlockedCps} doors={myDoors} tone="neon" nearCheckpoint={nearCheckpoint} />

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
            tone="pink"
          />
          <div className="relative flex-1">
            <MapLayer mirror unlocked={opponentUnlockedCps} doors={oppDoors} tone="pink" />

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
      <footer className="flex flex-col sm:flex-row justify-between items-center mt-3 text-[10px] text-gray-400 uppercase gap-2">
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
          <div className="w-140 border-2 border-pink bg-[#050816] p-10 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(254,44,150,0.4)]">
            <h2 className="text-pink text-4xl">&#9632; RECONNECTING &#9632;</h2>
            <p className="font-sans text-white text-lg">Connection lost. Reconnect within 05:00</p>
            <div className="border-2 border-pink px-10 py-3 text-pink text-[88px]/none">
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
          />
        );
      })()}

    </div>
  );
}
