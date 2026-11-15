import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FaCheckCircle, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import { resetPassword } from "~/api/auth";
import RecoveryShell, { CardTitle, cardCls, inputCls, primaryBtn } from "~/components/RecoveryShell";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // same rule as registration and profile: 8-72 characters with a letter and a number
  const lenOk = pw.length >= 8 && pw.length <= 72;
  const mixOk = /[A-Za-z]/.test(pw) && /\d/.test(pw);
  const req = (ok: boolean, text: string) => (
    <li className={ok ? "text-[#01E4FF]" : "text-gray-500"}>
      {ok ? "\u221A" : "\u00B7"} {text}
    </li>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!lenOk) return setError(t("pf_pw_len"));
    if (!mixOk) return setError(t("pf_pw_mix"));
    if (pw !== pw2) return setError(t("pf_pw_match"));
    setBusy(true);
    try {
      await resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <RecoveryShell>
        <div className={cardCls}>
          <CardTitle text={t("rp_done_title")} square />
          <FaCheckCircle className="text-[#01E4FF] text-5xl mb-5" />
          <p className="font-sans text-lg mb-6">{t("rp_done_text")}</p>
          <Link to="/login" className={primaryBtn}>
            {t("fp_back_login")}
          </Link>
        </div>
      </RecoveryShell>
    );
  }

  const eye = (
    <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
      {show ? <FaEyeSlash /> : <FaEye />}
    </button>
  );

  return (
    <RecoveryShell width="max-w-[600px]">
      <form onSubmit={submit} className={cardCls}>
        <CardTitle text={t("rp_title")} square />
        <p className="font-sans text-lg mb-5">
          Choose a new password for your account. You&apos;re using a secure, one-time link from your email.
        </p>
        <label className="block text-yellow text-[18px] mb-2">{t("pf_new_pw")}</label>
        <div className="relative mb-5">
          <input dir="ltr" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} autoComplete="new-password" required />
          {eye}
        </div>
        <label className="block text-yellow text-[18px] mb-2">{t("pf_confirm_pw")}</label>
        <div className="relative mb-5">
          <input dir="ltr" type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} autoComplete="new-password" required />
          {eye}
        </div>
        <p className="text-yellow text-[18px] mb-2">{t("rp_requirements")}</p>
        <ul className="font-sans text-sm mb-5 space-y-1">
          {req(lenOk, t("rp_req_len"))}
          {req(mixOk, t("rp_req_mix"))}
          {req(pw.length > 0 && pw === pw2, t("rp_req_match"))}
          <li className="text-gray-500">\u00B7 {t("rp_req_new")}</li>
        </ul>
        <div className="border-l-4 border-[#01E4FF] bg-black/30 p-4 mb-5 font-sans">
          <div className="flex items-center gap-2 text-[#01E4FF] text-lg mb-1">
            <FaLock /> Secure reset session
          </div>
          <p className="text-gray-400 text-sm">{t("rp_after")}</p>
        </div>
        {error && <div className="text-pink text-[18px] border border-pink/40 bg-pink/10 px-3 py-2 mb-4">[!] {error}</div>}
        <button type="submit" disabled={busy || !token} className={primaryBtn}>
          {busy ? t("pf_saving") : t("rp_submit")}
        </button>
        {!token && <p className="text-pink text-sm mt-3 font-sans">{t("rp_incomplete")}</p>}
      </form>
    </RecoveryShell>
  );
}
