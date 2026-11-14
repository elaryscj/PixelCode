// app/routes/practice.tsx
// Solo practice: run any arena map offline. Doors open instantly with E (no challenge, no rating).
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { MapLayer, animateMap } from "~/components/game/MapLayer";
import { SkinArt } from "~/components/skins";
import { getCurrentUser } from "~/api/auth";
import { MAPS, getMap, worldTime } from "~/game/maps";
import { CHAR_H, CHAR_W, DOORS, createPlayer, doorRespawn, respawn, stepPlayer, type CrumbleState } from "~/game/physics";

export function meta() {
  return [{ title: "Practice | PixelCode Arena" }];
}

export default function Practice() {
  const [params, setParams] = useSearchParams();
  const mapId = Math.min(MAPS.length - 1, Math.max(0, Number(params.get("map") ?? 0) || 0));
  const map = getMap(mapId);
  const skin = getCurrentUser()?.activeSkin ?? "neon_ronin";

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
  unlockedRef.current = unlocked;
  nearRef.current = near;

  const reset = () => {
    player.current = createPlayer(map);
    crumble.current = new Map();
    setUnlocked([]);
    setNear(null);
    setFinished(null);
    setDeaths(0);
    doneRef.current = false;
    startedAt.current = performance.now();
  };
  useEffect(reset, [mapId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if ((e.code === "KeyE" || e.code === "Enter") && nearRef.current) {
        const num = nearRef.current;
        const prev = num === 1 || unlockedRef.current.includes(num - 1);
        if (prev) {
          setUnlocked((u) => [...u, num]);
          const d = map.doors.find((x) => x.num === num);
          if (d) {
            const r = doorRespawn(d);
            player.current.respawnX = r.x;
            player.current.respawnY = r.y;
          }
        }
      }
      if (e.code === "KeyR") respawn(player.current);
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
        if (res.hitHazard) {
          respawn(p);
          setDeaths((d) => d + 1);
        }
        if (res.nearDoor !== nearRef.current) setNear(res.nearDoor);
        if (res.atExit) {
          doneRef.current = true;
          setFinished((now - startedAt.current) / 1000);
        }
        if (++frame % 15 === 0) setElapsed((now - startedAt.current) / 1000);
      }
      animateMap(arenaRef.current, map, t, false, crumble.current);
      if (playerDom.current) {
        playerDom.current.style.left = `${p.x}%`;
        playerDom.current.style.bottom = `${p.y}%`;
      }
      if (spriteDom.current) {
        const bob = p.isGrounded && Math.abs(p.vx) > 0.08 ? Math.abs(Math.sin(now / 90)) * 3 : 0;
        const squash = p.bounced < 8 ? ` scaleY(${1.25 - p.bounced * 0.03})` : "";
        spriteDom.current.style.transform = `translateY(${-bob}px) scaleX(${p.facingLeft ? -1 : 1})${squash}`;
      }
      tPrev = t;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [map]);

  return (
    <div className="min-h-screen bg-[#050814] flex flex-col p-4 md:p-6 font-pixel select-none">
      <header className="flex flex-wrap justify-between items-center gap-3 border-b border-neon/30 pb-3 mb-4">
        <Link to="/play" className="text-yellow text-xl leading-none">
          PIXELCODE<br />
          <span className="text-pink text-xs">PRACTICE</span>
        </Link>
        <div className="flex flex-wrap gap-2">
          {MAPS.map((m) => (
            <button
              key={m.id}
              onClick={(e) => {
                e.currentTarget.blur();
                setParams({ map: String(m.id) });
              }}
              className={`text-[10px] px-2 py-1 border ${m.id === mapId ? "border-yellow text-yellow bg-yellow/10" : "border-neon/40 text-neon/70 hover:border-neon hover:text-neon"}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap justify-between items-end gap-2 mb-2">
        <div>
          <div className="text-yellow text-lg">{map.name}</div>
          <div className="text-gray-400 text-[10px]">{map.tagline}</div>
        </div>
        <div className="flex gap-4 text-[10px] text-neon">
          <span>DOORS {unlocked.length}/{DOORS}</span>
          <span>FALLS {deaths}</span>
          <span className="text-white text-sm">{(finished ?? elapsed).toFixed(1)}s</span>
        </div>
      </div>

      <div
        className="relative w-full max-w-[760px] mx-auto border-2 border-neon/50 bg-[#081026] overflow-hidden"
        style={{ height: "max(480px, calc(100vh - 260px))" }}
      >
        <div ref={arenaRef} className="absolute inset-0">
          <MapLayer map={map} mirror={false} unlocked={unlocked} doors={{}} tone="neon" nearCheckpoint={near} />
          <div
            ref={playerDom}
            className="absolute z-20 pointer-events-none"
            style={{ left: `${map.start.x}%`, bottom: `${map.start.y}%`, width: `${CHAR_W}%`, height: `${CHAR_H}%` }}
          >
            <div ref={spriteDom} className="w-full h-full">
              <SkinArt id={skin} size="small" className="w-full h-full" />
            </div>
          </div>
        </div>

        {finished !== null && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75">
            <div className="text-yellow text-3xl">CLEARED</div>
            <div className="text-white">{finished.toFixed(1)}s · {deaths} falls</div>
            <button onClick={reset} className="border-2 border-neon text-neon px-4 py-2 text-xs hover:bg-neon/10">
              RUN AGAIN
            </button>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap gap-4 mt-3 text-[10px] text-gray-400 uppercase">
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">A / D</kbd> MOVE</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">SPACE</kbd> JUMP</span>
        <span><kbd className="border border-neon text-neon px-2 py-0.5">E</kbd> OPEN DOOR (NO CHALLENGE IN PRACTICE)</span>
        <span><kbd className="border border-gray-600 px-2 py-0.5 text-white">R</kbd> RESPAWN</span>
      </footer>
    </div>
  );
}
