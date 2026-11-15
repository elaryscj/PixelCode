import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { FaArrowLeft, FaEnvelope, FaInbox } from "react-icons/fa";
import { requestPasswordReset } from "~/api/auth";
import RecoveryShell, { CardTitle, cardCls, inputCls, primaryBtn } from "~/components/RecoveryShell";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <RecoveryShell>
        <div className={cardCls}>
          <CardTitle text={t("fp_check_title")} square />
          <FaEnvelope className="text-[#01E4FF] text-5xl mb-5" />
          <p className="font-sans text-lg mb-5">
            {t("fp_sent", { email: email.trim() })}
          </p>
          <div className="border-l-4 border-[#01E4FF] bg-black/30 p-4 mb-5 font-sans">
            <div className="flex items-center gap-2 text-[#01E4FF] text-lg mb-1">
              <FaInbox /> {t("fp_inbox")}
            </div>
            <p className="text-gray-400 text-sm">
              {t("fp_spam")}
            </p>
          </div>
          <p className="font-sans text-gray-400 text-sm mb-6">
            {t("fp_resend_hint")}
          </p>
          <button onClick={() => submit()} disabled={busy} className={primaryBtn}>
            {t("fp_resend")}
          </button>
          <hr className="border-gray-700 my-6" />
          <Link to="/login" className="block text-center py-3 border-2 border-[#01E4FF] text-white text-2xl">
            {t("fp_back_login")}
          </Link>
        </div>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell>
      <p className="font-sans text-lg mb-5">
        Forgot your password? Enter your account email and we&apos;ll send you a secure link to reset it.
      </p>
      <form onSubmit={submit} className={cardCls}>
        <CardTitle text={t("fp_title")} />
        <label htmlFor="fp-email" className="block text-yellow text-[18px] mb-2">
          {t("pf_email")}
        </label>
        <input
          dir="ltr"
          id="fp-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`${inputCls} mb-5`}
        />
        {error && <div className="text-pink text-[18px] border border-pink/40 bg-pink/10 px-3 py-2 mb-4">[!] {error}</div>}
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? t("fp_sending") : t("fp_send")}
        </button>
        <Link to="/login" className="mt-4 flex items-center justify-center gap-2 text-[#01E4FF] text-lg">
          <FaArrowLeft /> {t("fp_back_login")}
        </Link>
      </form>
      <p className="font-sans text-gray-500 text-sm mt-6">{t("fp_expire")}</p>
    </RecoveryShell>
  );
}
