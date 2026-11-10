import type { ReactNode } from "react";
import { Link } from "react-router";
import { FaGamepad } from "react-icons/fa";

/** Frame shared by the four account-recovery screens (Figma: Recovery/*) */
export default function RecoveryShell({ children, width = "max-w-[560px]" }: { children: ReactNode; width?: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#040714] text-white font-pixel">
      <div className="grid-background" />
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-[#01E4FF]/40">
        <Link to="/" className="flex items-center gap-3 text-yellow text-3xl">
          <FaGamepad className="text-[#01E4FF]" /> PIXELCODE
          <span className="text-[#01E4FF] text-xl">| &bull; KAZAKHSTAN</span>
        </Link>
        <div className="text-right text-[18px] leading-tight">
          <div className="text-gray-400">SECURE TERMINAL</div>
          <div className="text-pink">ACCOUNT RECOVERY</div>
        </div>
      </header>
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pt-10 pb-12 gap-10">
        <div className="text-center">
          <h1 className="text-yellow text-[56px]/none sm:text-[82px]/none text-glow-sm">PIXELCODE ARENA</h1>
          <p className="text-[#01E4FF] text-[22px] mt-2">SECURE ACCOUNT RECOVERY</p>
        </div>
        <div className={`w-full ${width}`}>{children}</div>
      </main>
      <footer className="relative z-10 flex items-center justify-between px-8 py-4 border-t border-[#01E4FF]/40 text-[18px] bg-[#040714]/80">
        <span className="text-[#01E4FF]">CLIENT VERSION v1.4.2-BETA</span>
        <span className="text-gray-500 hidden md:block">SYSTEM_ENCRYPTION: ACTIVE (AES_256)</span>
        <span className="text-[#01E4FF]">TWO PLAYERS. ONE WINNER.</span>
      </footer>
    </div>
  );
}

export const CardTitle = ({ text, square = false }: { text: string; square?: boolean }) => (
  <div className="flex items-center justify-between pb-3 mb-6 border-b-2 border-[#01E4FF] text-[#01E4FF] text-3xl">
    <span>&gt; {text}</span>
    <span className={square ? "w-3 h-3 bg-pink" : "w-3 h-3 rounded-full bg-pink"} />
  </div>
);

export const cardCls = "border-2 border-[#01E4FF] bg-[#070c1e] p-8 shadow-[0_0_25px_rgba(1,228,255,0.25)]";
export const primaryBtn =
  "block w-full text-center py-3 bg-[#FE2C96] border-2 border-yellow text-black text-2xl disabled:opacity-50 disabled:cursor-not-allowed";
export const inputCls =
  "w-full bg-[#02050f] border-2 border-[#01E4FF] text-white px-4 py-3 font-sans text-lg outline-none focus:border-glow-neon-sm";
