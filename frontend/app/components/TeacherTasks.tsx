// app/components/TeacherTasks.tsx — a teacher's own tasks for their class (private, never in public matches).
// The form is the same idea as the admin's challenge form; the server checks the reference solution on save.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "~/api/http";
import { myTasks, saveTask, type TeacherTask } from "~/api/lessons";

const blank = (): TeacherTask => ({
  title: "",
  difficulty: "EASY",
  description: "",
  inputDescription: "",
  outputDescription: "",
  functionName: "solve",
  examples: "solve(2, 3) -> 5",
  testsJson: '[\n  {"input": [2, 3], "expected": 5},\n  {"input": [10, -4], "expected": 6},\n  {"input": [0, 0], "expected": 0}\n]',
  referenceSolution: "class Solution {\n    public static int solve(int a, int b) {\n        return a + b;\n    }\n}\n",
});

const levelColor: Record<string, string> = { EASY: "text-neon", MEDIUM: "text-yellow", HARD: "text-pink" };

export default function TeacherTasks({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [form, setForm] = useState<TeacherTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  const load = () => myTasks().then(setTasks).catch(() => {});
  useEffect(() => {
    void load();
  }, []);

  const set = (k: keyof TeacherTask) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const save = async () => {
    if (!form || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveTask(form);
      setForm(null);
      await load();
      onChanged();
    } catch (e) {
      setError({
        text: e instanceof Error ? e.message : t("unexpected_error"),
        field: e instanceof ApiError ? (e.data?.field as string | undefined) : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const field = (name: keyof TeacherTask) =>
    `w-full bg-[#02050f] border-2 ${error?.field === name ? "border-pink" : "border-neon"} text-white px-3 py-2 font-sans text-base outline-none focus:border-yellow`;
  const code = (name: keyof TeacherTask) => `${field(name)} font-mono text-sm`;
  const label = "text-neon text-lg";

  return (
    <section className="border-2 border-neon bg-[#070c1e]/90 p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-neon text-3xl">&gt; {t("tt_my_tasks")}</h2>
        {!form && (
          <button onClick={() => { setError(null); setForm(blank()); }} className="border-2 border-yellow text-yellow px-4 py-1.5 text-xl hover:bg-yellow/10">
            + {t("tt_new")}
          </button>
        )}
      </div>
      <p className="text-gray-400 text-base font-sans">{t("tt_private")}</p>

      {!form && tasks.length === 0 && <p className="text-gray-300 text-lg font-sans">{t("tt_none")}</p>}
      {!form && tasks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 border border-neon/40 px-3 py-2">
              <span className="min-w-0">
                <span className="text-white text-lg">{task.title}</span>{" "}
                <span className={`text-sm ${levelColor[task.difficulty]}`}>{task.difficulty}</span>
                <span className="block text-gray-400 text-sm font-sans line-clamp-1">{task.description}</span>
              </span>
              <button
                onClick={() => { setError(null); setForm({ ...blank(), ...task, inputDescription: task.inputDescription ?? "", outputDescription: task.outputDescription ?? "", examples: task.examples ?? "", referenceSolution: task.referenceSolution ?? "" }); }}
                className="border border-neon text-neon px-3 py-1 text-sm hover:bg-neon/10"
              >
                {t("tt_edit")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3">
            <label className="flex flex-col gap-1">
              <span className={label}>{t("tt_title")}</span>
              <input className={field("title")} maxLength={80} value={form.title} placeholder={t("tt_title_ph")} onChange={set("title")} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>{t("tt_difficulty")}</span>
              <select className={field("difficulty")} value={form.difficulty} onChange={set("difficulty")}>
                <option>EASY</option>
                <option>MEDIUM</option>
                <option>HARD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>{t("tt_method")}</span>
              <input dir="ltr" className={`${code("functionName")} sm:w-40`} value={form.functionName} onChange={set("functionName")} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>{t("tt_description")}</span>
            <textarea className={field("description")} rows={4} value={form.description} onChange={set("description")} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={label}>{t("tt_input")}</span>
              <input className={field("inputDescription")} value={form.inputDescription} onChange={set("inputDescription")} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>{t("tt_output")}</span>
              <input className={field("outputDescription")} value={form.outputDescription} onChange={set("outputDescription")} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>{t("tt_examples")}</span>
            <textarea dir="ltr" className={code("examples")} rows={2} value={form.examples} onChange={set("examples")} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>{t("tt_tests")}</span>
            <span className="text-gray-400 text-sm font-sans">{t("tt_tests_hint")}</span>
            <textarea dir="ltr" spellCheck={false} className={code("testsJson")} rows={6} value={form.testsJson} onChange={set("testsJson")} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>{t("tt_reference")}</span>
            <textarea dir="ltr" spellCheck={false} className={code("referenceSolution")} rows={7} value={form.referenceSolution} onChange={set("referenceSolution")} />
          </label>
          {error && <p dir="auto" className="text-pink text-base font-sans whitespace-pre-wrap">{error.text}</p>}
          <div className="flex flex-wrap gap-3">
            <button onClick={save} disabled={busy} className="bg-pink border-2 border-yellow text-black text-xl px-6 py-2 disabled:opacity-60">
              {busy ? t("tt_saving") : t("tt_save")}
            </button>
            <button onClick={() => { setForm(null); setError(null); }} className="border-2 border-gray-500 text-gray-300 text-xl px-6 py-2">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
