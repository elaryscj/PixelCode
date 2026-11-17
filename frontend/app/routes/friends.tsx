// app/routes/friends.tsx  —  /friends : add friends, answer requests, see who is online, challenge to a duel
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FaCheck, FaTimes, FaUserPlus } from "react-icons/fa";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { SkinArt } from "~/components/skins";
import { getCurrentUser } from "~/api/auth";
import { ApiError } from "~/api/http";
import {
  acceptFriend,
  challengeFriend,
  getFriends,
  removeFriend,
  sendFriendRequest,
  type FriendEntry,
  type FriendList,
  type FriendStatus,
} from "~/api/friends";

export function meta() {
  return [{ title: "Friends | PixelCode Arena" }];
}

const REFRESH_MS = 10_000;

const STATUS_STYLE: Record<FriendStatus, { dot: string; key: string }> = {
  ONLINE: { dot: "bg-neon shadow-[0_0_8px_#01e4ff]", key: "fr_online" },
  IN_MATCH: { dot: "bg-yellow", key: "fr_in_match" },
  OFFLINE: { dot: "bg-gray-600", key: "fr_offline" },
};

function FriendsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<FriendList | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => getFriends().then(setData).catch(() => {}), []);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate(`/login?next=${encodeURIComponent("/friends")}`);
      return;
    }
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load, navigate]);

  const fail = (e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : t("unexpected_error") });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setMsg(null);
    try {
      const r = await sendFriendRequest(name.trim());
      setMsg({ ok: true, text: r.accepted ? t("fr_now_friends", { name: r.username }) : t("fr_request_sent", { name: r.username }) });
      setName("");
      void load();
    } catch (err) {
      fail(err);
    }
  };

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const challenge = async (f: FriendEntry) => {
    setBusy(f.requestId);
    setMsg(null);
    try {
      const room = await challengeFriend(f.userId);
      navigate(`/play/${room.code}`);
    } catch (err) {
      if (err instanceof ApiError && err.data?.roomCode) navigate(`/play/${err.data.roomCode}`);
      else fail(err);
    } finally {
      setBusy(null);
    }
  };

  const row = "flex items-center gap-3 border-2 bg-[#060b1e] px-3 py-2";
  const iconBtn = "w-10 h-10 flex items-center justify-center border-2 disabled:opacity-40";

  return (
    <>
      <div className="star-background" />
      <div className="container max-w-200 mx-auto font-pixel flex flex-col gap-6 px-4 py-6 enter-up">
        <div className="flex items-center justify-between">
          <Link to="/" className="border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10">
            &lt; {t("menu")}
          </Link>
        </div>
        <h1 className="text-yellow text-[13vw]/none sm:text-7xl/none text-center text-glow-sm">{t("fr_title")}</h1>

        <form onSubmit={add} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder={t("fr_add_placeholder")}
            aria-label={t("fr_add_placeholder")}
            className="flex-1 min-w-0 bg-[#02050f] border-2 border-neon text-white px-3 py-2 font-sans text-lg outline-none"
          />
          <button className="flex items-center gap-2 bg-pink border-2 border-yellow text-black px-4 text-lg whitespace-nowrap">
            <FaUserPlus /> {t("fr_add")}
          </button>
        </form>
        {msg && (
          <p className={`font-sans text-sm border px-3 py-2 ${msg.ok ? "text-neon border-neon/40 bg-neon/10" : "text-pink border-pink/40 bg-pink/10"}`}>
            {msg.text}
          </p>
        )}

        {!data && <p className="text-neon text-center animate-pulse">{t("loading")}</p>}

        {data && data.incoming.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-pink text-2xl">{t("fr_incoming", { n: data.incoming.length })}</h2>
            {data.incoming.map((f) => (
              <div key={f.requestId} className={`${row} border-pink/60`}>
                <span className="flex-1 min-w-0 truncate text-yellow text-lg">
                  {f.username} <span dir="ltr" className="text-gray-400 text-sm">{f.rating} MMR</span>
                </span>
                <button
                  disabled={busy === f.requestId}
                  onClick={() => act(f.requestId, () => acceptFriend(f.requestId))}
                  className={`${iconBtn} border-neon text-neon`}
                  aria-label={t("fr_accept")}
                  title={t("fr_accept")}
                >
                  <FaCheck />
                </button>
                <button
                  disabled={busy === f.requestId}
                  onClick={() => act(f.requestId, () => removeFriend(f.requestId))}
                  className={`${iconBtn} border-pink text-pink`}
                  aria-label={t("fr_decline")}
                  title={t("fr_decline")}
                >
                  <FaTimes />
                </button>
              </div>
            ))}
          </section>
        )}

        {data && (
          <section className="flex flex-col gap-2">
            <h2 className="text-neon text-2xl">{t("fr_list", { n: data.friends.length })}</h2>
            {data.friends.length === 0 && <p className="font-sans text-gray-400 text-sm border border-dashed border-neon/30 px-4 py-6 text-center">{t("fr_empty")}</p>}
            {data.friends.map((f) => {
              const st = STATUS_STYLE[f.status ?? "OFFLINE"];
              return (
                <div key={f.requestId} className={`${row} border-neon/40`}>
                  <SkinArt id={f.activeSkin} className="h-12 w-auto shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="truncate text-yellow text-lg">{f.username}</span>
                    <span className="flex items-center gap-2 text-xs text-gray-300">
                      <span className={`w-2.5 h-2.5 ${st.dot}`} /> {t(st.key)} · <span dir="ltr">{f.rating} MMR</span>
                    </span>
                  </div>
                  <button
                    disabled={busy === f.requestId || f.status !== "ONLINE"}
                    onClick={() => challenge(f)}
                    className="bg-pink border-2 border-yellow text-black px-3 py-1.5 text-sm sm:text-base disabled:opacity-35 disabled:bg-transparent disabled:text-gray-400 disabled:border-gray-600"
                  >
                    ⚔ {t("fr_challenge")}
                  </button>
                  <button
                    disabled={busy === f.requestId}
                    onClick={() => window.confirm(t("fr_remove_confirm", { name: f.username })) && act(f.requestId, () => removeFriend(f.requestId))}
                    className={`${iconBtn} border-gray-600 text-gray-400 hover:text-pink hover:border-pink`}
                    aria-label={t("fr_remove")}
                    title={t("fr_remove")}
                  >
                    <FaTimes />
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {data && data.outgoing.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-gray-300 text-xl">{t("fr_outgoing")}</h2>
            {data.outgoing.map((f) => (
              <div key={f.requestId} className={`${row} border-gray-700`}>
                <span className="flex-1 min-w-0 truncate text-gray-200">{f.username}</span>
                <button
                  disabled={busy === f.requestId}
                  onClick={() => act(f.requestId, () => removeFriend(f.requestId))}
                  className="border border-gray-600 text-gray-300 px-3 py-1 text-sm hover:text-pink"
                >
                  {t("fr_cancel_request")}
                </button>
              </div>
            ))}
          </section>
        )}

        <p className="font-sans text-xs text-gray-500">{t("fr_hint")}</p>
      </div>
    </>
  );
}

export default function Friends() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <FriendsScreen />}</ClientOnly>;
}
