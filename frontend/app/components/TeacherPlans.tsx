// app/components/TeacherPlans.tsx — the teacher-mode offer: what it does, prices, free trial, subscription request.
// Without access it is the whole page; with access it shrinks to a bar with the end date and a renew button.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { requestTeacherPlan, startTeacherTrial, type TeacherStatus } from "~/api/teacher";

const money = (n: number, currency: string, lang: string) => {
  try {
    return new Intl.NumberFormat(lang === "kz" ? "kk" : lang, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
};

export default function TeacherPlans({ status, onChange }: { status: TeacherStatus; onChange: (s: TeacherStatus) => void }) {
  const { t, i18n } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const [plan, setPlan] = useState<"MONTH" | "YEAR">("YEAR");
  const [school, setSchool] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const daysLeft = status.until ? Math.max(0, Math.ceil((status.until - Date.now()) / 86_400_000)) : null;
  const saving = Math.round((1 - status.priceYear / (status.priceMonth * 12)) * 100);
  const fmt = (n: number) => money(n, status.currency, i18n.language);

  const act = async (f: () => Promise<TeacherStatus>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await f());
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-[#02050f] border-2 border-neon text-white px-3 py-2 font-sans text-base outline-none focus:border-yellow";

  const form = (
    <div className="flex flex-col gap-3 border-2 border-yellow/70 p-4">
      {sent || status.requestPending ? (
        <p className="text-neon text-lg font-sans">{t("tp_sent")}</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {(["MONTH", "YEAR"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`text-start border-2 px-3 py-2 ${plan === p ? "border-yellow bg-yellow/10" : "border-neon/50"}`}
              >
                <div className="text-white text-xl">{p === "MONTH" ? t("tp_month") : t("tp_year")}</div>
                <div className="text-yellow text-lg">{fmt(p === "MONTH" ? status.priceMonth : status.priceYear)}</div>
              </button>
            ))}
          </div>
          <input className={field} value={school} maxLength={120} placeholder={t("tp_school")} onChange={(e) => setSchool(e.target.value)} />
          <input className={field} value={contact} maxLength={120} placeholder={t("tp_contact")} onChange={(e) => setContact(e.target.value)} />
          <textarea className={field} rows={2} value={note} maxLength={500} placeholder={t("tp_note")} onChange={(e) => setNote(e.target.value)} />
          <p className="text-gray-400 text-sm font-sans">
            {t("tp_how_pay")}{" "}
            <Link to="/offer" className="text-neon underline">{t("lg_offer")}</Link>
          </p>
          <button
            onClick={() => act(() => requestTeacherPlan({ plan, school, contact, note }), () => setSent(true))}
            disabled={busy}
            className="self-start bg-pink border-2 border-yellow text-black text-xl px-6 py-2 disabled:opacity-60"
          >
            {t("tp_send")}
          </button>
        </>
      )}
      {error && <p className="text-pink text-base font-sans">{error}</p>}
    </div>
  );

  // active: a compact bar
  if (status.active) {
    return (
      <section className="border-2 border-neon/60 bg-[#070c1e]/90 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-sans text-gray-200">
            {status.unlimited
              ? t("tp_unlimited")
              : t("tp_active_until", { date: new Date(status.until!).toLocaleDateString(i18n.language === "kz" ? "kk" : i18n.language), n: daysLeft })}
          </span>
          {!status.unlimited && (
            <button onClick={() => setFormOpen((o) => !o)} className="border-2 border-yellow text-yellow px-4 py-1.5 text-lg hover:bg-yellow/10">
              {t("tp_renew")}
            </button>
          )}
        </div>
        {formOpen && form}
      </section>
    );
  }

  // no access (never had it, or it ran out): the offer
  return (
    <section className="border-2 border-yellow bg-[#070c1e]/90 p-4 sm:p-6 flex flex-col gap-5">
      {status.teacher && <p className="text-pink text-xl">{t("tp_ended")}</p>}
      <h2 className="text-yellow text-3xl sm:text-4xl">{t("tp_title")}</h2>
      <p className="text-gray-200 text-lg font-sans">{t("tp_pitch")}</p>
      <ul className="grid sm:grid-cols-2 gap-3 font-sans text-base text-gray-200">
        {["tp_f1", "tp_f2", "tp_f3", "tp_f4"].map((k) => (
          <li key={k} className="border border-neon/40 px-3 py-2">
            <span className="text-neon me-2">▸</span>
            {t(k)}
          </li>
        ))}
      </ul>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border-2 border-neon/60 p-4">
          <div className="text-gray-300 text-lg">{t("tp_month")}</div>
          <div className="text-white text-3xl">{fmt(status.priceMonth)}</div>
        </div>
        <div className="border-2 border-yellow p-4 relative">
          {saving > 0 && (
            <span className="absolute -top-3 end-3 bg-yellow text-black text-sm px-2">{t("tp_save", { n: saving })}</span>
          )}
          <div className="text-gray-300 text-lg">{t("tp_year")}</div>
          <div className="text-white text-3xl">{fmt(status.priceYear)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {status.trialAvailable && (
          <button
            onClick={() => act(startTeacherTrial)}
            disabled={busy}
            className="bg-pink border-2 border-yellow text-black text-2xl px-6 py-3 disabled:opacity-60 shadow-[0_0_18px_rgba(254,44,150,0.45)]"
          >
            {t("tp_trial", { n: status.trialDays })}
          </button>
        )}
        <button onClick={() => setFormOpen((o) => !o)} className="border-2 border-yellow text-yellow text-2xl px-6 py-3 hover:bg-yellow/10">
          {t("tp_buy")}
        </button>
      </div>
      {status.trialAvailable && <p className="text-gray-400 text-sm font-sans">{t("tp_trial_hint")}</p>}
      <p className="text-gray-400 text-sm font-sans">
        {t("tp_accept")}{" "}
        <Link to="/offer" className="text-neon underline">{t("lg_offer")}</Link>{" · "}
        <Link to="/privacy" className="text-neon underline">{t("lg_privacy")}</Link>
      </p>
      {(formOpen || status.requestPending) && form}
      {error && !formOpen && <p className="text-pink text-base font-sans">{error}</p>}
    </section>
  );
}
