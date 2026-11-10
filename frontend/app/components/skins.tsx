// app/components/skins.tsx — skins shared by the store (large art) and the game (small art)
import type { ReactElement } from "react";
import { API_BASE } from "~/api/http";

export type SkinId = "neon_ronin" | "crimson_cipher" | "byte_knight" | "pumpkin_phantom";
export type SkinSize = "large" | "small";

type ArtProps = { className?: string };

// Pixel art exported from the design: /public/skins/<id>-large.* (store) and <id>-small.* (match)
const FILES: Record<string, string> = {
  neon_ronin: "png",
  crimson_cipher: "png",
  pumpkin_phantom: "svg",
};

const ByteKnight = ({ className }: ArtProps) => (
  <svg viewBox="0 0 100 120" className={className} shapeRendering="crispEdges">
    {/* Mecha Helmet / Crest */}
    <path d="M 46 8 L 54 8 L 52 24 L 48 24 Z" fill="#eab308" />
    <rect x="34" y="20" width="32" height="26" fill="#713f12" />
    <rect x="36" y="22" width="28" height="22" fill="#a16207" />
    
    {/* Cyan Visor */}
    <rect x="38" y="30" width="24" height="6" fill="#00f0ff" className="animate-pulse" />
    
    {/* Neck */}
    <rect x="44" y="46" width="12" height="6" fill="#362208" />

    {/* Armor Torso */}
    <rect x="30" y="52" width="40" height="34" fill="#854d0e" />
    <rect x="36" y="56" width="28" height="24" fill="#ca8a04" />
    <rect x="46" y="60" width="8" height="16" fill="#facc15" />

    {/* Pauldrons / Shoulders */}
    <polygon points="18,52 32,52 30,66 20,66" fill="#ca8a04" />
    <polygon points="82,52 68,52 70,66 80,66" fill="#ca8a04" />

    {/* Arms */}
    <rect x="20" y="66" width="10" height="20" fill="#713f12" />
    <rect x="70" y="66" width="10" height="20" fill="#713f12" />
    <rect x="20" y="84" width="10" height="8" fill="#ca8a04" />
    <rect x="70" y="84" width="10" height="8" fill="#ca8a04" />

    {/* Legs */}
    <rect x="34" y="86" width="14" height="24" fill="#713f12" />
    <rect x="52" y="86" width="14" height="24" fill="#713f12" />
    <rect x="36" y="90" width="10" height="16" fill="#ca8a04" />
    <rect x="54" y="90" width="10" height="16" fill="#ca8a04" />

    {/* Boots */}
    <rect x="32" y="108" width="16" height="6" fill="#362208" />
    <rect x="52" y="108" width="16" height="6" fill="#362208" />
    <rect x="34" y="108" width="12" height="2" fill="#facc15" />
    <rect x="54" y="108" width="12" height="2" fill="#facc15" />
  </svg>
);

/** Draws a skin by id: the big version for the store, the small one for the match. */
export function SkinArt({
  id,
  size = "small",
  className,
}: {
  id?: string | null;
  size?: SkinSize;
  className?: string;
}): ReactElement {
  if (id && id.startsWith("c_")) {
    // skin published by an administrator: the picture comes from the server
    return (
      <img
        src={`${API_BASE}/cosmetics/${id}/image`}
        alt=""
        draggable={false}
        className={className}
        style={{ imageRendering: "pixelated", objectFit: "contain", objectPosition: "center bottom" }}
      />
    );
  }
  const skin = id && (id in FILES || id === "byte_knight") ? id : "neon_ronin";
  if (skin === "byte_knight") return <ByteKnight className={className} />;
  return (
    <img
      src={`/skins/${skin}-${size}.${FILES[skin]}`}
      alt=""
      draggable={false}
      className={className}
      style={{ imageRendering: "pixelated", objectFit: "contain", objectPosition: "center bottom" }}
    />
  );
}
