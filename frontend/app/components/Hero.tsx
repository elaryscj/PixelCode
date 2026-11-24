import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Greeting from "./Greeting";
import HowToPlay, { hasSeenHowToPlay } from "./HowToPlay";
import HeroNavigation from "./HeroNavigation";
import { useLiveStats } from "~/lib/liveStats";

/** Live server numbers under the title: players online and matches being fought right now. */
const LiveStrip = () => {
  const stats = useLiveStats();
  const { t } = useTranslation();
  if (!stats) return null;
  return (
    <div className="short:hidden enter-up flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-pixel text-[clamp(11px,2vh,18px)]">
      <span className="flex items-center gap-2 text-neon">
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        {stats.online.toLocaleString("en-US")} {t("live_online")}
      </span>
      <span className="text-pink">{stats.activeMatches} {t("live_duels")}</span>
      <span className="text-yellow">{stats.inQueue} {t("live_queue")}</span>
    </div>
  );
};

const Hero = () => {
  // first visit: open the rules once (decided after mount, so the server render matches)
  const [showRules, setShowRules] = useState(false);
  useEffect(() => {
    if (!hasSeenHowToPlay()) setShowRules(true);
  }, []);

  return (
    <div className="my-auto flex flex-col gap-[min(2.5rem,2vh)] short:gap-1.5 px-4 py-[min(2rem,1.2vh)] short:py-1">
      <Greeting />
      <LiveStrip />
      <HeroNavigation onHowToPlay={() => setShowRules(true)} />
      {showRules && <HowToPlay onClose={() => setShowRules(false)} />}
    </div>
  );
};

export default Hero;
