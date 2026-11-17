// app/components/game/PhraseBar.tsx — quick phrases in a match ("Good luck!", "GG", ...): fixed choices,
// shown translated on both screens, so there is no free text to moderate.
import { useTranslation } from "react-i18next";

export const PHRASES = ["gl", "gg", "rematch", "nice", "oops", "wow"] as const;
export type PhraseId = (typeof PHRASES)[number];
export const isPhrase = (v: unknown): v is PhraseId => typeof v === "string" && (PHRASES as readonly string[]).includes(v);

export default function PhraseBar({
  onPhrase,
  keys = false,
  className = "",
}: {
  onPhrase: (p: PhraseId) => void;
  /** show the keyboard shortcuts 3-8 */
  keys?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span aria-hidden>💬</span>
      {PHRASES.map((p, i) => (
        <button
          key={p}
          type="button"
          onClick={() => onPhrase(p)}
          className="border border-neon/50 bg-black/40 px-2 py-0.5 text-[11px] normal-case text-gray-100 hover:text-white hover:border-neon active:scale-95"
        >
          {keys && <span className="text-neon mr-1">{i + 3}</span>}
          {t(`ph_${p}`)}
        </button>
      ))}
    </div>
  );
}

/** A speech bubble over a figure's head. */
export function Bubble({ text, tone }: { text: string; tone: "neon" | "pink" }) {
  return (
    <div
      className={`enter-up absolute left-1/2 -translate-x-1/2 bottom-full mb-5 whitespace-nowrap bg-white text-black text-[11px] px-2 py-1 border-2 ${
        tone === "neon" ? "border-neon" : "border-pink"
      } shadow-[0_0_10px_rgba(255,255,255,0.4)] z-30`}
      role="status"
    >
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-white" />
    </div>
  );
}
