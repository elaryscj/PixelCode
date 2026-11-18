// app/routes/teacher.tsx — /teacher : a teacher's lessons and the form for a new one (map, four tasks, length).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly, useCurrentUser } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import TeacherTasks from "~/components/TeacherTasks";
import TeacherPlans from "~/components/TeacherPlans";
import { teacherStatus, type TeacherStatus } from "~/api/teacher";
import { MAPS } from "~/game/maps";
import { createLesson, lessonCatalog, myLessons, type CatalogTask, type LessonSummary } from "~/api/lessons";

export function meta() {
  return [{ title: "Teacher | PixelCode Arena" }];
}

const LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
const levelColor: Record<string, string> = { EASY: "text-neon", MEDIUM: "text-yellow", HARD: "text-pink" };

function TeacherScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogTask[]>([]);
  const [status, setStatus] = useState<TeacherStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [mapId, setMapId] = useState(0);
  const [minutes, setMinutes] = useState(40);
  const [doors, setDoors] = useState<(number | null)[]>([null, null, null, null]);
  const [picking, setPicking] = useState<number | null>(null); // door index being chosen
  const [filter, setFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent("/teacher")}`, { replace: true });
      return;
    }
    void loadAll();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // access first: without it the page is the offer; past lessons stay readable after a subscription ends
  const loadAll = async () => {
    try {
      const st = await teacherStatus();
      setStatus(st);
      const [l, c] = await Promise.all([
        st.teacher ? myLessons() : Promise.resolve([] as LessonSummary[]),
        st.active ? lessonCatalog() : Promise.resolve([] as CatalogTask[]),
      ]);
      setLessons(l);
      setCatalog(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
      setLessons([]);
    }
  };
  const onStatus = (st: TeacherStatus) => {
    const turnedOn = st.active && !status?.active;
    setStatus(st);
    if (turnedOn) void loadAll();
  };

  const reloadCatalog = () => lessonCatalog().then(setCatalog).catch(() => {});
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const shown = catalog.filter((c) => filter === "ALL" || (filter === "MINE" ? c.mine : c.difficulty === filter));

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const l = await createLesson({
        title: title.trim(),
        mapId,
        challengeIds: doors.filter((d): d is number => d !== null),
        durationMinutes: minutes,
      });
      navigate(`/teacher/${l.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  if (lessons === null) return <ScreenLoading />;

  const field = "w-full bg-[#02050f] border-2 border-neon text-white px-3 py-2 font-sans text-lg outline-none focus:border-yellow";
  const label = "text-neon text-lg";

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-240 mx-auto font-pixel flex flex-col gap-6 px-4 py-6 enter-up">
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="border-2 border-pink text-pink px-3 py-1.5 text-lg hover:bg-pink/10">&lt; {t("menu")}</Link>
          <h1 className="text-yellow text-4xl sm:text-5xl text-glow-sm">{t("tc_title")}</h1>
        </header>

        {status && <TeacherPlans status={status} onChange={onStatus} />}
        {error && !status && <p className="text-pink text-lg font-sans">{error}</p>}
        {status?.teacher && (
          <>
            {status.active && (
            <section className="border-2 border-neon bg-[#070c1e]/90 p-4 sm:p-6 flex flex-col gap-4">
              <h2 className="text-neon text-3xl">&gt; {t("tc_new")}</h2>
              <div className="grid sm:grid-cols-[1fr_auto_auto] gap-4">
                <label className="flex flex-col gap-1">
                  <span className={label}>{t("tc_lesson_title")}</span>
                  <input className={field} value={title} maxLength={60} placeholder={t("tc_title_ph")} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={label}>{t("tc_map")}</span>
                  <select className={field} value={mapId} onChange={(e) => setMapId(Number(e.target.value))}>
                    {MAPS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={label}>{t("tc_minutes")}</span>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    className={`${field} w-28`}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {doors.map((id, i) => {
                  const task = id != null ? byId.get(id) : null;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPicking(picking === i ? null : i)}
                      className={`text-start border-2 px-3 py-2 ${picking === i ? "border-yellow bg-yellow/10" : "border-neon/60 hover:border-neon"}`}
                    >
                      <div className="text-gray-400 text-sm">{t("tc_door_n", { n: i + 1 })}</div>
                      {task ? (
                        <div className="text-white text-lg">
                          {task.title} <span className={`text-sm ${levelColor[task.difficulty]}`}>{task.difficulty}</span>
                        </div>
                      ) : (
                        <div className="text-pink text-lg">{t("tc_pick_task")}</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {picking !== null && (
                <div className="border-2 border-yellow/70 p-3 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-yellow text-lg me-2">{t("tc_door_n", { n: picking + 1 })}: {t("tc_pick_task")}</span>
                    {["ALL", ...(catalog.some((c) => c.mine) ? ["MINE"] : []), ...LEVELS].map((l) => (
                      <button
                        key={l}
                        onClick={() => setFilter(l)}
                        className={`text-sm px-2 py-0.5 border ${filter === l ? "border-yellow text-yellow" : "border-neon/40 text-neon/70"}`}
                      >
                        {l === "ALL" ? t("tc_filter_all") : l === "MINE" ? t("tt_mine") : l}
                      </button>
                    ))}
                  </div>
                  <ul className="max-h-80 overflow-y-auto flex flex-col gap-1 pe-1">
                    {shown.map((c) => {
                      const used = doors.includes(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => {
                              setDoors((d) => d.map((x, j) => (j === picking ? c.id : x)));
                              setPicking(picking < 3 && doors[picking + 1] == null ? picking + 1 : null);
                            }}
                            className={`w-full text-start px-3 py-2 border ${used ? "border-yellow/60 bg-yellow/5" : "border-neon/30 hover:border-neon"}`}
                          >
                            {c.mine && <span className="text-black bg-yellow text-xs px-1.5 py-0.5 me-2">{t("tt_mine")}</span>}
                            <span className="text-white text-lg">{c.title}</span>{" "}
                            <span className={`text-sm ${levelColor[c.difficulty]}`}>{c.difficulty}</span>
                            <span className="block text-gray-400 text-sm font-sans line-clamp-2">{c.description}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {error && <p className="text-pink text-lg font-sans">{error}</p>}
              <button
                onClick={create}
                disabled={busy || doors.some((d) => d === null) || !title.trim()}
                className="self-start bg-pink border-2 border-yellow text-black text-2xl px-8 py-3 disabled:opacity-50"
              >
                {t("tc_create")}
              </button>
            </section>

            )}
            {status.active && <TeacherTasks onChanged={reloadCatalog} />}

            <section className="flex flex-col gap-3">
              <h2 className="text-neon text-3xl">&gt; {t("tc_my_lessons")}</h2>
              {lessons.length === 0 && <p className="text-gray-400 text-lg font-sans">{t("tc_none")}</p>}
              <ul className="flex flex-col gap-2">
                {lessons.map((l) => (
                  <li key={l.code}>
                    <Link
                      to={`/teacher/${l.code}`}
                      className="flex flex-wrap items-center justify-between gap-3 border-2 border-neon/60 hover:border-neon bg-[#060b1e] px-4 py-3"
                    >
                      <span className="text-yellow text-2xl">{l.title}</span>
                      <span className="flex items-center gap-4 text-lg">
                        <span className="text-pink tracking-widest">{l.code}</span>
                        <span className="text-gray-300">{t("tc_students_n", { n: l.students ?? 0 })}</span>
                        <span className={l.status === "RUNNING" ? "text-neon animate-pulse" : "text-gray-400"}>
                          {t(`tc_status_${l.status}`)}
                        </span>
                        <span className="text-gray-500 text-sm font-sans">{new Date(l.createdAt).toLocaleDateString()}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default function Teacher() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <TeacherScreen />}</ClientOnly>;
}
