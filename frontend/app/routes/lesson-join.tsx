// app/routes/lesson-join.tsx — /lesson and /lesson/:code : a student joins a lesson with the code and a name.
// No account needed; the server hands back a token kept in this browser (api/lessons.ts).
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { joinLesson, lessonMe, lessonToken } from "~/api/lessons";

export function meta() {
  return [{ title: "Join a lesson | PixelCode Arena" }];
}

function LessonJoinScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code: fromUrl = "" } = useParams();
  const [code, setCode] = useState(fromUrl.trim().toUpperCase());
  const [name, setName] = useState(() => getCurrentUser()?.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // already joined this lesson in this browser (e.g. the tab was closed): straight back in
  useEffect(() => {
    const c = fromUrl.trim().toUpperCase();
    if (!c || !lessonToken(c)) return;
    lessonMe(c)
      .then(() => navigate(`/lesson/${c}/play`, { replace: true }))
      .catch(() => {});
  }, [fromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinLesson(c, name.trim());
      navigate(`/lesson/${c}/play`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-[#02050f] border-2 border-neon text-white px-4 py-3 font-sans text-xl outline-none focus:border-yellow";

  return (
    <>
      <div className="star-background" />
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 font-pixel px-4 py-8">
        <h1 className="text-yellow text-4xl sm:text-6xl text-glow-sm text-center">{t("lj_title")}</h1>
        <form onSubmit={submit} className="w-full max-w-md flex flex-col gap-4 border-2 border-neon bg-[#070c1e]/90 p-6">
          <label className="flex flex-col gap-2">
            <span className="text-neon text-lg">{t("lj_code")}</span>
            <input
              className={`${field} tracking-[0.4em] uppercase text-center text-3xl`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              placeholder="ABC234"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-neon text-lg">{t("lj_name")}</span>
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              autoComplete="nickname"
              maxLength={24}
              required
              autoFocus={!!fromUrl}
            />
            <span className="text-gray-400 text-sm font-sans">{t("lj_name_hint")}</span>
          </label>
          {error && <p className="text-pink text-lg font-sans">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="bg-pink border-2 border-yellow text-black text-2xl py-3 disabled:opacity-60 shadow-[0_0_18px_rgba(254,44,150,0.45)]"
          >
            {busy ? t("lj_joining") : t("lj_join")}
          </button>
        </form>
        <Link to="/" className="text-gray-400 hover:text-white text-lg">
          &lt; {t("menu")}
        </Link>
      </div>
    </>
  );
}

export default function LessonJoin() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <LessonJoinScreen />}</ClientOnly>;
}
