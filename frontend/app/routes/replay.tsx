// app/routes/replay.tsx  —  /replay/:code : watch a finished match again (both players' runs, doors, solutions)
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FaPause, FaPlay } from "react-icons/fa";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { AnimatedSkin, type AnimId, type SkinHandle } from "~/components/skins";
import { FitBox } from "~/components/game/FitBox";
import { MapLayer, animateMap } from "~/components/game/MapLayer";
import { Bubble, isPhrase } from "~/components/game/PhraseBar";
import { getMap } from "~/game/maps";
import { CHAR_H, CHAR_W, DOOR_W, DOORS } from "~/game/physics";
import { getReplay, positionAt, type Replay, type ReplayAttempt, type ReplayEvent } from "~/api/replay";

export function meta() {
  return [{ title: "Replay | PixelCode Arena" }];
}

const SPEEDS = [1, 2, 4, 8];
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

type Side = { userId: number; nickname: string; skin?: string; track: number[]; tone: "neon" | "pink"; mirror: boolean };

function ReplayScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const me = getCurrentUser();
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0); // shown time (updated a few times a second)
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [codeView, setCodeView] = useState<{ cp: number; userId: number } | null>(null);

  const clock = useRef(0); // the real playback position, advanced every frame
  const arenas = useRef<(HTMLDivElement | null)[]>([null, null]);
  const figures = useRef<(HTMLDivElement | null)[]>([null, null]);
  const sprites = useRef<(HTMLDivElement | null)[]>([null, null]);
  const skins = useRef<(SkinHandle | null)[]>([null, null]);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  playingRef.current = playing;
  speedRef.current = speed;

  useEffect(() => {
    if (!me) {
      navigate(`/login?next=${encodeURIComponent(`/replay/${code}`)}`);
      return;
    }
    getReplay(code)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("unexpected_error")));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const map = data ? getMap(data.mapId) : null;
  // me on the left (like in the match), the rival mirrored on the right
  const sides: Side[] = useMemo(() => {
    if (!data) return [];
    const mine = data.players.find((p) => p.userId === me?.id) ?? data.players[0];
    const other = data.players.find((p) => p !== mine);
    const out: Side[] = [{ ...mine, tone: "neon", mirror: false }];
    if (other) out.push({ ...other, tone: "pink", mirror: true });
    return out;
  }, [data, me?.id]);

  const duration = useMemo(() => {
    if (!data) return 0;
    const lastTrack = Math.max(0, ...data.players.map((p) => p.track[p.track.length - 3] ?? 0));
    const lastEvent = Math.max(0, ...data.events.map((e) => e.t));
    return Math.max((data.result?.durationSeconds ?? 0) * 1000, lastTrack, lastEvent, 1000);
  }, [data]);

  const unlocks = useMemo(() => (data ? data.events.filter((e) => e.type === "UNLOCK") : []), [data]);
  const opens = useMemo(() => (data ? data.events.filter((e) => e.type === "OPEN") : []), [data]);
  const unlockedAt = (userId: number, at: number) => unlocks.filter((e) => e.userId === userId && e.t <= at).map((e) => e.cp!);

  // who led when (more doors open = ahead): coloured stretches under the timeline
  const leadStretches = useMemo(() => {
    if (sides.length < 2) return [];
    const marks = [0, ...unlocks.map((e) => e.t), duration].sort((a, b) => a - b);
    const out: { from: number; to: number; leader: number | null }[] = [];
    for (let i = 0; i < marks.length - 1; i++) {
      const at = marks[i];
      const a = unlocks.filter((e) => e.userId === sides[0].userId && e.t <= at).length;
      const b = unlocks.filter((e) => e.userId === sides[1].userId && e.t <= at).length;
      out.push({ from: at, to: marks[i + 1], leader: a === b ? null : a > b ? 0 : 1 });
    }
    return out;
  }, [unlocks, sides, duration]);
  const overtakes = useMemo(() => {
    const list: { t: number; leader: number }[] = [];
    let prev: number | null = null;
    for (const s of leadStretches) {
      if (s.leader !== null && prev !== null && s.leader !== prev) list.push({ t: s.from, leader: s.leader });
      if (s.leader !== null) prev = s.leader;
    }
    return list;
  }, [leadStretches]);

  // ---------------------------------------------------------------- playback loop
  useEffect(() => {
    if (!data || !map) return;
    let raf = 0;
    let last = performance.now();
    let shown = -1;
    const loop = () => {
      const now = performance.now();
      if (playingRef.current) clock.current = Math.min(duration, clock.current + (now - last) * speedRef.current);
      last = now;
      if (clock.current >= duration && playingRef.current) setPlaying(false);
      const at = clock.current;
      sides.forEach((s, i) => {
        const pos = positionAt(s.track, at);
        const ahead = positionAt(s.track, at + 120);
        const x = s.mirror ? 100 - pos.x - CHAR_W : pos.x;
        const fig = figures.current[i];
        if (fig) {
          fig.style.left = `${x}%`;
          fig.style.bottom = `${pos.y}%`;
        }
        const dx = ahead.x - pos.x;
        const dy = ahead.y - pos.y;
        if (sprites.current[i] && Math.abs(dx) > 0.05) {
          const right = s.mirror ? dx < 0 : dx > 0;
          sprites.current[i]!.style.transform = `scaleX(${right ? 1 : -1})`;
        }
        // what the figure is doing: moving, a recent emote, or standing at a locked door (solving it)
        const emote = [...data.events]
          .reverse()
          .find((e) => e.userId === s.userId && e.type === "EMOTE" && e.t <= at && at - e.t < 1900);
        const open = unlockedAt(s.userId, at);
        const atDoor = map.doors.some(
          (d) => !open.includes(d.num) && Math.abs(pos.x + CHAR_W / 2 - (d.x + DOOR_W / 2)) < 10 && pos.y >= d.y - 0.5 && pos.y < d.y + 6,
        );
        let anim: AnimId = dy > 0.4 ? "jump" : dy < -0.4 ? "fall" : Math.abs(dx) > 0.05 ? "walk" : atDoor ? "think" : "idle";
        if (anim === "idle" && emote && (emote.detail === "wave" || emote.detail === "dance")) anim = emote.detail;
        skins.current[i]?.setAnim(anim);
        animateMap(arenas.current[i], map, (data.startedAt + at) / 1000, s.mirror, null);
      });
      // the React-drawn parts (doors, scrubber, bubbles) only need a few updates a second
      const step = Math.floor(at / 100);
      if (step !== shown) {
        shown = step;
        setTime(at);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [data, map, sides, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (ms: number) => {
    clock.current = Math.max(0, Math.min(duration, ms));
    setTime(clock.current);
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-pixel px-4 text-center">
        <div className="star-background" />
        <p className="text-pink text-2xl">{error}</p>
        <p className="font-sans text-gray-400 text-sm">{t("rp_kept")}</p>
        <Link to="/results" className="border-2 border-neon text-yellow px-6 py-2">
          {t("menu_results")}
        </Link>
      </div>
    );
  }
  if (!data || !map) return <ScreenLoading />;

  const phraseNow = (userId: number) =>
    [...data.events].reverse().find((e) => e.userId === userId && e.type === "PHRASE" && e.t <= time && time - e.t < 2600);
  const nameOf = (userId: number | null) => data.players.find((p) => p.userId === userId)?.nickname ?? "—";
  const winner = data.result?.winnerUserId ?? null;

  const doorStats = (cp: number, userId: number) => {
    const open = opens.find((e) => e.userId === userId && e.cp === cp);
    const unlock = unlocks.find((e) => e.userId === userId && e.cp === cp);
    const tries: ReplayAttempt[] = data.doors.find((d) => d.cp === cp)?.attempts[String(userId)] ?? [];
    return { open, unlock, tries, spent: open && unlock ? unlock.t - open.t : open ? duration - open.t : null };
  };
  // the door each player spent the longest at = where they got stuck
  const stuckDoor = (userId: number) => {
    let best: number | null = null;
    let longest = 90_000; // a door solved within a minute and a half is not "stuck"
    for (const d of data.doors) {
      const s = doorStats(d.cp, userId).spent;
      if (s !== null && s > longest) {
        longest = s;
        best = d.cp;
      }
    }
    return best;
  };

  return (
    <>
      <div className="star-background" />
      <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 py-4 font-pixel flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/results" className="border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10">
            &lt; {t("menu_results")}
          </Link>
          <h1 className="text-yellow text-[clamp(16px,2.4vw,40px)] text-glow-sm">{t("replay_title")}</h1>
          <span className="text-xs text-gray-400" dir="ltr">
            #{data.code} · {map.name}
          </span>
        </div>
        <p className="text-center text-sm sm:text-base text-gray-200">
          {winner === null ? t("rp_draw") : t("rp_winner", { name: nameOf(winner) })}
        </p>

        {/* the two runs, side by side like in the match */}
        {/* arenas keep their square shape; the timeline and door details below may scroll */}
        <div className="flex h-[64dvh] min-h-[260px]">
        <FitBox aspect={2} extraH={28}>
          {({ width, height }) => (
        <div className="flex flex-row gap-1" style={{ width, height }}>
          {sides.map((s, i) => {
            const open = unlockedAt(s.userId, time);
            const said = phraseNow(s.userId);
            return (
              <div key={s.userId} className={`flex-1 flex flex-col ring-1 ${s.tone === "neon" ? "ring-neon/40" : "ring-pink/40"} bg-[#0a0f24]`}>
                <div className="flex items-center justify-between px-3 text-xs shrink-0" style={{ height: 28 }}>
                  <span className={s.tone === "neon" ? "text-neon" : "text-pink"}>
                    {s.nickname} {s.userId === me?.id && `(${t("tag_you")})`}
                  </span>
                  <span className="text-gray-300" dir="ltr">
                    {open.length} / {DOORS}
                  </span>
                </div>
                <div ref={(el) => void (arenas.current[i] = el)} className="relative flex-1 overflow-hidden">
                  <MapLayer map={map} mirror={s.mirror} unlocked={open} doors={{}} tone={s.tone} />
                  <div ref={(el) => void (figures.current[i] = el)} className="absolute z-20 pointer-events-none" style={{ width: `${CHAR_W}%`, height: `${CHAR_H}%` }}>
                    {said && isPhrase(said.detail) && <Bubble text={t(`ph_${said.detail}`)} tone={s.tone} />}
                    <div ref={(el) => void (sprites.current[i] = el)} className="relative w-full h-full">
                      <AnimatedSkin ref={(h) => void (skins.current[i] = h)} id={s.skin} className="w-full h-full" fillBox />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </FitBox>
        </div>

        {/* playback controls + timeline */}
        <div className="flex flex-col gap-2 border-2 border-neon/40 bg-[#060b1e] px-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (clock.current >= duration) seek(0);
                setPlaying((p) => !p);
              }}
              className="w-11 h-11 flex items-center justify-center border-2 border-yellow text-yellow"
              aria-label={playing ? t("rp_pause") : t("rp_play")}
            >
              {playing ? <FaPause /> : <FaPlay />}
            </button>
            <span className="text-neon text-sm w-28" dir="ltr">
              {mmss(time)} / {mmss(duration)}
            </span>
            <div className="flex gap-1">
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpeed(sp)}
                  className={`px-2 py-1 border text-xs ${speed === sp ? "border-yellow bg-yellow text-black" : "border-neon/50 text-gray-200"}`}
                >
                  {sp}×
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-400 ms-auto">{t("rp_timeline_hint")}</span>
          </div>
          <div className="relative h-10 select-none" dir="ltr">
            {/* who was ahead */}
            <div className="absolute inset-x-0 bottom-0 h-2 flex">
              {leadStretches.map((st, k) => (
                <div
                  key={k}
                  style={{ width: `${((st.to - st.from) / duration) * 100}%` }}
                  className={st.leader === null ? "bg-gray-700" : st.leader === 0 ? "bg-neon/70" : "bg-pink/70"}
                />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={duration}
              step={100}
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label={t("rp_timeline")}
              className="absolute inset-x-0 top-1 w-full accent-yellow"
            />
            {/* door markers: filled = solved, hollow = opened by the timer */}
            {unlocks.map((e, k) => {
              const side = sides.findIndex((s) => s.userId === e.userId);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => seek(e.t - 3000)}
                  title={`${nameOf(e.userId)} · ${t("rp_door", { n: e.cp })} · ${e.detail === "SOLVED" ? t("rp_solved") : t("rp_auto")} · ${mmss(e.t)}`}
                  className={`absolute bottom-2.5 -translate-x-1/2 w-3 h-3 border-2 ${side === 0 ? "border-neon" : "border-pink"} ${
                    e.detail === "SOLVED" ? (side === 0 ? "bg-neon" : "bg-pink") : "bg-transparent"
                  }`}
                  style={{ left: `${(e.t / duration) * 100}%` }}
                />
              );
            })}
          </div>
          {overtakes.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {overtakes.map((o, k) => (
                <button key={k} type="button" onClick={() => seek(o.t - 5000)} className={`border px-2 py-0.5 ${o.leader === 0 ? "border-neon text-neon" : "border-pink text-pink"}`}>
                  ⇄ {t("rp_overtake", { name: sides[o.leader].nickname })} · <span dir="ltr">{mmss(o.t)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* doors: time, attempts and the code */}
        <section className="flex flex-col gap-2">
          <h2 className="text-yellow text-2xl">{t("rp_doors")}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {data.doors.map((d) => (
              <div key={d.cp} className="border-2 border-neon/30 bg-[#060b1e] px-3 py-2 flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-yellow">
                    {t("rp_door", { n: d.cp })} · <span dir="ltr">{d.title}</span>
                  </span>
                  <span className="text-[10px] text-pink">{d.difficulty}</span>
                </div>
                <p className="font-sans text-xs text-gray-400 line-clamp-2">{d.description}</p>
                {sides.map((s) => {
                  const st = doorStats(d.cp, s.userId);
                  const stuck = stuckDoor(s.userId) === d.cp;
                  return (
                    <div key={s.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={`w-28 truncate ${s.tone === "neon" ? "text-neon" : "text-pink"}`}>{s.nickname}</span>
                      <span className="text-gray-200 font-sans">
                        {!st.open
                          ? t("rp_not_reached")
                          : !st.unlock
                            ? t("rp_not_opened")
                            : st.unlock.detail === "SOLVED"
                              ? t("rp_solved_in", { time: mmss(st.spent ?? 0) })
                              : t("rp_auto_after", { time: mmss(st.spent ?? 0) })}
                      </span>
                      {st.tries.length > 0 && <span className="text-gray-400 font-sans">{t("rp_attempts", { n: st.tries.length })}</span>}
                      {stuck && <span className="text-yellow">⚠ {t("rp_stuck")}</span>}
                      {st.tries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCodeView({ cp: d.cp, userId: s.userId })}
                          className="ms-auto border border-yellow/70 text-yellow px-2 py-0.5 hover:bg-yellow/10"
                        >
                          {"</>"} {t("rp_show_code")}
                        </button>
                      )}
                      {st.open && (
                        <button type="button" onClick={() => seek(st.open!.t - 2000)} className="border border-neon/50 text-gray-200 px-2 py-0.5">
                          ▶ <span dir="ltr">{mmss(st.open.t)}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>

      {codeView && (
        <CodeModal
          title={`${nameOf(codeView.userId)} · ${t("rp_door", { n: codeView.cp })} · ${data.doors.find((d) => d.cp === codeView.cp)?.title ?? ""}`}
          attempts={data.doors.find((d) => d.cp === codeView.cp)?.attempts[String(codeView.userId)] ?? []}
          onClose={() => setCodeView(null)}
        />
      )}
    </>
  );
}

function CodeModal({ title, attempts, onClose }: { title: string; attempts: ReplayAttempt[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [pick, setPick] = useState(attempts.length - 1);
  const a = attempts[pick];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/75 flex items-center justify-center p-3 font-pixel" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col gap-3 border-2 border-yellow bg-[#070c1e] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-yellow text-lg" dir="auto">
            {title}
          </span>
          <button type="button" onClick={onClose} className="border border-pink text-pink px-2" aria-label={t("rp_close")}>
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {attempts.map((x, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPick(i)}
              className={`px-2 py-1 border text-xs ${i === pick ? "border-yellow bg-yellow text-black" : x.passed ? "border-neon text-neon" : "border-pink/60 text-pink"}`}
            >
              #{i + 1} {x.passed ? "✔" : `${x.passedCount}/${x.total}`}
            </button>
          ))}
        </div>
        {a && (
          <>
            <span className="text-xs text-gray-300 font-sans">
              {a.passed ? t("rp_code_passed") : t("rp_code_failed", { n: a.passedCount, total: a.total })} · <span dir="ltr">{mmss(a.t)}</span>
            </span>
            <pre dir="ltr" className="flex-1 overflow-auto bg-[#02050f] border border-neon/40 p-3 text-xs sm:text-sm text-gray-100 font-mono whitespace-pre">
              {a.code}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReplayRoute() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <ReplayScreen />}</ClientOnly>;
}
