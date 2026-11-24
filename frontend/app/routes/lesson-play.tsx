// app/routes/lesson-play.tsx — /lesson/:code/play : a student's run in a lesson. Everyone in the class gets the
// same map and the same four tasks; a door opens only with an accepted solution. The teacher watches the table.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { MapLayer, animateMap } from "~/components/game/MapLayer";
import ChallengeModal from "~/components/game/ChallengeModal";
import TouchControls from "~/components/game/TouchControls";
import { AnimatedSkin, type SkinHandle } from "~/components/skins";
import { getCurrentUser } from "~/api/auth";
import type { DoorChallenge } from "~/api/game";
import {
  finishLesson,
  forgetLesson,
  lessonMe,
  lessonToken,
  openLessonDoor,
  submitLessonDoor,
  type StudentState,
} from "~/api/lessons";
import { getMap, worldTime } from "~/game/maps";
import { burst, dust, flash, shake } from "~/components/game/fx";
import { sfx } from "~/lib/sfx";
import { CHAR_H, CHAR_W, DOORS, createPlayer, doorRespawn, respawn, stepPlayer, type CrumbleState } from "~/game/physics";
import { ApiError } from "~/api/http";

export function meta() {
  return [{ title: "Lesson | PixelCode Arena" }];
}

const clock = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const sec = v % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

function LessonPlayScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code: raw = "" } = useParams();
  const code = raw.trim().toUpperCase();
  const [state, setState] = useState<StudentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0); // server time - local time
  const [challenge, setChallenge] = useState<DoorChallenge | null>(null);
  const [near, setNear] = useState<number | null>(null);
  const [falls, setFalls] = useState(0);
  const [doorError, setDoorError] = useState<string | null>(null);

  const map = getMap(state?.mapId ?? 0);
  const skin = getCurrentUser()?.activeSkin ?? "neon_ronin";
  const unlockedCount = state?.unlocked ?? 0;
  const unlocked = Array.from({ length: unlockedCount }, (_, i) => i + 1);

  const player = useRef(createPlayer(map));
  const crumble = useRef<CrumbleState>(new Map());
  const keys = useRef<Record<string, boolean>>({});
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const playerDom = useRef<HTMLDivElement | null>(null);
  const spriteDom = useRef<HTMLDivElement | null>(null);
  const skinRef = useRef<SkinHandle | null>(null);
  const unlockedRef = useRef<number[]>([]);
  const nearRef = useRef<number | null>(null);
  const modalRef = useRef(false);
  const playingRef = useRef(false);
  const finishingRef = useRef(false);
  const fallsRef = useRef(0);
  unlockedRef.current = unlocked;
  nearRef.current = near;
  modalRef.current = challenge !== null;
  fallsRef.current = falls;

  const serverNow = now + offset.current;
  const started = state?.status === "RUNNING" && state.startsAt != null && serverNow >= state.startsAt;
  const ended = state?.status === "ENDED" || (state?.endsAt != null && serverNow >= state.endsAt);
  const playing = !!state && started && !ended && !state.finished;
  playingRef.current = playing;

  const apply = useCallback((s: StudentState) => {
    offset.current = s.serverTime - Date.now();
    setState(s);
  }, []);

  // no token for this lesson in this browser: join first
  useEffect(() => {
    if (!lessonToken(code)) navigate(`/lesson/${code}`, { replace: true });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // the lesson's state (start, end, doors) and the student's heartbeat for the teacher's "online"
  useEffect(() => {
    let alive = true;
    const poll = () =>
      lessonMe(code, fallsRef.current)
        .then((s) => alive && apply(s))
        .catch((e) => {
          if (!alive) return;
          if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
            forgetLesson(code);
            navigate(`/lesson/${code}`, { replace: true });
          } else {
            setError(e instanceof Error ? e.message : t("unexpected_error"));
          }
        });
    void poll();
    const id = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // a fresh runner when the map is known (and after a reload: back past the doors already opened)
  const mapId = state?.mapId;
  useEffect(() => {
    if (mapId == null) return;
    const m = getMap(mapId);
    player.current = createPlayer(m);
    crumble.current = new Map();
    const last = m.doors.find((d) => d.num === (state?.unlocked ?? 0));
    if (last) {
      const r = doorRespawn(last);
      Object.assign(player.current, { x: r.x, y: r.y, respawnX: r.x, respawnY: r.y });
    }
  }, [mapId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDoor = async (num: number) => {
    setDoorError(null);
    try {
      const c = await openLessonDoor(code, num);
      keys.current = {};
      setChallenge(c);
    } catch (e) {
      setDoorError(e instanceof Error ? e.message : t("unexpected_error"));
    }
  };

  const onSolved = (num: number) => {
    setChallenge(null);
    setState((s) => (s ? { ...s, unlocked: Math.max(s.unlocked, num) } : s));
    const d = map.doors.find((x) => x.num === num);
    sfx.doorOpen();
    flash(arenaRef.current);
    if (d) {
      burst(arenaRef.current, d.x + 3, d.y + 6, { count: 24, spread: 80 });
      const r = doorRespawn(d);
      player.current.respawnX = r.x;
      player.current.respawnY = r.y;
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (modalRef.current) return; // typing code: no game keys
      keys.current[e.code] = true;
      if ((e.code === "KeyE" || e.code === "Enter") && nearRef.current && playingRef.current) {
        const num = nearRef.current;
        if (num === unlockedRef.current.length + 1) void openDoor(num);
      }
      if (e.code === "KeyR") respawn(player.current);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let id: number;
    let last = performance.now();
    let tPrev = worldTime();
    const loop = () => {
      const nowMs = performance.now();
      const dt = Math.min(2.5, Math.max(0.2, (nowMs - last) / 16.667));
      last = nowMs;
      const t = worldTime();
      const p = player.current;
      const k = keys.current;
      if (playingRef.current && !modalRef.current) {
        const wasGrounded = p.isGrounded;
        const fallSpeed = -p.vy;
        const res = stepPlayer(
          p,
          {
            left: !!(k["KeyA"] || k["ArrowLeft"]),
            right: !!(k["KeyD"] || k["ArrowRight"]),
            jump: !!(k["Space"] || k["KeyW"] || k["ArrowUp"]),
          },
          map,
          unlockedRef.current,
          crumble.current,
          t,
          tPrev,
          dt,
        );
        if (wasGrounded && !p.isGrounded && p.vy > 0.5) {
          sfx.jump();
          dust(arenaRef.current, p.x + CHAR_W / 2, p.y, "jump");
        }
        if (!wasGrounded && p.isGrounded && fallSpeed > 0.45) {
          dust(arenaRef.current, p.x + CHAR_W / 2, p.y, "land", Math.min(1, (fallSpeed - 0.45) / 1.2));
        }
        if (res.hitHazard) {
          burst(arenaRef.current, p.x + CHAR_W / 2, p.y + 4, { color: "#FE2C96", count: 22, spread: 60 });
          shake(arenaRef.current, 10);
          sfx.hazard();
          respawn(p);
          setFalls((f) => f + 1);
        }
        if (res.nearDoor !== nearRef.current) setNear(res.nearDoor);
        if (res.atExit && !finishingRef.current) {
          finishingRef.current = true;
          finishLesson(code)
            .then((s) => {
              apply(s);
              sfx.victory();
            })
            .catch(() => {})
            .finally(() => {
              finishingRef.current = false;
            });
        }
      }
      animateMap(arenaRef.current, map, t, false, crumble.current);
      if (playerDom.current) {
        playerDom.current.style.left = `${p.x}%`;
        playerDom.current.style.bottom = `${p.y}%`;
      }
      if (spriteDom.current) spriteDom.current.style.transform = `scaleX(${p.facingLeft ? -1 : 1})`;
      skinRef.current?.setAnim(!p.isGrounded ? (p.vy > 0 ? "jump" : "fall") : Math.abs(p.vx) > 0.08 ? "walk" : "idle");
      tPrev = t;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [map, code, apply]);

  if (!state) {
    return error ? (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-pixel text-center px-4">
        <p className="text-pink text-xl">{error}</p>
        <Link to={`/lesson/${code}`} className="border-2 border-neon text-yellow px-6 py-2">{t("lj_title")}</Link>
      </div>
    ) : (
      <ScreenLoading />
    );
  }

  const secondsLeft = state.endsAt != null ? (state.endsAt - serverNow) / 1000 : state.durationMinutes * 60;
  const countdown = state.status === "RUNNING" && state.startsAt != null && serverNow < state.startsAt
    ? Math.ceil((state.startsAt - serverNow) / 1000)
    : null;

  return (
    <div dir="ltr" className="min-h-screen bg-[#050814] flex flex-col p-2 sm:p-4 md:p-6 short:p-1.5 font-pixel select-none">
      {playing && !challenge && (
        <TouchControls
          keys={keys.current}
          canInteract={near !== null && near === unlockedCount + 1}
          onInteract={() => near && near === unlockedCount + 1 && void openDoor(near)}
          onRespawn={() => respawn(player.current)}
        />
      )}
      <div className="hidden pointer-coarse:portrait:flex fixed inset-0 z-[55] flex-col items-center justify-center gap-6 bg-[#050814]/95 text-center px-8">
        <div className="text-7xl text-neon animate-bounce">⟳</div>
        <p className="text-yellow text-2xl">{t("rotate_title")}</p>
        <p className="font-sans text-gray-400 text-sm">{t("rotate_text")}</p>
      </div>

      <header className="flex flex-wrap justify-between items-center gap-3 border-b border-neon/30 pb-3 mb-3 short:pb-1 short:mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="border-2 border-pink text-pink px-3 py-1.5 text-xs hover:bg-pink/10 shrink-0">
            &lt; {t("ls_leave")}
          </Link>
          <div className="min-w-0">
            <div className="text-yellow text-sm sm:text-base truncate">{state.title}</div>
            <div className="text-gray-400 text-[10px] truncate">{t("ls_you_are", { name: state.name })}</div>
          </div>
        </div>
        <div className="flex gap-4 items-center text-[10px] text-neon">
          <span>{t("p_doors")} {unlockedCount}/{DOORS}</span>
          <span>{t("p_falls")} {falls}</span>
          <span className={`text-sm ${secondsLeft < 300 && started && !ended ? "text-pink animate-pulse" : "text-white"}`}>
            {t("ls_time_left")}: {clock(secondsLeft)}
          </span>
        </div>
      </header>

      <div
        className="relative w-full max-w-[760px] mx-auto border-2 border-neon/50 bg-[#081026] overflow-hidden"
        style={{ height: "var(--practice-h)" }}
      >
        <div ref={arenaRef} className="absolute inset-0">
          <MapLayer map={map} mirror={false} unlocked={unlocked} doors={{}} tone="neon" nearCheckpoint={playing ? near : null} />
          <div
            ref={playerDom}
            className="absolute z-20 pointer-events-none"
            style={{ left: `${map.start.x}%`, bottom: `${map.start.y}%`, width: `${CHAR_W}%`, height: `${CHAR_H}%` }}
          >
            <div ref={spriteDom} className="w-full h-full">
              <AnimatedSkin ref={skinRef} id={skin} className="w-full h-full" />
            </div>
          </div>
        </div>

        {state.status === "LOBBY" && (
          <Overlay>
            <div className="text-yellow text-2xl sm:text-3xl animate-pulse">{t("ls_waiting")}</div>
            <div className="text-neon text-lg">{t("ls_you_are", { name: state.name })}</div>
            <div className="text-gray-400 text-sm">{map.name}</div>
          </Overlay>
        )}
        {countdown !== null && (
          <Overlay>
            <div className="text-yellow text-3xl">{t("ls_starts_in", { n: countdown })}</div>
            <div className="text-pink text-8xl">{countdown}</div>
          </Overlay>
        )}
        {state.finished && (
          <Overlay>
            <div className="text-yellow text-4xl">{t("ls_finished")}</div>
            <div className="text-white text-xl">{t("ls_your_time", { time: clock(state.finishedSeconds ?? 0) })}</div>
            <div className="text-gray-300 text-sm font-sans max-w-sm text-center">{t("ls_wait_others")}</div>
          </Overlay>
        )}
        {ended && !state.finished && (
          <Overlay>
            <div className="text-pink text-3xl">{t("ls_ended")}</div>
            <div className="text-white text-xl">{t("ls_doors_opened", { n: unlockedCount })}</div>
            <Link to="/" className="border-2 border-neon text-neon px-4 py-2 text-xs hover:bg-neon/10">{t("menu")}</Link>
          </Overlay>
        )}
        {doorError && playing && (
          <div className="absolute top-2 inset-x-2 z-30 text-center text-pink text-xs bg-black/70 py-1" onClick={() => setDoorError(null)}>
            {doorError}
          </div>
        )}
      </div>

      <footer className="flex flex-wrap gap-4 mt-3 text-[10px] text-gray-400 uppercase pointer-coarse:hidden">
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">A / D</kbd> {t("k_move")}</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">SPACE</kbd> {t("k_jump")}</span>
        <span><kbd className="border border-neon text-neon px-2 py-0.5">E</kbd> {t("ls_open_door")}</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">R</kbd> {t("k_respawn")}</span>
      </footer>

      {challenge && (
        <ChallengeModal
          roomCode={code}
          challenge={challenge}
          isOpen
          serverUnlocked={unlockedCount >= challenge.cpNum}
          onClose={() => setChallenge(null)}
          onSuccess={onSolved}
          submit={(cp, src) => submitLessonDoor(code, cp, src)}
          timerLabel={t("ls_time_left")}
        />
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75 px-4 text-center">{children}</div>;
}

export default function LessonPlay() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <LessonPlayScreen />}</ClientOnly>;
}
