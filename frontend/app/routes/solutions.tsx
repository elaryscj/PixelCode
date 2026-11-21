// app/routes/solutions.tsx  —  /solutions/:id : the shortest and fastest accepted solutions of a challenge.
// Open only to players who met this challenge in a match (the server checks), so it cannot spoil a door.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { getBestSolutions, type BestSolutions, type SolutionRow } from "~/api/stats";

export function meta() {
  return [{ title: "Best solutions | PixelCode Arena" }];
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Row({ r, place, highlight }: { r: SolutionRow; place: number; highlight?: boolean }) {
  const { t } = useTranslation();
  return (
    <li className={`border bg-[#060b1e] ${highlight ? "border-yellow" : "border-neon/30"}`}>
      <details>
        <summary className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 cursor-pointer list-none">
          <span className="text-yellow w-6">{place}.</span>
          <span className="flex-1 min-w-32 text-white truncate">{r.nickname}</span>
          <span dir="ltr" className="font-sans text-xs text-gray-300">{t("bs_chars", { n: r.chars ?? 0 })}</span>
          <span dir="ltr" className="font-sans text-xs text-gray-300">{mmss(r.seconds)}</span>
          <span className="font-sans text-xs text-gray-400">{t("bs_attempts", { n: r.attempts })}</span>
          <span className="text-neon text-xs">{t("bs_show_code")}</span>
        </summary>
        <pre dir="ltr" className="m-0 px-3 py-2 border-t border-neon/20 bg-[#02050f] text-gray-100 text-xs font-mono overflow-x-auto whitespace-pre">
          {r.source}
        </pre>
      </details>
    </li>
  );
}

function SolutionsScreen() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [data, setData] = useState<BestSolutions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"shortest" | "fastest">("shortest");

  useEffect(() => {
    if (!me) {
      navigate("/login");
      return;
    }
    getBestSolutions(Number(id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("cm_unavailable")));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = data ? data[tab] : [];
  return (
    <>
      <div className="star-background" />
      <div className="container max-w-220 mx-auto font-pixel flex flex-col gap-4 px-4 py-6">
        <Link to="/results" className="self-start border-2 border-pink text-pink px-3 py-1.5 text-xs hover:bg-pink/10">
          &lt; {t("menu_results")}
        </Link>
        <h1 className="text-yellow text-5xl/none text-glow-sm">{t("bs_title")}</h1>
        {error && <p className="text-pink">{error}</p>}
        {!data && !error && <p className="text-neon animate-pulse">{t("mr_loading")}</p>}
        {data && (
          <>
            <div className="border border-neon/50 bg-[#060b1e] px-4 py-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-yellow text-xl">{data.title}</span>
                <span className="border border-neon/50 text-neon px-2 text-[10px]">{data.difficulty}</span>
              </div>
              <p className="font-sans text-sm text-gray-200 whitespace-pre-line">{data.description}</p>
            </div>

            {data.mine && (
              <div className="border border-yellow/60 bg-yellow/5 px-4 py-3 flex flex-col gap-2">
                <span className="text-yellow">{t("bs_mine")}</span>
                <span className="font-sans text-sm text-gray-200">
                  {t(`bs_${data.mine.outcome.toLowerCase()}`)} · {mmss(data.mine.seconds)} · {t("bs_attempts", { n: data.mine.attempts })}
                  {data.mine.chars != null && <> · {t("bs_chars", { n: data.mine.chars })}</>}
                </span>
                {data.mine.source && (
                  <pre dir="ltr" className="m-0 px-3 py-2 bg-[#02050f] text-gray-100 text-xs font-mono overflow-x-auto">{data.mine.source}</pre>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {(["shortest", "fastest"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  aria-pressed={tab === k}
                  className={`px-3 py-1.5 border text-sm ${tab === k ? "border-yellow text-yellow bg-yellow/10" : "border-neon/50 text-neon"}`}
                >
                  {t(`bs_${k}`)}
                </button>
              ))}
            </div>
            <p className="font-sans text-xs text-gray-400">{t(tab === "shortest" ? "bs_shortest_hint" : "bs_fastest_hint")}</p>
            {list.length === 0 ? (
              <p className="font-sans text-gray-400">{t("bs_none")}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {list.map((r, i) => (
                  <Row key={`${tab}-${r.userId}`} r={r} place={i + 1} highlight={r.userId === me?.id} />
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function Solutions() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <SolutionsScreen />}</ClientOnly>;
}
