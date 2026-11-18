// app/lib/serverRegion.ts — where the game server really runs (the backend's SERVER_REGION, via /api/health).
// Asked once per page load and shared by every header that shows "SERVER: ...".
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE } from "~/api/http";

const KNOWN = ["oregon", "frankfurt", "virginia", "ohio", "singapore", "local"] as const;
let cached: string | null = null;
let pending: Promise<string> | null = null;

function loadRegion(): Promise<string> {
  if (cached !== null) return Promise.resolve(cached);
  pending ??= fetch(`${API_BASE}/health`)
    .then((r) => r.json())
    .then((d) => (cached = typeof d?.region === "string" ? d.region : ""))
    .catch(() => {
      pending = null; // try again on the next screen
      return "";
    });
  return pending;
}

/** "SERVER: USA (OREGON)" in the player's language; just "SERVER" while unknown. */
export function useServerLabel(): string {
  const { t } = useTranslation();
  const [region, setRegion] = useState<string>(cached ?? "");
  useEffect(() => {
    let alive = true;
    void loadRegion().then((r) => alive && setRegion(r));
    return () => {
      alive = false;
    };
  }, []);
  const known = (KNOWN as readonly string[]).includes(region);
  return known ? t("server", { place: t(`rg_${region}`) }) : t("server_plain");
}
