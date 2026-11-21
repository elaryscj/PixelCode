// app/routes/practice.tsx
// Solo practice: run any arena map offline. Doors open instantly with E (no challenge, no rating).
import { useEffect, useRef, useState } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { MapLayer, animateMap } from "~/components/game/MapLayer";
import { AnimatedSkin, type SkinHandle } from "~/components/skins";
import { getCurrentUser } from "~/api/auth";
import { MAPS, getMap, worldTime } from "~/game/maps";
import TouchControls from "~/components/game/TouchControls";
import { burst, flash, shake } from "~/components/game/fx";
import { sfx } from "~/lib/sfx";
import ChallengeModal from "~/components/game/ChallengeModal";
import { checkPractice, getPracticeChallenge, type PracticeChallenge } from "~/api/stats";
import { CHAR_H, CHAR_W, DOORS, createPlayer, doorRespawn, respawn, stepPlayer, type CrumbleState } from "~/game/physics";

export function meta() {
  return [{ title: "Practice | PixelCode Arena" }];
}

/** practice levels: every door of that level, or a mix that grows like in a match */
const LEVELS = ["EASY", "MEDIUM", "HARD", "MIX"] as const;
type Level = (typeof LEVELS)[number];
const MIX = ["EASY", "EASY", "MEDIUM", "HARD"];
const isLevel = (v: string | null): v is Level => !!v && (LEVELS as readonly string[]).includes(v);

function PracticeScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mapId = Math.min(MAPS.length - 1, Math.max(0, Number(params.get("map") ?? 0) || 0));
  const map = getMap(mapId);
  const me = getCurrentUser();
  const skin = me?.activeSkin ?? "neon_ronin";
  // ?tasks=EASY|MEDIUM|HARD|MIX: doors ask for real code (checked on the server); none = doors open with E
  const rawTasks = params.get("tasks");
  const tasks: Level | null = me && isLevel(rawTasks) ? rawTasks : null;
  const [challenge, setChallenge] = useState<PracticeChallenge | null>(null);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);
  const [solvedTasks, setSolvedTasks] = useState(0);
  const challengeRef = useRef<PracticeChallenge | null>(null);
  challengeRef.current = challenge;
  /** the challenge of each door in this run (reopening a door shows the same one) */
  const doorTasks = useRef<Record<number, PracticeChallenge>>({});
  const loadingTask = useRef(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const [unlocked, setUnlocked] = useState<number[]>([]);
  const [near, setNear] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState<number | null>(null);
  const [deaths, setDeaths] = useState(0);

  const player = useRef(createPlayer(map));
  const crumble = useRef<CrumbleState>(new Map());
  const unlockedRef = useRef<number[]>([]);
  const nearRef = useRef<number | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const startedAt = useRef(performance.now());
  const doneRef = useRef(false);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const playerDom = useRef<HTMLDivElement | null>(null);
  const spriteDom = useRef<HTMLDivElement | null>(null);
  const skinRef = useRef<SkinHandle | null>(null);
  unlockedRef.current = unlocked;
  nearRef.current = near;

  const reset = () => {
    player.current = createPlayer(map);
    crumble.current = new Map();
    setUnlocked([]);
    setNear(null);
    setFinished(null);
    setDeaths(0);
    setChallenge(null);
    setSolvedTasks(0);
    setTaskMsg(null);
    doorTasks.current = {};
    doneRef.current = false;
    startedAt.current = performance.now();
  };
  useEffect(reset, [mapId, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlockDoor = (num: number) => {
    setUnlocked((u) => (u.includes(num) ? u : [...u, num]));
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
  const unlockRef = useRef(unlockDoor);
  unlockRef.current = unlockDoor;

  const openTask = async (num: number) => {
    const level = tasksRef.current;
    if (!level || loadingTask.current) return;
    for (const k of Object.keys(keys.current)) keys.current[k] = false; // stop running while the editor is open
    const cached = doorTasks.current[num];
    if (cached) {
      setChallenge(cached);
      return;
    }
    loadingTask.current = true;
    setTaskMsg(t("p_task_loading"));
    try {
      const used = Object.values(doorTasks.current).map((c) => c.challengeId);
      const c = await getPracticeChallenge(level === "MIX" ? MIX[num - 1] : level, num, used);
      doorTasks.current[num] = c;
      setChallenge(c);
      setTaskMsg(null);
    } catch (e) {
      setTaskMsg(e instanceof Error ? e.message : t("cm_unavailable"));
    } finally {
      loadingTask.current = false;
    }
  };
  const openTaskRef = useRef(openTask);
  openTaskRef.current = openTask;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (challengeRef.current) return; // typing code: no running, jumping or menu
      keys.current[e.code] = true;
      if ((e.code === "KeyE" || e.code === "Enter") && nearRef.current) {
        const num = nearRef.current;
        const prev = num === 1 || unlockedRef.current.includes(num - 1);
        if (prev && !unlockedRef.current.includes(num)) {
          if (tasksRef.current) void openTaskRef.current(num);
          else unlockRef.current(num);
        }
      }
      if (e.code === "KeyR") respawn(player.current);
      if (e.code === "Escape") navigate("/");
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      // buttons fire on Space keyup: never let a jump switch the map
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [map]);

  useEffect(() => {
    let id: number;
    let last = performance.now();
    let tPrev = worldTime();
    let frame = 0;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(2.5, Math.max(0.2, (now - last) / 16.667));
      last = now;
      const t = worldTime();
      const p = player.current;
      const k = keys.current;
      if (!doneRef.current) {
        const wasGrounded = p.isGrounded;
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
          burst(arenaRef.current, p.x + CHAR_W / 2, p.y, { color: "#ffffff", count: 6, spread: 18, size: 4 });
        }
        if (res.hitHazard) {
          burst(arenaRef.current, p.x + CHAR_W / 2, p.y + 4, { color: "#FE2C96", count: 22, spread: 60 });
          shake(arenaRef.current, 10);
          sfx.hazard();
          respawn(p);
          setDeaths((d) => d + 1);
        }
        if (res.nearDoor !== nearRef.current) setNear(res.nearDoor);
        if (res.atExit) {
          doneRef.current = true;
          setFinished((now - startedAt.current) / 1000);
          sfx.victory();
        }
        if (++frame % 15 === 0) setElapsed((now - startedAt.current) / 1000);
      }
      animateMap(arenaRef.current, map, t, false, crumble.current);
      if (playerDom.current) {
        playerDom.current.style.left = `${p.x}%`;
        playerDom.current.style.bottom = `${p.y}%`;
      }
      if (spriteDom.current) {
        const squash = p.bounced < 8 ? ` scaleY(${1.25 - p.bounced * 0.03})` : "";
        spriteDom.current.style.transform = `scaleX(${p.facingLeft ? -1 : 1})${squash}`;
      }
      skinRef.current?.setAnim(!p.isGrounded ? (p.vy > 0 ? "jump" : "fall") : Math.abs(p.vx) > 0.08 ? "walk" : "idle");
      tPrev = t;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [map]);

  return (
    <div dir="ltr" className="min-h-screen bg-[#050814] flex flex-col p-2 sm:p-4 md:p-6 short:p-1.5 font-pixel select-none">
      <TouchControls
        keys={keys.current}
        canInteract={near !== null}
        onInteract={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
          window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" }));
        }}
        onRespawn={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
          window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" }));
        }}
      />
      <div className="hidden pointer-coarse:portrait:flex fixed inset-0 z-[55] flex-col items-center justify-center gap-6 bg-[#050814]/95 text-center px-8">
        <div className="text-7xl text-neon animate-bounce">⟳</div>
        <p className="text-yellow text-2xl">{t("rotate_title")}</p>
        <p className="font-sans text-gray-400 text-sm">{t("rotate_text")}</p>
      </div>
      <header className="flex flex-wrap short:flex-nowrap justify-between items-center gap-3 border-b border-neon/30 pb-3 mb-4 short:pb-1 short:mb-1">
        <div className="flex items-center gap-3 shrink-0">
          {/* clear way back: this used to be only the logo, which also led to /play instead of the menu */}
          <Link
            to="/"
            className="border-2 border-pink text-pink px-3 py-1.5 text-xs short:text-[10px] short:py-1 hover:bg-pink/10 relative z-50"
          >
            &lt; {t("menu")}
          </Link>
          <div className="text-yellow text-xl short:text-sm leading-none">
            PIXELCODE<br />
            <span className="text-pink text-xs">{t("menu_practice")}</span>
          </div>
        </div>
        <div className="flex flex-wrap short:flex-nowrap short:overflow-x-auto scrollbar-none gap-2 min-w-0">
          {MAPS.map((m) => (
            <button
              key={m.id}
              onClick={(e) => {
                e.currentTarget.blur();
                setParams({ map: String(m.id) });
              }}
              className={`shrink-0 text-[10px] px-2 py-1 border ${m.id === mapId ? "border-yellow text-yellow bg-yellow/10" : "border-neon/40 text-neon/70 hover:border-neon hover:text-neon"}`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap short:flex-nowrap gap-2 items-center min-w-0">
          <span className="text-[10px] text-gray-400">{t("p_doors_mode")}</span>
          <button
            onClick={(e) => {
              e.currentTarget.blur();
              setParams({ map: String(mapId) });
            }}
            className={`shrink-0 text-[10px] px-2 py-1 border ${!tasks ? "border-yellow text-yellow bg-yellow/10" : "border-pink/40 text-pink/70 hover:border-pink hover:text-pink"}`}
          >
            {t("p_mode_free")}
          </button>
          {me ? (
            LEVELS.map((l) => (
              <button
                key={l}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setParams({ map: String(mapId), tasks: l });
                }}
                className={`shrink-0 text-[10px] px-2 py-1 border ${tasks === l ? "border-yellow text-yellow bg-yellow/10" : "border-pink/40 text-pink/70 hover:border-pink hover:text-pink"}`}
              >
                {l === "MIX" ? t("p_level_mix") : l}
              </button>
            ))
          ) : (
            <Link to="/login" className="text-[10px] text-pink underline">{t("p_tasks_login")}</Link>
          )}
        </div>
      </header>

      <div className="flex flex-wrap justify-between items-end gap-2 mb-2 short:mb-1">
        <div className="short:hidden">
          <div className="text-yellow text-lg">{map.name}</div>
          <div className="text-gray-400 text-[10px]">{map.tagline}</div>
        </div>
        <div className="flex gap-4 text-[10px] text-neon">
          <span>{t("p_doors")} {unlocked.length}/{DOORS}</span>
          <span>{t("p_falls")} {deaths}</span>
          {tasks && <span className="text-pink">{t("p_tasks_solved", { n: solvedTasks })}</span>}
          <span className="text-white text-sm">{(finished ?? elapsed).toFixed(1)}s</span>
        </div>
      </div>

      <div
        className="relative w-full max-w-[760px] mx-auto border-2 border-neon/50 bg-[#081026] overflow-hidden"
        style={{ height: "var(--practice-h)" }}
      >
        <div ref={arenaRef} className="absolute inset-0">
          <MapLayer map={map} mirror={false} unlocked={unlocked} doors={{}} tone="neon" nearCheckpoint={near} />
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

        {finished !== null && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75">
            <div className="text-yellow text-3xl">{t("p_cleared")}</div>
            <div className="text-white">{finished.toFixed(1)}s · {deaths} {t("p_falls_lower")}</div>
            {tasks && <div className="text-pink text-xs">{t("p_tasks_solved", { n: solvedTasks })}</div>}
            <div className="flex gap-3">
              <button onClick={reset} className="border-2 border-neon text-neon px-4 py-2 text-xs hover:bg-neon/10">
                {t("p_run_again")}
              </button>
              <Link to="/" className="border-2 border-pink text-pink px-4 py-2 text-xs hover:bg-pink/10">
                {t("menu")}
              </Link>
            </div>
          </div>
        )}
      </div>

      {taskMsg && <p className="text-center text-pink text-[10px] mt-2">{taskMsg}</p>}
      {challenge && (
        <ChallengeModal
          roomCode=""
          challenge={challenge}
          isOpen
          serverUnlocked={unlocked.includes(challenge.cpNum)}
          onClose={() => setChallenge(null)}
          onSuccess={(cp) => {
            if (!unlockedRef.current.includes(cp)) {
              unlockRef.current(cp);
              setSolvedTasks((n) => n + 1);
            }
            setChallenge(null);
          }}
          submit={(_cp, src) => checkPractice(challenge.challengeId, src)}
          hideTimer
        />
      )}

      <footer className="flex flex-wrap gap-4 mt-3 text-[10px] text-gray-400 uppercase pointer-coarse:hidden">
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">A / D</kbd> {t("k_move")}</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">SPACE</kbd> {t("k_jump")}</span>
        <span><kbd className="border border-neon text-neon px-2 py-0.5">E</kbd> {t(tasks ? "p_open_door_task" : "p_open_door")}</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">R</kbd> {t("k_respawn")}</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">ESC</kbd> {t("menu")}</span>
      </footer>
    </div>
  );
}

export default function Practice() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <PracticeScreen />}</ClientOnly>;
}
