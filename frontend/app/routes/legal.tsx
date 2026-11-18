// app/routes/legal.tsx — /offer, /privacy, /contacts : the public offer, privacy policy and seller details.
// Readable without an account (payment providers and parents check these pages).
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { API_BASE } from "~/api/http";
import { DOCS, docLang, type DocId } from "~/legal/documents";

export function meta({ location }: { location: { pathname: string } }) {
  const id = location.pathname.replace("/", "");
  const title = id === "offer" ? "Offer" : id === "privacy" ? "Privacy" : "Contacts";
  return [{ title: `${title} | PixelCode Arena` }];
}

type Plans = { trialDays: number; priceMonth: number; priceYear: number; currency: string };

export default function Legal() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const id = (pathname.replace(/^\//, "") || "offer") as DocId;
  const lang = docLang(i18n.language);
  const doc = (DOCS[id] ?? DOCS.offer)[lang];
  const [plans, setPlans] = useState<Plans | null>(null);

  // the offer quotes the live prices, the same ones the teacher page shows
  useEffect(() => {
    fetch(`${API_BASE}/teacher/plans`)
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, []);

  const num = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");
  const fill = (s: string) =>
    s
      .replaceAll("{month}", plans ? num(plans.priceMonth) : "…")
      .replaceAll("{year}", plans ? num(plans.priceYear) : "…")
      .replaceAll("{trial}", plans ? String(plans.trialDays) : "…")
      .replaceAll("{currency}", plans?.currency === "KZT" || !plans ? "₸" : plans.currency);

  const links: DocId[] = ["offer", "privacy", "contacts"];
  return (
    <div className="min-h-screen bg-[#060814] text-gray-200 px-4 py-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-3 font-pixel">
          <Link to="/" className="border-2 border-pink text-pink px-3 py-1 text-lg hover:bg-pink/10">&lt; {t("menu")}</Link>
          {links.map((l) => (
            <Link
              key={l}
              to={`/${l}`}
              className={`text-lg px-2 py-1 border ${l === id ? "border-yellow text-yellow" : "border-neon/40 text-neon hover:border-neon"}`}
            >
              {t(`lg_${l}`)}
            </Link>
          ))}
        </nav>
        <article className="font-sans leading-relaxed flex flex-col gap-5">
          <header>
            <h1 className="text-yellow font-pixel text-3xl sm:text-4xl">{doc.title}</h1>
            <p className="text-gray-400 text-sm mt-1">{doc.updated}</p>
          </header>
          {doc.sections.map((s) => (
            <section key={s.h} className="flex flex-col gap-2">
              <h2 className="text-neon text-lg font-semibold">{s.h}</h2>
              {s.p.map((p, i) => (
                <p key={i} className="text-gray-200 text-base whitespace-pre-line select-text">
                  {fill(p)}
                </p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
