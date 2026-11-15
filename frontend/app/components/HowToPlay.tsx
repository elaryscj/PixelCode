// app/components/HowToPlay.tsx — the short rules screen: opens once on the first visit, then from the menu.
import { useEffect } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

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

// translation keys howto_N_title / howto_N (see language-config/locales)
const STEPS = [
  { n: 1, color: "text-neon" },
  { n: 2, color: "text-yellow" },
  { n: 3, color: "text-pink" },
  { n: 4, color: "text-neon" },
];

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
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
          {t("howto_title")}
        </h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map((s) => (
            <li key={s.n} className="border border-neon/30 bg-[#02050f] px-4 py-3">
              <div className={`${s.color} text-lg sm:text-2xl`}>{t(`howto_${s.n}_title`)}</div>
              <p className="font-sans text-gray-300 text-sm sm:text-base mt-1 leading-snug">{t(`howto_${s.n}`)}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/practice"
            onClick={markSeen}
            className="btn-arcade flex-1 text-center py-3 border-2 border-neon text-yellow text-xl sm:text-2xl"
          >
            {t("try_practice")}
          </Link>
          <button
            onClick={close}
            className="btn-arcade flex-1 py-3 bg-pink border-2 border-yellow text-black text-xl sm:text-2xl"
          >
            {t("got_it")}
          </button>
        </div>
      </div>
    </div>
  );
}
