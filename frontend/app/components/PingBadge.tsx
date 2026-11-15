// app/components/PingBadge.tsx — live round trip to the game server, coloured by quality
import { FaWifi } from "react-icons/fa";
import { pingColor, pingLabel, usePing } from "~/lib/liveStats";

export default function PingBadge({ className = "" }: { className?: string }) {
  const ping = usePing();
  return (
    <span
      dir="ltr" // "7 MS" must not turn into "MS 7" in right-to-left languages
      className={`inline-flex items-center gap-1.5 ${pingColor(ping)} ${className}`}
      title={ping === null ? "Measuring connection to the game server..." : `Round trip to the game server: ${ping} ms`}
    >
      <FaWifi />
      {pingLabel(ping)}
    </span>
  );
}
