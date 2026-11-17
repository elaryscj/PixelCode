// app/routes/store.tsx
// PixelCode Arena Store: skins are bought with PIXELS (balance, ownership and prices are kept on the server)
import { useState, useEffect, useCallback } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { Link, useNavigate } from "react-router";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import i18n from "~/language-config/languages";
import { SkinArt } from "~/components/skins";
import { getCurrentUser, refreshUser } from "~/api/auth";
import { buySkin, equipSkin, getStore, type StoreState } from "~/api/store";
import { onlineLabel, useLiveStats } from "~/lib/liveStats";
import PingBadge from "~/components/PingBadge";

type Skin = {
  id: string;
  name: string;
  category: string;
  shortDesc: string;
  lore: string;
  glow: string;
  /** a season top-3 prize: never sold, only its winners see it */
  exclusive?: boolean;
};

const BASE_SKINS: Skin[] = [
  {
    id: "neon_ronin",
    name: "NEON RONIN",
    category: "EPIC // ARENA ORIGINALS",
    shortDesc: "The last of the neon clan.",
    lore: "Forged in the neon streets of the old arena, this lone warrior carries the code of a fallen clan. Every duel keeps their legacy alive.",
    glow: "rgba(1,228,255,0.4)",
  },
  {
    id: "crimson_cipher",
    name: "CRIMSON CIPHER",
    category: "EPIC // ARENA ORIGINALS",
    shortDesc: "A rebel from the lost sector.",
    lore: "Once a brilliant engineer, Crimson Cipher uncovered a secret hidden in the arena's AI. Betrayed and stripped of her memories, she now fights to uncover the truth.",
    glow: "rgba(255,42,133,0.5)",
  },
  {
    id: "byte_knight",
    name: "BYTE KNIGHT",
    category: "EPIC // ARENA ORIGINALS",
    shortDesc: "Guardian of the first server.",
    lore: "Ancient protocol automaton preserved from the root mainframe. Rebuilt to defend the core algorithms at any cost.",
    glow: "rgba(253,224,71,0.4)",
  },
  {
    id: "pumpkin_phantom",
    name: "PUMPKIN PHANTOM",
    category: "LIMITED // HALLOWEEN",
    shortDesc: "Halloween special. Free for now!",
    lore: "Every October the arena servers glitch and something with a glowing grin crawls out of the cache. It never loses a duel on Halloween night.",
    glow: "rgba(249,115,22,0.55)",
  },
];

// "1 200 PIXELS" is wrapped in Unicode isolates (LRI ... PDI) so it never turns into "PIXELS 1 200" in Arabic / Urdu
const pixels = (n: number) => `\u2066${n.toLocaleString()} PIXELS\u2069`;
const priceLabel = (n: number) => (n === 0 ? i18n.t("st_free") : pixels(n));

function StoreRouteScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const liveStats = useLiveStats();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [store, setStore] = useState<StoreState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate("/login", { replace: true });
      return;
    }
    getStore()
      .then(setStore)
      .catch((e) => showToast(e instanceof Error ? e.message : t("st_err_load")));
  }, [navigate]);

  const balance = store?.balance ?? 0;
  const ownedSkins = store?.owned ?? ["neon_ronin"];
  const SKINS: Skin[] = [
    ...BASE_SKINS,
    ...(store?.catalog ?? []).map((c) =>
      c.exclusive
        ? {
            id: c.id,
            name: c.name.toUpperCase(),
            category: "SEASON PRIZE // TOP 3",
            shortDesc: t("st_exclusive"),
            lore: t("st_exclusive_lore", { n: c.season ?? "?" }),
            glow: "rgba(253,224,71,0.45)",
            exclusive: true,
          }
        : {
            id: c.id,
            name: c.name.toUpperCase(),
            category: "NEW DROP // ARENA STORE",
            shortDesc: "Fresh arrival in the store.",
            lore: "A brand-new cosmetic published by the arena team. Equip it and stand out in the next duel.",
            glow: "rgba(1,228,255,0.4)",
          },
    ),
  ];
  const activeSkin = store?.active ?? "neon_ronin";
  const priceOf = (id: string) => store?.prices?.[id] ?? 0;
  const labelOf = (s: Skin) => (s.exclusive ? t("st_exclusive") : priceLabel(priceOf(s.id)));

  const currentSkin = SKINS[currentIndex];
  const price = priceOf(currentSkin.id);
  const isOwned = ownedSkins.includes(currentSkin.id);
  const isEquipped = activeSkin === currentSkin.id;
  const afterPurchase = balance - price;

  const handlePrev = useCallback(() => setCurrentIndex((prev) => (prev - 1 + SKINS.length) % SKINS.length), []);
  const handleNext = useCallback(() => setCurrentIndex((prev) => (prev + 1) % SKINS.length), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const missing = Math.max(0, price - balance);
  const cantAfford = !isOwned && price > 0 && balance < price;

  const doBuy = async () => {
    setBusy(true);
    try {
      setStore(await buySkin(currentSkin.id));
      setConfirming(false);
      showToast(price === 0 ? t("st_toast_free", { name: currentSkin.name }) : t("st_toast_bought", { name: currentSkin.name }));
      void refreshUser();
    } catch (e) {
      setConfirming(false);
      showToast(e instanceof Error ? e.message : t("unexpected_error"));
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async () => {
    if (isEquipped || busy || !store || cantAfford) return;
    if (isOwned) {
      setBusy(true);
      try {
        setStore(await equipSkin(currentSkin.id));
        showToast(t("st_toast_equipped", { name: currentSkin.name }));
        void refreshUser();
      } catch (e) {
        showToast(e instanceof Error ? e.message : t("unexpected_error"));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (price === 0) {
      await doBuy(); // free skins need no confirmation
      return;
    }
    setConfirming(true);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#040714] text-white flex flex-col justify-between select-none overflow-hidden font-pixel">
      {/* Background Cyberpunk Grid */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(1, 228, 255, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(1, 228, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="star-background pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full px-8 py-5 border-b border-[#01E4FF]/40 flex items-center justify-between bg-[#040714]/80 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10 transition-colors"
        >
          &lt; {t("menu")}
        </Link>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#01E4FF]">{t("server")}</span>
          <span className="w-2 h-2 rounded-full bg-yellow animate-pulse" />
          <PingBadge />
          <span className="w-2 h-2 rounded-full bg-yellow animate-pulse" />
          <span className="text-gray-300">{onlineLabel(liveStats)}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-4 max-w-[1240px] w-full mx-auto">
        
        {/* Page Title */}
        <div className="text-center mb-6">
          <div className="text-[11px] text-[#01E4FF] tracking-widest uppercase mb-1">
            — PIXELCODE ARENA —
          </div>
          <h1 className="text-yellow text-4xl sm:text-5xl tracking-widest text-glow-sm">
            {t("store").toUpperCase()}
          </h1>
          <div className="text-[10px] text-gray-400 tracking-wider mt-1 uppercase">
            {t("st_tagline")}
          </div>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full items-stretch">
          
          {/* LEFT: Skin Preview Card */}
          <div className="bg-[#070c1e]/90 border-2 border-[#01E4FF] p-6 shadow-[0_0_25px_rgba(1,228,255,0.2)] flex flex-col justify-between relative min-h-[420px]">
            {/* Header inside Preview */}
            <div className="flex justify-between items-center text-xs tracking-wider text-[#01E4FF]">
              <span>{t("st_preview")}</span>
              <span dir="ltr" className="text-gray-400">{String(currentIndex + 1).padStart(2, "0")} / {String(SKINS.length).padStart(2, "0")}</span>
            </div>

            {/* Character Stage with Working Chevrons */}
            <div className="flex-1 flex items-center justify-between my-4 relative">
              {/* Left Arrow Button */}
              <button
                onClick={handlePrev}
                className="w-10 h-10 border-2 border-[#01E4FF] bg-[#02050f] text-yellow flex items-center justify-center text-sm hover:border-glow-neon hover:text-white active:scale-95 transition-all cursor-pointer z-10"
                title="Previous Skin (Arrow Left)"
              >
                <FaChevronLeft className="rtl:-scale-x-100" />
              </button>

              {/* Character Figure & Glowing Podium */}
              <div className="flex flex-col items-center justify-center flex-1">
                <div className="transition-transform duration-300 hover:scale-105" style={{ filter: `drop-shadow(0 0 14px ${currentSkin.glow})` }}>
                  <SkinArt id={currentSkin.id} size="large" className="h-[380px] w-auto max-w-[280px]" />
                </div>
                {/* Glowing cyan platform underneath */}
                <div className="w-48 h-1 bg-[#01E4FF] shadow-[0_0_16px_#01E4FF] mt-[-8px]" />
              </div>

              {/* Right Arrow Button */}
              <button
                onClick={handleNext}
                className="w-10 h-10 border-2 border-[#01E4FF] bg-[#02050f] text-yellow flex items-center justify-center text-sm hover:border-glow-neon hover:text-white active:scale-95 transition-all cursor-pointer z-10"
                title="Next Skin (Arrow Right)"
              >
                <FaChevronRight className="rtl:-scale-x-100" />
              </button>
            </div>

            {/* Bottom Label & Carousel Dash Indicators */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-yellow text-sm tracking-wider uppercase">
                {currentSkin.name}
              </span>
              <div className="flex items-center gap-1.5">
                {SKINS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-1 transition-all cursor-pointer ${
                      i === currentIndex 
                        ? "w-8 bg-[#01E4FF] shadow-[0_0_8px_#01E4FF]" 
                        : "w-3 bg-gray-600 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Skin Details & Purchase Box */}
          <div className="flex flex-col justify-between gap-6">
            
            {/* Header info */}
            <div>
              <div className="flex justify-between items-center text-xs tracking-wider mb-1">
                <span dir="ltr" className="text-pink">{currentSkin.category}</span>
                <span className="text-[#01E4FF]">{isEquipped ? t("st_equipped") : isOwned ? t("st_owned") : t("st_available")}</span>
              </div>
              <h2 className="text-yellow text-3xl sm:text-4xl tracking-wider mb-4">
                {currentSkin.name}
              </h2>

              <div className="mb-2 text-[#01E4FF] text-xs">&gt; {t("st_history")}</div>
              <p className="text-gray-300 text-xs leading-relaxed font-sans max-w-lg">
                <span dir="auto" className="block">{currentSkin.lore}</span>
              </p>
            </div>

            {/* UNLOCK_SKIN Box */}
            <div className="bg-[#070c1e]/90 border-2 border-[#01E4FF] p-6 shadow-[0_0_20px_rgba(1,228,255,0.15)] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#01E4FF]/30">
                <span className="text-sm text-[#01E4FF]">&gt; {t("st_unlock")}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-pink animate-pulse" />
              </div>

              {/* Price Row */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-yellow tracking-wider uppercase">{t("st_price")}</span>
                <div className="w-full bg-[#02050f] border border-[#01E4FF] px-4 py-2.5 text-xs text-yellow tracking-wider">
                  {labelOf(currentSkin)}
                </div>
              </div>

              {/* Balance Row */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-yellow tracking-wider uppercase">{t("st_balance")}</span>
                <div className="w-full bg-[#02050f] border border-[#01E4FF] px-4 py-2.5 text-xs text-[#01E4FF] tracking-wider">
                  {pixels(balance)}
                </div>
              </div>

              {/* Buy / Equip Button */}
              <button
                onClick={handleAction}
                disabled={isEquipped || busy || cantAfford}
                className={`w-full py-3.5 font-pixel text-sm uppercase tracking-widest transition-all active:scale-[0.99] ${
                  isEquipped
                    ? "bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed"
                    : cantAfford
                    ? "bg-[#1b2547] text-[#6b7aa8] border-2 border-pink/70 cursor-not-allowed"
                    : isOwned
                    ? "bg-[#01E4FF] text-black border-2 border-yellow hover:brightness-110 cursor-pointer shadow-[0_0_12px_rgba(1,228,255,0.4)]"
                    : "bg-[#FE2C96] text-black border-2 border-yellow hover:brightness-110 cursor-pointer shadow-[0_0_12px_rgba(254,44,150,0.4)]"
                }`}
              >
                {isEquipped ? t("st_equipped") : isOwned ? t("st_equip") : price === 0 ? t("st_get_free") : t("st_buy")}
              </button>

              {cantAfford ? (
                <div className="text-center text-[10px] leading-tight">
                  <div className="text-pink">{t("st_not_enough")}</div>
                  <div className="mt-1 text-gray-300">{missing.toLocaleString()} PIXELS MORE REQUIRED</div>
                </div>
              ) : (
                <div className="text-center text-[9px] text-gray-400 leading-tight">
                  {!isOwned && price > 0 && <div>{t("st_after")}: {pixels(afterPurchase)}</div>}
                  <div className="mt-1">{t("st_permanent")}</div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Bottom Selector Carousel (Thumbnails) */}
        <div className="w-full mt-8">
          <div className="flex justify-between items-center text-xs text-[#01E4FF] mb-3">
            <span>{t("st_collection")}</span>
            <span className="text-gray-400 text-[10px]">{t("st_count", { n: SKINS.length })}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {SKINS.map((skin, i) => {
              const isSelected = i === currentIndex;
              return (
                <div
                  key={skin.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`p-3.5 bg-[#070c1e] flex items-center gap-3 cursor-pointer transition-all border-2 ${
                    isSelected
                      ? "border-[#01E4FF] shadow-[0_0_15px_rgba(1,228,255,0.3)] bg-[#0c1533]"
                      : "border-[#01E4FF]/30 hover:border-[#01E4FF]/70"
                  }`}
                >
                  <div className="w-12 h-14 bg-[#02050f] border border-[#01E4FF]/40 flex items-center justify-center shrink-0">
                    <SkinArt id={skin.id} size="small" className="h-12 w-auto" />
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden">
                    <div className="text-yellow text-xs tracking-wider truncate">{skin.name}</div>
                    <div dir="auto" className="text-gray-400 text-[9px] truncate">{skin.shortDesc}</div>
                    <div className="text-[#01E4FF] text-[10px] mt-1">{labelOf(skin)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm purchase */}
        {confirming && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" onClick={() => !busy && setConfirming(false)}>
            <div
              className="w-full max-w-[680px] bg-[#070c1e] border-2 border-[#01E4FF] p-6 shadow-[0_0_30px_rgba(1,228,255,0.35)] flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#01E4FF]">
                <span className="text-xl text-[#01E4FF] tracking-wider">&gt; {t("st_confirm_title")}</span>
                <span className="w-2.5 h-2.5 bg-pink" />
              </div>

              <div className="flex gap-5">
                <div className="w-40 h-60 shrink-0 bg-[#02050f] border border-[#01E4FF]/40 flex items-end justify-center p-2">
                  <SkinArt id={currentSkin.id} size="large" className="h-full w-auto" />
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <h3 className="text-yellow text-3xl tracking-wider">{currentSkin.name}</h3>
                  <div dir="ltr" className="text-pink text-[11px] tracking-wider">{currentSkin.category}</div>
                  <p className="text-gray-300 text-xs font-sans leading-relaxed">
                    Unlock this skin permanently. Cosmetics do not affect gameplay.
                  </p>
                  <div className="text-[#01E4FF] text-2xl tracking-wider">{labelOf(currentSkin)}</div>
                </div>
              </div>

              <div className="border border-[#01E4FF]/50 p-4 flex flex-col gap-3 text-xs">
                <div className="flex justify-between text-gray-300">
                  <span className="font-sans">{t("st_your_balance")}</span>
                  <span className="text-[#01E4FF] tracking-wider">{pixels(balance)}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="font-sans">{t("st_after")}</span>
                  <span className="text-yellow tracking-wider">{pixels(afterPurchase)}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={doBuy}
                  disabled={busy}
                  className="flex-1 py-3 bg-[#FE2C96] text-black border-2 border-yellow text-sm tracking-widest hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? "..." : t("st_confirm")}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="flex-1 py-3 bg-[#02050f] text-white border-2 border-[#01E4FF] text-sm tracking-widest hover:bg-[#0c1533] cursor-pointer"
                >
                  {t("cancel")}
                </button>
              </div>

              <div className="text-[10px] text-gray-400 tracking-wider">{t("st_permanent")}</div>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-[#070c1e] border-2 border-yellow text-yellow px-6 py-3 text-xs tracking-widest shadow-[0_0_20px_rgba(253,224,71,0.5)] animate-bounce">
            [✓] {toastMessage}
          </div>
        )}

      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full px-8 py-3.5 border-t border-[#01E4FF]/40 flex items-center justify-between text-[10px] text-[#01E4FF] bg-[#040714]/80">
        <div>
          <span className="text-yellow">CLIENT VERSION v1.4.2-BETA</span>
          <span className="mx-3 text-gray-600">|</span>
          <span className="text-gray-400">SYSTEM_ENCRYPTION: ACTIVE (AES_256)</span>
        </div>

        {/* social links hidden until the project has its own accounts */}
      </footer>
    </div>
  );
}

export default function StoreRoute() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <StoreRouteScreen />}</ClientOnly>;
}
