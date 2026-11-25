// app/routes/watch.tsx  —  /watch/:code : watch a friend's match live (spectator mode).
// The server sends the full picture (positions, doors, timers, never the code); live moves, doors, emotes and
// phrases come over the same WebSocket topic the players use.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { ApiError } from "~/api/http";
import { onGameEvent } from "~/api/socket";
import { AnimatedSkin, type AnimId, type SkinHandle } from "~/components/skins";
import { FitBox } from "~/components/game/FitBox";
import { MapLayer, animateMap } from "~/components/game/MapLayer";
import { Bubble, isPhrase, type PhraseId } from "~/components/game/PhraseBar";
import { getMap, worldTime } from "~/game/maps";
import { CHAR_H, CHAR_W, DOOR_W, DOORS } from "~/game/physics";
import { watchMatch, type WatchSlot, type WatchState } from "~/api/stats";

export function meta() {
  return [{ title: "Watch | PixelCode Arena" }];
}

const POLL_MS = 2500;
const mmss = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

type Live = { x: number; y: number; tx: number; ty: number; emote: { anim: AnimId; until: number } | null };

function WatchScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const me = getCurrentUser();
  const [state, setState] = useState<WatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Record<number, number[]>>({});
  const [bubbles, setBubbles] = useState<Record<number, { text: PhraseId; until: number }>>({});
  const [clock, setClock] = useState(0);

  const live = useRef<Record<number, Live>>({});
  const arenas = useRef<(HTMLDivElement | null)[]>([null, null]);
  const figures = useRef<(HTMLDivElement | null)[]>([null, null]);
  const sprites = useRef<(HTMLDivElement | null)[]>([null, null]);
  const skins = useRef<(SkinHandle | null)[]>([null, null]);
  const startedAt = useRef(0); // local time of elapsed = 0

  const players: WatchSlot[] = state?.players ?? [];
  const map = state?.mapId != null ? getMap(state.mapId) : null;

  const statusRef = useRef<string | null>(null);
  const apply = (st: WatchState) => {
    statusRef.current = st.status;
    setState(st);
    if (st.elapsedSeconds != null) startedAt.current = Date.now() - st.elapsedSeconds * 1000;
    const u: Record<number, number[]> = {};
    for (const p of st.players ?? []) {
      u[p.userId] = p.unlocked;
      const l = live.current[p.userId];
      if (!l) live.current[p.userId] = { x: p.x, y: p.y, tx: p.x, ty: p.y, emote: null };
      else {
        l.tx = p.x;
        l.ty = p.y;
      }
    }
    setUnlocked(u);
  };

  // full state now and then (also keeps this viewer counted in "watching")
  useEffect(() => {
    if (!me) {
      navigate(`/login?next=${encodeURIComponent(`/watch/${code}`)}`);
      return;
    }
    let alive = true;
    const load = () =>
      watchMatch(code)
        .then((st) => alive && apply(st))
        .catch((e) => {
          if (!alive) return;
          if (e instanceof ApiError && e.status === 409) navigate(`/play/${code}/game`);
          else setError(e instanceof Error ? e.message : t("unexpected_error"));
        });
    void load();
    const id = setInterval(() => {
      if (statusRef.current !== "FINISHED") void load();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // live events
  useEffect(() => {
    if (!me) return;
    return onGameEvent(code, (data: any) => {
      if (data.type === "MOVE" && typeof data.userId === "number") {
        const l = live.current[data.userId];
        if (l) {
          l.tx = data.x;
          l.ty = data.y;
        }
      } else if (data.type === "DOOR_UNLOCKED") {
        setUnlocked((u) => ({ ...u, [data.userId]: Array.from(new Set([...(u[data.userId] ?? []), data.cpNum])) }));
      } else if (data.type === "EMOTE" && (data.emote === "wave" || data.emote === "dance")) {
        const l = live.current[data.userId];
        if (l) l.emote = { anim: data.emote, until: performance.now() + 1900 };
      } else if (data.type === "PHRASE" && isPhrase(data.phrase)) {
        setBubbles((b) => ({ ...b, [data.userId]: { text: data.phrase, until: Date.now() + 2600 } }));
      } else if (data.type === "GAME_OVER") {
        void watchMatch(code).then(apply).catch(() => {});
      }
    });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // smooth figures between reports
  useEffect(() => {
    if (!map || players.length === 0) return;
    let raf = 0;
    let frame = 0;
    const loop = () => {
      players.forEach((p, i) => {
        const l = live.current[p.userId];
        if (!l) return;
        const mirror = i === 1;
        const px = l.x;
        const py = l.y;
        l.x += (l.tx - l.x) * 0.25;
        l.y += (l.ty - l.y) * 0.25;
        const dx = l.x - px;
        const dy = l.y - py;
        const x = mirror ? 100 - l.x - CHAR_W : l.x;
        const fig = figures.current[i];
        if (fig) {
          fig.style.left = `${x}%`;
          fig.style.bottom = `${l.y}%`;
        }
        if (sprites.current[i] && Math.abs(dx) > 0.02) {
          const right = mirror ? dx < 0 : dx > 0;
          sprites.current[i]!.style.transform = `scaleX(${right ? 1 : -1})`;
        }
        const open = unlockedRef.current[p.userId] ?? [];
        const atDoor = map.doors.some(
          (d) => !open.includes(d.num) && Math.abs(l.x + CHAR_W / 2 - (d.x + DOOR_W / 2)) < 10 && l.y >= d.y - 0.5 && l.y < d.y + 6,
        );
        let anim: AnimId = dy > 0.15 ? "jump" : dy < -0.15 ? "fall" : Math.abs(dx) > 0.02 ? "walk" : atDoor ? "think" : "idle";
        if (anim === "idle" && l.emote && l.emote.until > performance.now()) anim = l.emote.anim;
        skins.current[i]?.setAnim(anim);
        animateMap(arenas.current[i], map, worldTime(), mirror, null);
      });
      if (++frame % 30 === 0) setClock(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [map, players.map((p) => p.userId).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-pixel px-4 text-center">
        <div className="star-background" />
        <p className="text-pink text-2xl">{error}</p>
        <Link to="/friends" className="border-2 border-neon text-yellow px-6 py-2">
          {t("menu_friends")}
        </Link>
      </div>
    );
  }
  if (!state) return <ScreenLoading />;

  if (state.status !== "PLAYING" || !map) {
    const res = state.result;
    const winner = res?.players?.find((p) => p.userId === res.winnerUserId);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-pixel px-4 text-center">
        <div className="star-background" />
        <p className="text-yellow text-3xl">{state.status === "FINISHED" ? t("sp_over") : t("sp_not_started")}</p>
        {state.status === "FINISHED" && (
          <p className="text-gray-200">{winner ? t("rp_winner", { name: winner.nickname }) : t("rp_draw")}</p>
        )}
        <Link to="/friends" className="border-2 border-neon text-yellow px-6 py-2">
          {t("menu_friends")}
        </Link>
      </div>
    );
  }

  const elapsed = Math.floor((clock || Date.now()) - startedAt.current) / 1000;
  const total = state.maxSeconds ?? 1200;
  return (
    <>
      <div className="star-background" />
      <div className="h-dvh overflow-hidden w-full px-2 sm:px-3 py-2 font-pixel flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Link to="/friends" className="border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10">
            &lt; {t("menu_friends")}
          </Link>
          <h1 className="text-yellow text-[clamp(16px,2.4vw,40px)] text-glow-sm">👁 {t("sp_title")}</h1>
          <span className="text-xs text-gray-400" dir="ltr">
            #{code} · {map.name} · 👁 {state.spectators ?? 1}
          </span>
        </div>
        <div className="text-center text-white text-[clamp(16px,2vw,28px)] shrink-0" dir="ltr">
          {mmss(Math.floor(total - elapsed))}
        </div>

        <FitBox aspect={2} extraH={28}>
          {({ width, height }) => (
        <div className="flex flex-row gap-1" style={{ width, height }}>
          {players.map((p, i) => {
            const tone = i === 0 ? "neon" : "pink";
            const open = unlocked[p.userId] ?? p.unlocked;
            const b = bubbles[p.userId];
            const doorLeft = Object.entries(p.doors ?? {});
            return (
              <div key={p.userId} className={`flex-1 flex flex-col ring-1 ${tone === "neon" ? "ring-neon/40" : "ring-pink/40"} bg-[#0a0f24]`}>
                <div className="flex items-center justify-between gap-2 px-3 text-xs shrink-0" style={{ height: 28 }}>
                  <span className={tone === "neon" ? "text-neon" : "text-pink"}>
                    {p.nickname} <span className="text-gray-400" dir="ltr">{p.rating} MMR</span>
                    {!p.connected && <span className="ml-2 text-gray-500">({t("sp_offline")})</span>}
                  </span>
                  <span className="text-gray-300" dir="ltr">
                    {open.length} / {DOORS}
                    {doorLeft.length > 0 && !open.includes(Number(doorLeft[0][0])) && (
                      <span className="ml-2 text-yellow">🔒{doorLeft[0][0]} {mmss(doorLeft[0][1])}</span>
                    )}
                  </span>
                </div>
                <div ref={(el) => void (arenas.current[i] = el)} className="relative flex-1 overflow-hidden">
                  <MapLayer map={map} mirror={i === 1} unlocked={open} doors={{}} tone={tone} />
                  <div
                    ref={(el) => void (figures.current[i] = el)}
                    className="absolute z-20 pointer-events-none"
                    style={{ width: `${CHAR_W}%`, height: `${CHAR_H}%`, left: `${i === 1 ? 100 - p.x - CHAR_W : p.x}%`, bottom: `${p.y}%` }}
                  >
                    {b && b.until > Date.now() && <Bubble text={t(`ph_${b.text}`)} tone={tone} />}
                    <div ref={(el) => void (sprites.current[i] = el)} className="relative w-full h-full">
                      <AnimatedSkin ref={(h) => void (skins.current[i] = h)} id={p.skin} className="w-full h-full" fillBox />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </FitBox>
        <p className="text-center font-sans text-xs text-gray-400 shrink-0">{t("sp_hint")}</p>
      </div>
    </>
  );
}

export default function Watch() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <WatchScreen />}</ClientOnly>;
}
