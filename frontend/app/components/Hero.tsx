import Greeting from "./Greeting";
import HeroNavigation from "./HeroNavigation";
import { useLiveStats } from "~/lib/liveStats";

/** Live server numbers under the title: players online and matches being fought right now. */
const LiveStrip = () => {
  const stats = useLiveStats();
  if (!stats) return null;
  return (
    <div className="enter-up flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-pixel text-sm sm:text-lg">
      <span className="flex items-center gap-2 text-neon">
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        {stats.online.toLocaleString("en-US")} ONLINE
      </span>
      <span className="text-pink">{stats.activeMatches} DUELS LIVE</span>
      <span className="text-yellow">{stats.inQueue} IN QUEUE</span>
    </div>
  );
};

const Hero = () => {
  return (
    <div className="flex flex-col gap-6 sm:gap-10 px-4 py-8 sm:py-10">
      <Greeting />
      <LiveStrip />
      <HeroNavigation />
    </div>
  );
};

export default Hero;
