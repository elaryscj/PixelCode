// app/components/game/OppMiniMap.tsx — a thumbnail of the rival's run for small screens (a phone turned
// sideways), where the rival's half of the arena is hard to read. Shows the map's solid floors, the doors
// (filled = the rival opened it) and a dot where the rival is; the duel loop moves the dot through `dotRef`.
import { forwardRef } from "react";
import type { MapDef } from "~/game/maps";
import { DOOR_W } from "~/game/physics";

export const OppMiniMap = forwardRef<HTMLDivElement, { map: MapDef; unlocked: number[]; className?: string }>(
  function OppMiniMap({ map, unlocked, className = "relative" }, dotRef) {
    return (
      <div className={`w-[72px] h-[72px] bg-black/70 ring-1 ring-pink/60 pointer-events-none ${className}`} aria-hidden>
        {map.platforms
          .filter((p) => !p.move && p.kind !== "blink" && p.kind !== "crumble")
          .map((p, i) => (
            <div key={i} className="absolute h-[2px] bg-pink/50" style={{ left: `${p.x}%`, width: `${p.w}%`, bottom: `${p.y}%` }} />
          ))}
        {map.doors.map((d) => (
          <div
            key={d.num}
            className={`absolute w-[4px] h-[6px] ${unlocked.includes(d.num) ? "bg-pink" : "border border-pink/70"}`}
            style={{ left: `${d.x + DOOR_W / 2}%`, bottom: `${d.y + 1}%` }}
          />
        ))}
        <div className="absolute h-[3px] bg-yellow/70" style={{ left: `${map.exit.x}%`, width: `${map.exit.w}%`, bottom: `${map.exit.y}%` }} />
        <div ref={dotRef} className="absolute w-[6px] h-[6px] -ml-[3px] bg-pink rounded-full shadow-[0_0_6px_#FE2C96] transition-none" />
      </div>
    );
  },
);
