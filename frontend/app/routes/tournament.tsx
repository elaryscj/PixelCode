// app/routes/tournament.tsx  —  /tournament : the weekend tournament (Saturday 00:00 - Monday 00:00, Kazakhstan time)
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { getTournament, type Tournament, type TournamentRow } from "~/api/stats";
import { languageInfo } from "~/language-config/languages";

export function meta() {
  return [{ title: "Weekend tournament | PixelCode Arena" }];
}

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const MEDAL = ["text-yellow", "text-gray-200", "text-orange-300"];

function TournamentScreen() {
  const { t, i18n } = useTranslation();
  const locale = languageInfo(i18n.resolvedLanguage).htmlLang;
  const me = getCurrentUser();
  const [data, setData] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);

  useEffect(() => {
    const load = () =>
      getTournament()
        .then((d) => {
          setData(d);
          setSkew(d.serverTime - Date.now());
        })
        .catch((e) => setError(e instanceof Error ? e.message : t("cm_unavailable")));
    load();
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const serverNow = now + skew;
  const row = (r: TournamentRow, mine: boolean) => (
    <li
      key={r.userId}
      className={`flex items-center gap-3 px-3 py-2 border bg-[#060b1e] ${mine ? "border-yellow" : "border-neon/30"}`}
    >
      <span className={`w-8 text-xl ${MEDAL[r.place - 1] ?? "text-neon"}`}>{r.place}</span>
      <span className="flex-1 truncate text-white">{r.nickname ?? me?.username}</span>
      <span className="font-sans text-xs text-gray-400">{t("tn_wins_played", { w: r.wins, n: r.played })}</span>
      <span dir="ltr" className="text-yellow text-lg w-20 text-end">{t("tn_pts", { n: r.points })}</span>
    </li>
  );

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-200 mx-auto font-pixel flex flex-col gap-4 px-4 py-6">
        <Link to="/" className="self-start border-2 border-pink text-pink px-3 py-1.5 text-xs hover:bg-pink/10">
          &lt; {t("menu")}
        </Link>
        <h1 className="text-yellow text-5xl/none sm:text-6xl/none text-center text-glow-sm">{t("tn_title")}</h1>
        {error && <p className="text-pink text-center">{error}</p>}
        {!data && !error && <p className="text-neon text-center animate-pulse">{t("mr_loading")}</p>}
        {data && (
          <>
            <div className={`border-2 px-4 py-3 text-center ${data.active ? "border-neon bg-neon/5" : "border-yellow/60"}`}>
              <div className={data.active ? "text-neon text-2xl" : "text-yellow text-2xl"}>
                {data.active ? t("tn_live") : t("tn_soon")}
              </div>
              <div dir="ltr" className="text-white text-3xl mt-1">
                {left((data.active ? data.endsAt : data.startsAt) - serverNow)}
              </div>
              <div className="font-sans text-xs text-gray-400 mt-1">
                {new Date(data.startsAt).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })} –{" "}
                {new Date(data.endsAt).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            <div className="border border-neon/40 bg-[#060b1e] px-4 py-3 font-sans text-sm text-gray-200 flex flex-col gap-1">
              <span>{t("tn_rule_points", { win: data.points.win, draw: data.points.draw, bot: data.points.botWin })}</span>
              <span>{t("tn_rule_prizes", { a: data.prizes[0], b: data.prizes[1], c: data.prizes[2], n: data.minMatches })}</span>
              <span className="text-gray-400">{t("tn_rule_friendly")}</span>
            </div>

            {data.me && (
              <div className="flex flex-col gap-1">
                <span className="text-yellow text-sm">{t("tn_you")}</span>
                <ul>{row(data.me, true)}</ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-neon">{t("tn_standings", { n: data.players })}</span>
              {data.top.length === 0 ? (
                <p className="font-sans text-gray-400 text-sm">{data.active ? t("tn_empty_live") : t("tn_empty_soon")}</p>
              ) : (
                <ol className="flex flex-col gap-1.5">{data.top.map((r) => row(r, r.userId === me?.id))}</ol>
              )}
            </div>

            {data.active && (
              <Link to="/play" className="self-center bg-pink border-2 border-yellow text-black px-6 py-2 text-xl">
                ▶ {t("play").toUpperCase()}
              </Link>
            )}

            {data.last.winners.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-yellow">{t("tn_last")}</span>
                <ol className="flex flex-col gap-1.5">
                  {data.last.winners.map((r) => (
                    <li key={r.userId} className="flex items-center gap-3 px-3 py-2 border border-yellow/40 bg-[#060b1e]">
                      <span className={`w-8 text-xl ${MEDAL[r.place - 1]}`}>{r.place}</span>
                      <span className="flex-1 truncate text-white">{r.nickname}</span>
                      <span dir="ltr" className="font-sans text-xs text-gray-400">{t("tn_pts", { n: r.points })}</span>
                      <span dir="ltr" className="text-yellow">+{r.prize} PX</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function TournamentPage() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <TournamentScreen />}</ClientOnly>;
}
