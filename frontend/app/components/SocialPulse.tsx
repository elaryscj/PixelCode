// app/components/SocialPulse.tsx — runs on every screen for a signed-in player (except inside a match):
// pays the daily login streak once a day and pops up duel invitations from friends.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "~/lib/currentUser";
import { refreshUser } from "~/api/auth";
import { joinRoom } from "~/api/room";
import { claimDailyLogin, dismissInvite, getInvites, type DuelInvite } from "~/api/friends";
import { sfx } from "~/lib/sfx";

const POLL_MS = 8000;
const todayUtc = () => new Date().toISOString().slice(0, 10);

export default function SocialPulse() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inMatch = /^\/play\/[^/]+\/game/.test(pathname);
  const [invites, setInvites] = useState<DuelInvite[]>([]);
  const [streak, setStreak] = useState<{ day: number; reward: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  // daily login streak: once per UTC day per account (the server pays only once anyway)
  useEffect(() => {
    if (!user) return;
    const key = `pixelcode.dailyLogin.${user.id}`;
    try {
      if (localStorage.getItem(key) === todayUtc()) return;
    } catch {
      /* storage blocked: just ask the server */
    }
    claimDailyLogin()
      .then((r) => {
        try {
          localStorage.setItem(key, todayUtc());
        } catch {
          /* ignore */
        }
        if (r.claimed) {
          setStreak({ day: r.streak, reward: r.reward });
          window.dispatchEvent(new Event("pixelcode:daily-login"));
          void refreshUser();
          setTimeout(() => setStreak(null), 6000);
        }
      })
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // duel invitations from friends
  useEffect(() => {
    if (!user || inMatch) {
      setInvites([]);
      return;
    }
    let alive = true;
    const poll = () =>
      getInvites()
        .then((r) => {
          if (!alive) return;
          const fresh = r.invites.filter((i) => !seen.current.has(i.code));
          if (fresh.length) sfx.unlock();
          fresh.forEach((i) => seen.current.add(i.code));
          setInvites(r.invites);
          window.dispatchEvent(new CustomEvent("pixelcode:friend-requests", { detail: r.requests }));
        })
        .catch(() => {});
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user?.id, inMatch]);

  const accept = async (inv: DuelInvite) => {
    setError(null);
    try {
      const room = await joinRoom(inv.code);
      setInvites((l) => l.filter((i) => i.code !== inv.code));
      navigate(room.roomStatus === "PLAYING" ? `/play/${room.code}/game` : `/play/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unexpected_error"));
    }
  };

  const decline = (inv: DuelInvite) => {
    setInvites((l) => l.filter((i) => i.code !== inv.code));
    void dismissInvite(inv.code).catch(() => {});
  };

  if (!user || (inMatch && !streak)) return null;
  return (
    <div className="fixed top-3 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none font-pixel">
      {streak && (
        <div className="enter-up pointer-events-auto flex items-center gap-3 border-2 border-yellow bg-[#0a0f25]/95 px-4 py-2 shadow-[0_0_18px_rgba(253,224,71,0.45)]">
          <span className="text-2xl" aria-hidden>
            🔥
          </span>
          <span className="text-yellow text-base sm:text-lg">{t("dl_toast", { n: streak.day })}</span>
          <span dir="ltr" className="text-neon text-base sm:text-lg whitespace-nowrap">
            +{streak.reward} PX
          </span>
        </div>
      )}
      {!inMatch &&
        invites.map((inv) => (
          <div
            key={inv.code}
            role="alert"
            className="enter-up pointer-events-auto w-full max-w-md flex flex-col gap-2 border-2 border-pink bg-[#0a0f25]/95 px-4 py-3 shadow-[0_0_20px_rgba(254,44,150,0.5)]"
          >
            <span className="text-yellow text-lg">⚔ {t("fr_invite_title", { name: inv.fromName })}</span>
            <div className="flex gap-2">
              <button onClick={() => accept(inv)} className="flex-1 bg-pink border-2 border-yellow text-black py-1.5 text-lg">
                {t("fr_accept_duel")}
              </button>
              <button onClick={() => decline(inv)} className="flex-1 border-2 border-neon text-yellow py-1.5 text-lg">
                {t("fr_decline")}
              </button>
            </div>
            {error && <span className="font-sans text-sm text-pink">{error}</span>}
          </div>
        ))}
    </div>
  );
}
