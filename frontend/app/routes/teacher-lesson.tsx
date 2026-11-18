// app/routes/teacher-lesson.tsx — /teacher/:code : the lesson's live table. Big join code for the projector,
// start / end, and per student: each door solved / working / stuck, attempts, finish time and their code.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly, useCurrentUser } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import JoinQr from "~/components/JoinQr";
import { getMap } from "~/game/maps";
import { endLesson, lessonBoard, startLesson, studentWork, type Board, type DoorCell, type StudentWork } from "~/api/lessons";

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

const cellStyle: Record<DoorCell["state"], string> = {
  SOLVED: "border-neon bg-neon/15 text-neon",
  WORKING: "border-yellow bg-yellow/10 text-yellow",
  STUCK: "border-pink bg-pink/20 text-pink animate-pulse",
  LOCKED: "border-gray-700 text-gray-600",
};

function TeacherLessonScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { code: raw = "" } = useParams();
  const code = raw.trim().toUpperCase();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [work, setWork] = useState<StudentWork | null>(null);
  const [busy, setBusy] = useState(false);
  // the QR code over the whole screen, for the projector (like a quiz game's join screen)
  const [bigQr, setBigQr] = useState(false);

  const load = () =>
    lessonBoard(code)
      .then((b) => {
        setBoard(b);
        setOffset(b.serverTime - Date.now());
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("unexpected_error")));

  useEffect(() => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/teacher/${code}`)}`, { replace: true });
      return;
    }
    void load();
    const id = setInterval(load, 3000);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(id);
      clearInterval(tick);
    };
  }, [code, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!board) {
    return error ? (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-pixel px-4 text-center">
        <p className="text-pink text-xl">{error}</p>
        <Link to="/teacher" className="border-2 border-neon text-yellow px-6 py-2 text-xl">{t("tc_my_lessons")}</Link>
      </div>
    ) : (
      <ScreenLoading />
    );
  }

  const serverNow = now + offset;
  const joinUrl = `${window.location.origin}/lesson/${board.code}`;
  const shortUrl = `${window.location.host}/lesson`;
  const status = board.status === "RUNNING" && board.endsAt != null && serverNow >= board.endsAt ? "ENDED" : board.status;
  const countdown = status === "RUNNING" && board.startsAt != null && serverNow < board.startsAt
    ? Math.ceil((board.startsAt - serverNow) / 1000)
    : null;
  const left = board.endsAt != null ? (board.endsAt - serverNow) / 1000 : board.durationMinutes * 60;
  const finished = board.students.filter((s) => s.finishedSeconds != null).length;
  const stuck = board.students.filter((s) => s.doors.some((d) => d.state === "STUCK")).length;

  const act = async (f: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  const openWork = (id: number) =>
    studentWork(code, id)
      .then(setWork)
      .catch((e) => setError(e instanceof Error ? e.message : t("unexpected_error")));

  return (
    <>
      <div className="star-background" />
      <div className="max-w-300 mx-auto font-pixel flex flex-col gap-5 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/teacher" className="border-2 border-pink text-pink px-3 py-1.5 text-lg hover:bg-pink/10">
            &lt; {t("tc_my_lessons")}
          </Link>
          <div className="text-end">
            <h1 className="text-yellow text-3xl sm:text-4xl">{board.title}</h1>
            <div className="text-gray-400 text-lg">
              {getMap(board.mapId).name} · {t(`tc_status_${status}`)}
            </div>
          </div>
        </header>

        {/* join code, big enough for a projector */}
        <section className="border-2 border-neon bg-[#070c1e]/90 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-6">
          <button
            onClick={() => setBigQr(true)}
            className="shrink-0 border-2 border-neon hover:border-yellow"
            title={t("tb_show_qr")}
            aria-label={t("tb_show_qr")}
          >
            <JoinQr url={joinUrl} className="w-36 h-36 sm:w-44 sm:h-44 block" />
          </button>
          <div className="flex flex-col gap-2 me-auto">
            <div className="text-gray-300 text-lg font-sans">{t("tb_join_at", { url: shortUrl })}</div>
            <div className="text-pink text-6xl sm:text-8xl tracking-[0.3em] text-glow-sm">{board.code}</div>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(joinUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="self-start border border-neon text-neon px-3 py-1 text-sm hover:bg-neon/10"
            >
              {copied ? t("tb_copied") : t("tb_copy_link")}
            </button>
            <button onClick={() => setBigQr(true)} className="self-start border border-yellow text-yellow px-3 py-1 text-sm hover:bg-yellow/10">
              {t("tb_show_qr")}
            </button>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-white text-4xl">
              {countdown !== null ? t("ls_starts_in", { n: countdown }) : `${t("tb_time_left")}: ${clock(status === "ENDED" ? 0 : left)}`}
            </div>
            <div className="flex gap-4 text-lg">
              <span className="text-neon">{t("tb_joined", { n: board.students.length })}</span>
              <span className="text-yellow">{t("tb_finished", { n: finished })}</span>
              <span className="text-pink">{t("tb_stuck", { n: stuck })}</span>
            </div>
            {status === "LOBBY" && (
              <button
                onClick={() => act(() => startLesson(code))}
                disabled={busy}
                className="bg-pink border-2 border-yellow text-black text-2xl px-8 py-3 disabled:opacity-50 shadow-[0_0_18px_rgba(254,44,150,0.45)]"
              >
                ▶ {t("tb_start")}
              </button>
            )}
            {status === "RUNNING" && (
              <button
                onClick={() => window.confirm(t("tb_end_confirm")) && act(() => endLesson(code))}
                disabled={busy}
                className="border-2 border-pink text-pink text-xl px-6 py-2 hover:bg-pink/10 disabled:opacity-50"
              >
                ■ {t("tb_end")}
              </button>
            )}
          </div>
        </section>

        {error && <p className="text-pink text-lg font-sans">{error}</p>}

        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-neon">■ {t("tb_legend_solved")}</span>
          <span className="text-yellow">■ {t("tb_legend_working")}</span>
          <span className="text-pink">■ {t("tb_legend_stuck")}</span>
          <span className="text-gray-500">■ {t("tb_legend_locked")}</span>
        </div>

        {board.students.length === 0 ? (
          <p className="text-gray-400 text-xl font-sans">{t("tb_no_students")}</p>
        ) : (
          <div className="overflow-x-auto border-2 border-neon/60">
            <table className="w-full min-w-[720px] text-lg">
              <thead>
                <tr className="text-neon text-sm bg-[#0d162a]">
                  <th className="px-2 py-2 text-start">#</th>
                  <th className="px-2 py-2 text-start">{t("tb_student")}</th>
                  {board.doors.map((d, i) => (
                    <th key={d.id} className="px-2 py-2 text-start font-normal">
                      <div>{t("tc_door_n", { n: i + 1 })}</div>
                      <div className="text-gray-400 text-xs font-sans truncate max-w-40">{d.title}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-start">{t("tb_finish")}</th>
                </tr>
              </thead>
              <tbody>
                {board.students.map((s) => (
                  <tr key={s.id} className="border-t border-neon/20 hover:bg-neon/5 cursor-pointer" onClick={() => openWork(s.id)}>
                    <td className="px-2 py-2 text-yellow">{s.place}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-block w-2 h-2 me-2 ${s.online ? "bg-neon" : "bg-gray-600"}`} />
                      <span className="text-white">{s.name}</span>
                    </td>
                    {s.doors.map((d) => (
                      <td key={d.door} className="px-1 py-1">
                        <div className={`border px-2 py-1 text-sm leading-tight ${cellStyle[d.state]}`}>
                          <div>{d.state === "LOCKED" ? "—" : d.seconds != null ? clock(d.seconds) : ""}</div>
                          {d.attempts > 0 && <div className="text-xs opacity-80">{t("tb_attempts", { n: d.attempts })}</div>}
                        </div>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-yellow">{s.finishedSeconds != null ? clock(s.finishedSeconds) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {bigQr && (
        <div
          // above the CRT scanlines (z-60): stripes over the code make it harder to scan
          className="fixed inset-0 z-[70] bg-[#050814] flex flex-col items-center justify-center gap-3 p-4 font-pixel cursor-pointer overflow-hidden"
          onClick={() => setBigQr(false)}
        >
          <div className="text-yellow text-2xl sm:text-4xl text-center">{t("tb_scan")}</div>
          <JoinQr url={joinUrl} className="w-[min(56vh,84vw)] h-[min(56vh,84vw)] border-4 border-neon" />
          <div className="text-gray-300 text-lg sm:text-2xl font-sans text-center">{t("tb_join_at", { url: shortUrl })}</div>
          <div className="flex flex-wrap items-baseline justify-center gap-x-8 gap-y-1">
            <span className="text-pink text-5xl sm:text-7xl tracking-[0.3em] text-glow-sm">{board.code}</span>
            <span className="text-neon text-2xl">{t("tb_joined", { n: board.students.length })}</span>
          </div>
        </div>
      )}

      {work && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-6" onClick={() => setWork(null)}>
          <div
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#080d1a] border-2 border-neon p-4 font-pixel flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-yellow text-2xl">{t("tb_work_title", { name: work.name })}</h2>
              <button onClick={() => setWork(null)} className="text-gray-400 hover:text-pink border border-gray-600 px-3 py-1">
                {t("cm_close")}
              </button>
            </div>
            {work.submissions.length === 0 && <p className="text-gray-400 font-sans">{t("tb_no_work")}</p>}
            {[...work.submissions].reverse().map((s, i) => (
              <div key={i} className={`border ${s.passed ? "border-neon" : "border-pink/60"}`}>
                <div className="flex flex-wrap justify-between gap-2 px-3 py-1 bg-[#0d162a] text-sm">
                  <span className="text-white">{t("tc_door_n", { n: s.door })}</span>
                  <span className={s.passed ? "text-neon" : "text-pink"}>
                    {s.passed ? t("tb_passed") : t("tb_failed", { passed: s.passedCount, total: s.total })}
                  </span>
                  <span className="text-gray-400">{t("tb_at", { time: clock(s.atSecond) })}</span>
                </div>
                {s.error && <div dir="ltr" className="px-3 py-1 text-pink text-xs font-mono whitespace-pre-wrap">{s.error}</div>}
                <pre dir="ltr" className="px-3 py-2 text-emerald-400 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {s.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function TeacherLesson() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <TeacherLessonScreen />}</ClientOnly>;
}
