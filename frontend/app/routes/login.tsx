// app/routes/login.tsx
// Secure Authorization Screen matching PixelCode Arena Cyberpunk Terminal
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { FaEye, FaEyeSlash, FaGamepad, FaTwitch, FaWifi, FaYoutube } from "react-icons/fa";
import { loginUser, registerUser, AuthError } from "~/api/auth";
import { pingLabel, usePing } from "~/lib/liveStats";

export default function LoginRoute() {
  const navigate = useNavigate();
  const ping = usePing();

  // Mode: "login" or "register"
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedUser = username.trim();
    const fe: Record<string, string> = {};
    if (isRegister) {
      if (trimmedUser.length < 2 || trimmedUser.length > 16) fe.username = "Username must be 2-16 characters.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) fe.email = "Enter a valid email address.";
      if (password.length < 8 || password.length > 72) fe.password = "Password must be 8-72 characters.";
      else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) fe.password = "Password must contain a letter and a number.";
      if (password !== confirmPassword) fe.confirm = "Passwords do not match.";
    } else if (!trimmedUser || !password) {
      setErrorMessage("Please enter both username and password.");
      return;
    }
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setLoading(true);
    try {
      if (isRegister) {
        const res = await registerUser(trimmedUser, password, email.trim());
        setSuccessMessage(res.message || "Registration successful! Logging in...");
        setTimeout(() => {
          navigate("/");
        }, 800);
      } else {
        await loginUser(trimmedUser, password);
        navigate("/");
      }
    } catch (err) {
      if (err instanceof AuthError) {
        const m = err.message.toLowerCase();
        if (isRegister && m.includes("e-mail")) setFieldErrors({ email: err.message });
        else if (isRegister && m.includes("username")) setFieldErrors({ username: err.message });
        else setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Connection to auth terminal failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#040714] text-white flex flex-col justify-between select-none overflow-hidden font-pixel">
      {/* Background Cyberpunk Grid & Stars */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(1, 228, 255, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(1, 228, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="star-background pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full px-8 py-5 border-b border-[#01E4FF]/40 flex items-center justify-between bg-[#040714]/80 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-3 text-[#01E4FF] hover:brightness-120 transition-all">
          <FaGamepad className="text-xl" />
          <span className="text-yellow text-3xl tracking-wider">PIXELCODE</span>
          <span className="text-[#01E4FF] text-[20px]">| • KAZAKHSTAN</span>
        </Link>

        <div className="flex items-center gap-4 text-[20px]">
          <div className="flex items-center gap-2 text-[#01E4FF]">
            <FaWifi className="text-2xl" />
            <span>{pingLabel(ping)}</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="text-right text-[18px] leading-tight">
            <span className="text-gray-400">SECURE TERMINAL</span>
            <br />
            <span className="text-pink">STATUS: {loading ? "CONNECTING..." : "UNKNOWN"}</span>
          </div>
        </div>
      </header>

      {/* Main Terminal Window */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        
        {/* Title Area */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 text-[20px] text-[#01E4FF] tracking-widest uppercase mb-2">
            <span className="h-[1px] w-8 bg-[#01E4FF]/60" />
            SECURE AUTHORIZATION
            <span className="h-[1px] w-8 bg-[#01E4FF]/60" />
          </div>
          <h1 className="text-yellow text-[56px]/none sm:text-[82px]/none tracking-wider text-glow-sm">
            PIXELCODE ARENA
          </h1>
        </div>

        {/* Auth Card Terminal */}
        <div className={`w-full max-w-[540px] bg-[#070c1e]/90 border-2 ${isRegister ? "border-pink" : "border-[#01E4FF]"} p-6 shadow-[0_0_25px_rgba(1,228,255,0.25)] relative`}>
          
          {/* Card Title */}
          <div className="flex items-center justify-between pb-3 border-b border-[#01E4FF]/40 mb-6">
            <div className="flex items-center gap-2 text-2xl text-[#01E4FF] tracking-wider">
              <span>&gt;</span>
              <span>{isRegister ? "NEW_COMBATANT" : "USER_LOGIN"}</span>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-pink animate-pulse shadow-[0_0_8px_#FE2C96]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {/* Username Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="auth-username" className="text-[18px] text-yellow tracking-wider uppercase">
                {isRegister ? "USERNAME / CODENAME" : "USERNAME / PLAYER ID"}
              </label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Yelarys"
                maxLength={20}
                required
                className={`w-full bg-[#02050f] border ${fieldErrors.username ? "border-pink" : "border-[#01E4FF]"} text-white px-3.5 py-2.5 text-[20px] outline-none focus:border-glow-neon-sm transition-all`}
              />
              {fieldErrors.username && <p className="text-pink text-[16px]">{fieldErrors.username}</p>}
            </div>

            {isRegister && (
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-email" className="text-[18px] text-yellow tracking-wider uppercase">
                  EMAIL ADDRESS
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={`w-full bg-[#02050f] border ${fieldErrors.email ? "border-pink" : "border-[#01E4FF]"} text-white px-3.5 py-2.5 text-[20px] outline-none focus:border-glow-neon-sm transition-all`}
                />
                {fieldErrors.email && <p className="text-pink text-[16px]">{fieldErrors.email}</p>}
              </div>
            )}

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="auth-password" className="text-[18px] text-yellow tracking-wider uppercase">
                PASSWORD
              </label>
              <div className="relative w-full">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 pr-10 text-[20px] outline-none focus:border-glow-neon-sm transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#01E4FF] hover:text-white transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash className="text-2xl" /> : <FaEye className="text-2xl" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-pink text-[16px]">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password Field (Registration Only) */}
            {isRegister && (
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-confirm-password" className="text-[18px] text-yellow tracking-wider uppercase">
                  CONFIRM PASSWORD
                </label>
                <div className="relative w-full">
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 pr-10 text-[20px] outline-none focus:border-glow-neon-sm transition-all"
                  />
                </div>
                {fieldErrors.confirm && <p className="text-pink text-[16px]">{fieldErrors.confirm}</p>}
              </div>
            )}

            {/* Alerts */}
            {errorMessage && (
              <div className="text-pink text-[18px] border border-pink/40 bg-pink/10 px-3 py-2 leading-relaxed">
                [!] ERROR: {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="text-[#01E4FF] text-[18px] border border-[#01E4FF]/40 bg-[#01E4FF]/10 px-3 py-2 leading-relaxed">
                [✓] {successMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-[#FE2C96] border-2 border-yellow text-black text-2xl tracking-widest uppercase hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(254,44,150,0.5)]"
            >
              {loading ? "AUTHENTICATING..." : isRegister ? "REGISTER" : "LOG IN"}
            </button>

            {isRegister && (
              <p className="text-center text-[16px] text-gray-500">
                By registering you accept the <span className="text-[#01E4FF]">ARENA RULES</span>
              </p>
            )}
            {/* Sub-links */}
            <div className="flex flex-col items-center gap-2 mt-2 text-[18px] text-gray-400">
              {!isRegister && (
                <Link to="/forgot-password" className="text-gray-400 hover:text-gray-200 transition-colors">
                  Forgot terminal password?
                </Link>
              )}

              <div className="flex items-center gap-1">
                <span>{isRegister ? "Already have an account?" : "Are you new?"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setPassword("");
                    setConfirmPassword("");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setFieldErrors({});
                  }}
                  className="text-[#01E4FF] underline hover:text-glow-sm transition-colors cursor-pointer"
                >
                  {isRegister ? "Log in" : "Register"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full px-8 py-4 border-t border-[#01E4FF]/40 flex items-center justify-between text-[18px] text-[#01E4FF] bg-[#040714]/80">
        <div>
          <span className="text-yellow">CLIENT VERSION v1.4.2-BETA</span>
          <span className="mx-3 text-gray-600">|</span>
          <span className="text-gray-400">SYSTEM_ENCRYPTION: ACTIVE (AES_256)</span>
        </div>

        <div className="flex items-center gap-4 text-2xl text-[#01E4FF]">
          <a href="https://twitch.tv" target="_blank" rel="noreferrer" className="hover:text-pink transition-colors">
            <FaTwitch />
          </a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-pink transition-colors">
            <FaYoutube />
          </a>
        </div>
      </footer>
    </div>
  );
}
