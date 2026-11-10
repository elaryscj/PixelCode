// app/routes/verify-email.tsx
// Email Verification confirmation screen
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { verifyEmailToken } from "~/api/profile";

export default function VerifyEmailRoute() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No verification token found in URL.");
      setLoading(false);
      return;
    }

    verifyEmailToken(token)
      .then(() => {
        setSuccess(true);
      })
      .catch((err) => {
        setErrorMessage(err.message || "Invalid or expired verification link.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#040714] text-white flex flex-col items-center justify-center p-6 select-none font-pixel">
      <div className="w-full max-w-md bg-[#070c1e]/90 border-2 border-[#01E4FF] p-8 shadow-[0_0_25px_rgba(1,228,255,0.25)] text-center flex flex-col items-center gap-6">
        <h1 className="text-yellow text-2xl tracking-wider">EMAIL VERIFICATION</h1>

        {loading ? (
          <div className="text-neon text-sm animate-pulse">VERIFYING TOKEN...</div>
        ) : success ? (
          <>
            <FaCheckCircle className="text-5xl text-emerald-400" />
            <div className="text-emerald-400 text-sm">
              [✓] Your email address has been verified successfully!
            </div>
            <Link
              to="/profile"
              className="mt-4 px-6 py-2.5 bg-[#01E4FF] border border-yellow text-black text-xs uppercase tracking-wider hover:brightness-110"
            >
              RETURN TO PROFILE
            </Link>
          </>
        ) : (
          <>
            <FaExclamationTriangle className="text-5xl text-pink" />
            <div className="text-pink text-xs leading-relaxed">
              [!] ERROR: {errorMessage}
            </div>
            <Link
              to="/profile"
              className="mt-4 px-6 py-2.5 bg-pink border border-yellow text-black text-xs uppercase tracking-wider hover:brightness-110"
            >
              RETURN TO PROFILE
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
