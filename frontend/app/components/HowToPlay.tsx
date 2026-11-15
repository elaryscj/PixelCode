// app/components/HowToPlay.tsx — the short rules screen: opens once on the first visit, then from the menu.
import { useEffect } from "react";
import { Link } from "react-router";

const SEEN_KEY = "pixelcode.howto.seen";

export function hasSeenHowToPlay(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: never nag on every visit
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: fine, the button in the menu still works */
  }
}

const STEPS: { title: string; text: string; color: string }[] = [
  {
    title: "1 · RACE",
    text: "You and your rival run the same map side by side. Move with A / D or the arrows, jump with Space.",
    color: "text-neon",
  },
  {
    title: "2 · CRACK THE DOORS",
    text: "Four locked doors block the way. Walk up to one and press E: a short Java task opens. Solve it and the door unlocks. Stuck? It opens by itself after 4 minutes.",
    color: "text-yellow",
  },
  {
    title: "3 · REACH THE EXIT",
    text: "Whoever gets through all four doors and reaches the exit first wins. Ranked wins give MMR and +150 pixels (a loss still gives +25).",
    color: "text-pink",
  },
  {
    title: "4 · SPEND YOUR PIXELS",
    text: "Buy and equip skins in the Store. Your rival sees them in the match.",
    color: "text-neon",
  },
];

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const close = () => {
    markSeen();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="howto-title"
    >
      <div
        className="w-full max-w-160 border-2 border-neon bg-[#060b1e] p-5 sm:p-7 font-pixel flex flex-col gap-5 shadow-[0_0_30px_rgba(1,228,255,0.25)] enter-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="howto-title" className="text-yellow text-3xl sm:text-5xl text-center text-glow-sm">
          HOW TO PLAY
        </h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map((s) => (
            <li key={s.title} className="border border-neon/30 bg-[#02050f] px-4 py-3">
              <div className={`${s.color} text-lg sm:text-2xl`}>{s.title}</div>
              <p className="font-sans text-gray-300 text-sm sm:text-base mt-1 leading-snug">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/practice"
            onClick={markSeen}
            className="btn-arcade flex-1 text-center py-3 border-2 border-neon text-yellow text-xl sm:text-2xl"
          >
            TRY PRACTICE
          </Link>
          <button
            onClick={close}
            className="btn-arcade flex-1 py-3 bg-pink border-2 border-yellow text-black text-xl sm:text-2xl"
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
