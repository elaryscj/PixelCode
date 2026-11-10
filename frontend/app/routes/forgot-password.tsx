import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { FaArrowLeft, FaEnvelope, FaInbox } from "react-icons/fa";
import { requestPasswordReset } from "~/api/auth";
import RecoveryShell, { CardTitle, cardCls, inputCls, primaryBtn } from "~/components/RecoveryShell";

export default function ForgotPassword() {
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <RecoveryShell>
        <div className={cardCls}>
          <CardTitle text="CHECK YOUR EMAIL" square />
          <FaEnvelope className="text-[#01E4FF] text-5xl mb-5" />
          <p className="font-sans text-lg mb-5">
            If an account exists for {email.trim()}, we&apos;ve sent a password reset link to that address.
          </p>
          <div className="border-l-4 border-[#01E4FF] bg-black/30 p-4 mb-5 font-sans">
            <div className="flex items-center gap-2 text-[#01E4FF] text-lg mb-1">
              <FaInbox /> Next stop: your inbox
            </div>
            <p className="text-gray-400 text-sm">
              Check your spam folder too. The link expires in 30 minutes and can only be used once.
            </p>
          </div>
          <p className="font-sans text-gray-400 text-sm mb-6">
            Didn&apos;t receive an email? You can request another link without revealing whether an account exists.
          </p>
          <button onClick={() => submit()} disabled={busy} className={primaryBtn}>
            Resend reset link
          </button>
          <hr className="border-gray-700 my-6" />
          <Link to="/login" className="block text-center py-3 border-2 border-[#01E4FF] text-white text-2xl">
            Back to login
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
        <CardTitle text="FORGOT PASSWORD" />
        <label htmlFor="fp-email" className="block text-yellow text-[18px] mb-2">
          EMAIL ADDRESS
        </label>
        <input
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
          {busy ? "Sending..." : "Send reset link"}
        </button>
        <Link to="/login" className="mt-4 flex items-center justify-center gap-2 text-[#01E4FF] text-lg">
          <FaArrowLeft /> Back to login
        </Link>
      </form>
      <p className="font-sans text-gray-500 text-sm mt-6">For your security, reset links expire after 30 minutes.</p>
    </RecoveryShell>
  );
}
