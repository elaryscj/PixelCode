// app/routes/join.tsx  —  /join/:code : a friend's invite link. Signs in first if needed, then joins the room.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { getCurrentUser } from "~/api/auth";
import { ApiError, joinRoom } from "~/api/room";

export function meta() {
  return [{ title: "Join a duel | PixelCode Arena" }];
}

function JoinScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code: raw = "" } = useParams();
  const code = raw.trim().toUpperCase();
  const [error, setError] = useState<string | null>(null);
  const [otherRoom, setOtherRoom] = useState<string | null>(null);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate(`/login?next=${encodeURIComponent(`/join/${code}`)}`, { replace: true });
      return;
    }
    let alive = true;
    joinRoom(code)
      .then((room) => {
        if (alive) navigate(room.roomStatus === "PLAYING" ? `/play/${room.code}/game` : `/play/${room.code}`, { replace: true });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.data?.roomCode) setOtherRoom(String(e.data.roomCode));
        setError(e instanceof Error ? e.message : t("unexpected_error"));
      });
    return () => {
      alive = false;
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="star-background" />
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 font-pixel px-4 text-center">
        <h1 className="text-yellow text-5xl sm:text-7xl text-glow-sm">{t("inv_title")}</h1>
        <p className="text-pink text-4xl tracking-widest">{code}</p>
        {!error && <p className="text-neon text-xl animate-pulse">{t("inv_joining")}</p>}
        {error && (
          <>
            <p className="text-pink text-xl max-w-xl">{error}</p>
            <div className="flex flex-wrap justify-center gap-4">
              {otherRoom && (
                <Link to={`/play/${otherRoom}`} className="bg-pink border-2 border-yellow text-black px-6 py-2 text-xl">
                  {t("return_lobby")} {otherRoom}
                </Link>
              )}
              <Link to="/play" className="border-2 border-neon text-yellow px-6 py-2 text-xl">
                {t("inv_to_menu")}
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function Join() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <JoinScreen />}</ClientOnly>;
}
