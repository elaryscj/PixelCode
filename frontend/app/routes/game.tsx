// app/routes/game.tsx
// Real-time duel: physics run in the browser, but doors, timers, finish and rating are decided by the server.
import { useServerLabel } from "~/lib/serverRegion";
import { useState, useEffect, useRef, useCallback } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { Link, useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ChallengeModal from "~/components/game/ChallengeModal";
import GameResultModal from "~/components/game/GameResultModal";
import PhraseBar, { Bubble, PHRASES, isPhrase, type PhraseId } from "~/components/game/PhraseBar";
import TouchControls from "~/components/game/TouchControls";
import { burst, confetti, flash, floatIcon, shake } from "~/components/game/fx";
import { sfx } from "~/lib/sfx";
import { AnimatedSkin, type AnimId, type SkinHandle } from "~/components/skins";
import type { EmoteId } from "~/game/skinRig";
import { getCurrentUser, refreshUser } from "~/api/auth";
import { getRoom, rematchRoom } from "~/api/room";
import { pingColor, pingLabel, usePing } from "~/lib/liveStats";
import { getToken } from "~/api/http";
import { onGameEvent, sendMove } from "~/api/socket";
import {
  finishMatch,
  sendEmote,
  sendPhrase,
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
  DOOR_W,
  createPlayer,
  doorRespawn,
  floorOf,
  respawn,
  stepPlayer,
  type CrumbleState,
} from "~/game/physics";

/** how long an emote plays, and the shortest gap between two (the server enforces the same gap) */
const EMOTE_MS = 1900;
const EMOTE_GAP_MS = 1500;

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
  const { t } = useTranslation();
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
          <div className="text-[9px] text-gray-400 tracking-wider">{t("g_floor")} {floor} / {floors}</div>
          <div className={`text-sm truncate max-w-[140px] ${tone === "neon" ? "text-yellow" : "text-yellow"}`}>{name}</div>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 border ${tone === "neon" ? "border-neon text-neon" : "border-pink text-pink"}`}>
          MMR {rating ?? "..."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right leading-tight">
          <div className="text-[9px] text-gray-400 tracking-wider">{t("cm_door_timer")}</div>
          <div className={`text-sm ${state === "ACTIVE" && left <= 30 ? "text-pink animate-pulse" : "text-white"}`}>{fmt(left)}</div>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 border ${badge}`}>{t(`g_state_${state.toLowerCase()}`)}</span>
      </div>
    </div>
  );
}

function GameScreen() {
  const { t } = useTranslation();
  const serverLabel = useServerLabel();
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
  // which animation each figure plays (walk / jump / think ...), set from the game loop without re-rendering
  const mySkinRef = useRef<SkinHandle | null>(null);
  const oppSkinRef = useRef<SkinHandle | null>(null);
  const oppUnlockedRef = useRef<number[]>([]);
  // an emote plays for a moment unless the figure moves (then the movement animation wins)
  const myEmote = useRef<{ anim: EmoteId | null; until: number; sentAt: number }>({ anim: null, until: 0, sentAt: 0 });
  const oppEmote = useRef<{ anim: EmoteId | null; until: number }>({ anim: null, until: 0 });
  // quick phrases: a speech bubble over each figure for a moment
  const [myBubble, setMyBubble] = useState<{ p: PhraseId; id: number } | null>(null);
  const [oppBubble, setOppBubble] = useState<{ p: PhraseId; id: number } | null>(null);
  const lastPhraseAt = useRef(0);
  const showBubble = (who: "me" | "opp", p: PhraseId) => {
    const b = { p, id: Date.now() };
    (who === "me" ? setMyBubble : setOppBubble)(b);
    setTimeout(() => (who === "me" ? setMyBubble : setOppBubble)((cur) => (cur?.id === b.id ? null : cur)), 2600);
  };
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
  const arenaWrapRef = useRef<HTMLDivElement | null>(null);
  // doors we already celebrated (socket + poll can report the same door twice)
  const celebratedRef = useRef({ me: new Set<number>(), opp: new Set<number>(), loaded: false });
  const [banner, setBanner] = useState<{ text: string; tone: "neon" | "pink" | "yellow"; id: number } | null>(null);
  const showBanner = useCallback((text: string, tone: "neon" | "pink" | "yellow", ms = 1600) => {
    const id = Date.now();
    setBanner({ text, tone, id });
    setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), ms);
  }, []);

  // ---------------------------------------------------------------- juice
  const doorCenter = (cpNum: number) => {
    const d = mapRef.current?.doors.find((c) => c.num === cpNum);
    return d ? { x: d.x + DOOR_W / 2, y: d.y + 6 } : null;
  };
  const celebrateMine = (cpNum: number) => {
    const c = celebratedRef.current;
    if (c.me.has(cpNum)) return;
    c.me.add(cpNum);
    if (!c.loaded) return;
    const at = doorCenter(cpNum);
    if (at) burst(myArenaRef.current, at.x, at.y, { color: "#01E4FF", count: 26, spread: 90 });
    flash(myArenaRef.current, "rgba(1,228,255,0.3)");
    sfx.doorOpen();
    const left = DOORS - c.me.size;
    showBanner(left > 0 ? t("g_gate_secured", { n: cpNum }) : t("g_all_open"), left > 0 ? "neon" : "yellow");
  };
  const celebrateRival = (cpNum: number) => {
    const c = celebratedRef.current;
    if (c.opp.has(cpNum)) return;
    c.opp.add(cpNum);
    if (!c.loaded) return;
    const at = doorCenter(cpNum);
    if (at) burst(oppArenaRef.current, 100 - at.x, at.y, { color: "#FE2C96", count: 18, spread: 70 });
    flash(oppArenaRef.current, "rgba(254,44,150,0.3)");
    sfx.rivalDoor();
    showBanner(t("g_rival_cracked", { n: cpNum }), "pink", 1300);
  };

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
        st.me.unlocked.forEach(celebrateMine);
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
        st.opponent.unlocked.forEach(celebrateRival);
        setOpponentUnlockedCps(st.opponent.unlocked);
        setOppConnected(st.opponent.connected);
      }
      if (!celebratedRef.current.loaded) {
        celebratedRef.current.loaded = true;
        if ((st.elapsedSeconds ?? 0) < 8) {
          sfx.fight();
          showBanner(t("g_fight"), "yellow", 1200);
        }
      }
      if (st.doorSeconds) setDoorSecondsTotal(st.doorSeconds);
      if (st.maxSeconds !== undefined && st.elapsedSeconds !== undefined) {
        setMatchSeconds(Math.max(0, st.maxSeconds - st.elapsedSeconds));
      }
    },
    [],
  );

  // Ranked queue match or private room (only for the header label)
  const [ranked, setRanked] = useState<boolean | null>(null);
  const [botMatch, setBotMatch] = useState(false);
  useEffect(() => {
    let alive = true;
    getRoom(code)
      .then((r) => {
        if (!alive) return;
        setRanked(r.ranked ?? true);
        setBotMatch(!!r.botMatch);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code]);

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
        else setLoadError(e instanceof Error ? e.message : t("g_err_load"));
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

  // Last ten seconds: a clock tick every second
  useEffect(() => {
    if (!gameOver && matchSeconds > 0 && matchSeconds <= 10) sfx.tick();
  }, [matchSeconds, gameOver]);

  oppUnlockedRef.current = opponentUnlockedCps;

  // Result sting: fanfare + confetti for a win, a falling tune for a loss
  useEffect(() => {
    if (!result) return;
    const draw = result.winnerUserId === null;
    const iWon = result.winnerUserId === myId;
    mySkinRef.current?.setAnim(draw ? "idle" : iWon ? "win" : "lose");
    oppSkinRef.current?.setAnim(draw ? "idle" : iWon ? "lose" : "win");
    if (result.winnerUserId === null) return;
    if (result.winnerUserId === myId) {
      sfx.victory();
      confetti();
    } else {
      sfx.defeat();
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

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
          celebrateMine(data.cpNum);
          setUnlockedCps((prev) => Array.from(new Set([...prev, data.cpNum])));
          setMyDoors(drop);
        } else {
          celebrateRival(data.cpNum);
          setOpponentUnlockedCps((prev) => Array.from(new Set([...prev, data.cpNum])));
          setOppDoors(drop);
        }
      } else if (data.type === "EMOTE" && data.userId !== myId && (data.emote === "wave" || data.emote === "dance")) {
        oppEmote.current = { anim: data.emote, until: performance.now() + EMOTE_MS };
        const o = opponentState.current;
        floatIcon(oppArenaRef.current, o.x + CHAR_W / 2, o.y + CHAR_H + 1, data.emote === "wave" ? "heart" : "notes");
        if (data.emote === "wave") sfx.wave(true);
        else sfx.dance(true);
      } else if (data.type === "PHRASE" && data.userId !== myId && isPhrase(data.phrase)) {
        showBubble("opp", data.phrase);
        sfx.wave(true);
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
    const p = playerState.current;
    burst(myArenaRef.current, p.x + CHAR_W / 2, p.y + 4, { color: "#FE2C96", count: 22, spread: 60 });
    shake(arenaWrapRef.current, 10);
    sfx.hazard();
    navigator.vibrate?.(60);
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
      showNotice(e instanceof Error ? e.message : t("g_err_door"));
    }
  };

  const handleChallengeSuccess = useCallback((cpNum: number) => {
    setIsModalOpen(false);
    celebrateMine(cpNum);
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
      showNotice(e instanceof Error ? e.message : t("g_err_rematch"));
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
      showNotice(e instanceof Error ? e.message : t("g_err_finish"));
    }
  };

  // ---------------------------------------------------------------- emotes
  const emote = (e: EmoteId) => {
    const now = performance.now();
    if (gameOverRef.current || modalRef.current || now - myEmote.current.sentAt < EMOTE_GAP_MS) return;
    myEmote.current = { anim: e, until: now + EMOTE_MS, sentAt: now };
    const p = playerState.current;
    floatIcon(myArenaRef.current, p.x + CHAR_W / 2, p.y + CHAR_H + 1, e === "wave" ? "heart" : "notes");
    if (e === "wave") sfx.wave();
    else sfx.dance();
    void sendEmote(code, e).catch(() => {});
  };
  const emoteRef = useRef(emote);
  emoteRef.current = emote;

  const phrase = (p: PhraseId) => {
    const now = performance.now();
    if (now - lastPhraseAt.current < 2000) return; // the server allows one every 2 s
    lastPhraseAt.current = now;
    showBubble("me", p);
    void sendPhrase(code, p).catch(() => {});
  };
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalRef.current) return;
      keysPressed.current[e.code] = true;
      if (e.code === "Digit1" && !e.repeat) emoteRef.current("wave");
      if (e.code === "Digit2" && !e.repeat) emoteRef.current("dance");
      const digit = /^Digit([3-8])$/.exec(e.code);
      if (digit && !e.repeat) phraseRef.current(PHRASES[Number(digit[1]) - 3]);
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

        const wasGrounded = p.isGrounded;
        const res = stepPlayer(p, input, map, unlockedRef.current, crumbleRef.current, t, tPrev, dt);
        if (wasGrounded && !p.isGrounded && p.vy > 0.5) {
          sfx.jump();
          burst(myArenaRef.current, p.x + CHAR_W / 2, p.y, { color: "#ffffff", count: 6, spread: 18, size: 4 });
        }
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
          const squash = p.bounced < 8 ? ` scaleY(${1.25 - p.bounced * 0.03})` : "";
          playerSpriteRef.current.style.transform = `scaleX(${p.facingLeft ? -1 : 1})${squash}`;
        }
        let myAnim: AnimId = typing
          ? "think"
          : !p.isGrounded
            ? p.vy > 0
              ? "jump"
              : "fall"
            : Math.abs(p.vx) > 0.08
              ? "walk"
              : "idle";
        if (myAnim === "idle" && myEmote.current.anim && now < myEmote.current.until) myAnim = myEmote.current.anim;
        else if (myAnim !== "idle") myEmote.current.until = 0; // moving ends the emote
        mySkinRef.current?.setAnim(myAnim);
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
          opponentSpriteRef.current.style.transform = `scaleX(${oppDx > 0 ? 1 : -1})`;
        }
        // the opponent's animation is read from their movement; standing at a locked door = solving it
        const oppDy = opp.targetY - opp.y;
        const oppMapX = 100 - opp.x - CHAR_W; // back from the mirrored panel to map coordinates
        const oppAtDoor = map.doors.some(
          (d) =>
            !oppUnlockedRef.current.includes(d.num) &&
            Math.abs(oppMapX + CHAR_W / 2 - (d.x + DOOR_W / 2)) < 10 &&
            opp.y >= d.y - 0.5 &&
            opp.y < d.y + 6,
        );
        const oppMoving = Math.abs(oppDy) > 0.4 || Math.abs(oppDx) > 0.05;
        if (oppMoving) oppEmote.current.until = 0;
        oppSkinRef.current?.setAnim(
          oppDy > 0.4
            ? "jump"
            : oppDy < -0.4
              ? "fall"
              : Math.abs(oppDx) > 0.05
                ? "walk"
                : oppEmote.current.anim && now < oppEmote.current.until
                  ? oppEmote.current.anim
                  : oppAtDoor
                    ? "think"
                    : "idle",
        );
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
    // the arena, HUD and code stay left-to-right even when the menus are in Arabic / Urdu
    <div dir="ltr" className={`min-h-screen bg-[#050814] flex flex-col p-2 sm:p-4 md:p-6 short:p-1.5 font-pixel select-none relative ${
      hazardHit ? "shadow-[inset_0_0_120px_rgba(254,44,150,0.55)]" : ""
    }`}>
      
      {/* 1. Header (Logo, Ping, Room Info) */}
      <header className="flex justify-between items-center border-b border-neon/30 pb-3 mb-4 short:pb-1 short:mb-1">
        <div className="flex gap-6 items-center">
          <Link to="/play" className="text-yellow text-xl md:text-2xl leading-none hover:opacity-90 transition-opacity">
            PIXELCODE<br/><span className="text-pink text-xs">ARENA</span>
          </Link>
          <div className="hidden sm:flex text-neon text-[10px] md:text-xs border-l-2 border-neon/30 pl-4 uppercase items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            {serverLabel} / <span className={pingColor(ping)}>{pingLabel(ping)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-gray-400 text-[10px] md:text-xs flex items-center gap-2 uppercase border border-pink/40 px-3 py-1 bg-pink/5">
            <span className="w-2 h-2 bg-pink inline-block animate-pulse"></span>
            {botMatch ? t("kind_bot") : ranked === false ? t("kind_private") : t("kind_ranked")} #{code}
          </div>
          <Link
            to="/play"
            className="text-[10px] text-gray-500 hover:text-pink border border-gray-800 hover:border-pink px-2 py-1 transition-colors"
          >
            {t("g_exit_match")}
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
            <span className="border border-neon text-neon px-2 py-0.5 text-[9px] bg-neon/10">{t("tag_you")}</span>
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
            <span className="text-neon ml-2 text-[10px]">{unlockedCps.length} / {DOORS} {t("g_secured")}</span>
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
            {t("g_goal")}
          </div>
        </div>

        {/* Opponent (Right) */}
        <div className="flex-1 flex flex-col gap-1.5 items-end">
          <div className="flex justify-between items-start border-r-4 border-pink pr-3 w-full flex-row-reverse">
            <div className="text-right">
              <h2 className="text-yellow text-xl md:text-3xl short:text-base uppercase truncate max-w-[180px]">{opponentName}</h2>
              <p className="text-pink/70 text-[9px] md:text-[10px]">MMR {oppRating ?? "..."}</p>
            </div>
            <span className="border border-pink text-pink px-2 py-0.5 text-[9px] bg-pink/10">{botMatch ? t("tag_bot") : t("tag_rival")}</span>
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
            <span className="text-pink mr-2 text-[10px]">{opponentUnlockedCps.length} / {DOORS} {t("g_secured")}</span>
          </div>
        </div>

      </div>

      <div className="text-neon text-[10px] mb-2 flex justify-between items-center short:hidden">
        <span>{map ? `${map.name} · ${map.sector}` : t("g_loading_map")}</span>
        <span className="text-gray-400">{map?.tagline ?? t("g_tagline")}</span>
      </div>

      {/* 3. Dual-Panel Duel Arena */}
      <div
        ref={arenaWrapRef}
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
              {myBubble && <Bubble text={t(`ph_${myBubble.p}`)} tone="neon" />}
              <div ref={playerSpriteRef} className="w-full h-full">
                <AnimatedSkin ref={mySkinRef} id={mySkin} className="w-full h-full" />
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
              {oppBubble && <Bubble text={t(`ph_${oppBubble.p}`)} tone="pink" />}
              <div ref={opponentSpriteRef} className="w-full h-full">
                <AnimatedSkin ref={oppSkinRef} id={oppSkin} className="w-full h-full" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Footer Controls & Status */}
      <footer className="flex flex-col sm:flex-row justify-between items-center mt-3 text-[10px] text-gray-400 uppercase gap-2 pointer-coarse:hidden">
        <div className="flex flex-wrap gap-4 items-center">
          <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">A / D</kbd> {t("k_move")}</span>
          <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">SPACE</kbd> {t("k_jump")}</span>
          <span><kbd className="border border-neon text-neon px-2 py-0.5">E</kbd> {t("k_interact")}</span>
          <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">R</kbd> {t("k_respawn")}</span>
          <button type="button" onClick={() => emote("wave")} className="hover:text-white">
            <kbd className="border border-neon/60 text-neon px-2 py-0.5">1</kbd> 👋 {t("g_emote_wave")}
          </button>
          <button type="button" onClick={() => emote("dance")} className="hover:text-white">
            <kbd className="border border-neon/60 text-neon px-2 py-0.5">2</kbd> 🕺 {t("g_emote_dance")}
          </button>
        </div>
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-neon"></div> {t("k_gate")}</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-pink"></div> {t("k_spike")}</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-yellow"></div> {t("k_exit")}</span>
        </div>
      </footer>
      <PhraseBar onPhrase={phrase} keys className="mt-2 text-[10px] uppercase pointer-coarse:hidden" />

      {banner && (
        <div key={banner.id} className="fixed inset-x-0 top-[28%] z-45 flex justify-center pointer-events-none px-4">
          <div
            className={`enter-up text-center text-4xl sm:text-6xl short:text-3xl text-glow bg-black/55 px-6 py-3 border-y-2 ${
              banner.tone === "neon" ? "text-neon border-neon" : banner.tone === "pink" ? "text-pink border-pink" : "text-yellow border-yellow"
            }`}
          >
            {banner.text}
          </div>
        </div>
      )}

      {/* Phones / tablets: on-screen gamepad + "turn your phone" hint */}
      <TouchControls
        keys={keysPressed.current}
        canInteract={nearCheckpoint !== null && !isModalOpen}
        onInteract={() => nearRef.current && void openChallenge(nearRef.current)}
        onRespawn={triggerRespawn}
        onEmote={emote}
        onPhrase={phrase}
        emoteLabels={{ wave: t("g_emote_wave"), dance: t("g_emote_dance") }}
      />
      <div className="hidden pointer-coarse:portrait:flex fixed inset-0 z-[55] flex-col items-center justify-center gap-6 bg-[#050814]/95 text-center px-8">
        <div className="text-7xl text-neon animate-bounce">⟳</div>
        <p className="text-yellow text-2xl">{t("rotate_title")}</p>
        <p className="font-sans text-gray-400 text-sm">{t("rotate_text")}</p>
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
          {t("g_opp_disconnected")}
        </div>
      )}
      {offline && !gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 font-pixel">
          <div className="w-[92vw] max-w-140 border-2 border-pink bg-[#050816] p-6 sm:p-10 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(254,44,150,0.4)]">
            <h2 className="text-pink text-4xl">&#9632; {t("g_reconnecting")} &#9632;</h2>
            <p className="font-sans text-white text-lg">{t("g_conn_lost")}</p>
            <div className="border-2 border-pink px-10 py-3 text-pink text-[56px]/none sm:text-[88px]/none">
              {`${String(Math.floor(offlineLeft / 60)).padStart(2, "0")}:${String(offlineLeft % 60).padStart(2, "0")}`}
            </div>
            <div className="w-full border border-neon/40 p-4 flex flex-col items-center gap-3">
              <span className="text-yellow text-xl">{t("g_reconnecting_server")}</span>
              <span className="w-full h-2 bg-neon/20"><span className="block h-full bg-pink animate-pulse w-1/3" /></span>
            </div>
            <p className="font-sans text-gray-400 text-sm">{t("g_abandon")}</p>
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
            botMatch={!!result.botMatch}
            botReward={({ WIN: 40, DRAW: 20, LOSS: 10 } as Record<string, number>)[mine?.result ?? ""] ?? 0}
            mapName={map?.name ?? (result.mapId != null ? getMap(result.mapId).name : undefined)}
            rematchOffered={!!rematchOffer}
            rematchBusy={rematchBusy}
            onRematch={requestRematch}
            onPhrase={phrase}
            incomingPhrase={oppBubble ? t(`ph_${oppBubble.p}`) : null}
          />
        );
      })()}

    </div>
  );
}

export default function Game() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <GameScreen />}</ClientOnly>;
}
