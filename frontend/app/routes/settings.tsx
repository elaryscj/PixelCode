import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import MusicSlider from "../components/MusicSlider";
import { getSfxVolume, setSfxVolume, sfx } from "~/lib/sfx";
import { Link, useNavigate } from "react-router";
import { logoutUser } from "~/api/auth";
import { LANGUAGES } from "~/language-config/languages";

const Settings = () => {

  const { t, i18n } = useTranslation();

  // sound effects volume (separate from music); read after mount so SSR matches
  const [fxVol, setFxVol] = useState(60);
  useEffect(() => setFxVol(Math.round(getSfxVolume() * 100)), []);


  const navigate = useNavigate();
  const [fsDenied, setFsDenied] = useState(false);
  const toggleFullscreen = async () => {
    setFsDenied(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFsDenied(true); // permission denied: the game stays usable in a window
    }
  };

  const card = "border border-neon/50 bg-[#060816]/80 p-4 sm:p-5";
  const heading = "block font-pixel text-neon text-2xl sm:text-3xl mb-3";
  const btnCls =
    "btn-arcade py-2 px-4 text-xl sm:text-2xl border border-neon font-pixel text-yellow hover:text-glow-sm disabled:opacity-40 disabled:pointer-events-none";
  const current = i18n.resolvedLanguage;

  return (
    <>
      <div className="star-background"></div>
      <div className="w-full max-w-200 mx-auto px-4 py-6 enter-up">
        <h1 className="font-pixel text-yellow text-glow-sm text-center text-[12vw]/none sm:text-7xl/none mb-6">
          {t("settings").toUpperCase()}
        </h1>
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h3 className={heading}>[ {t("music_audio")} ]</h3>
            <MusicSlider />
            <label htmlFor="sfx-volume" className="block font-pixel text-xl sm:text-3xl mt-4">{t("sound_effects")}</label>
            <div className="flex items-center justify-center gap-4">
              <input
                id="sfx-volume"
                type="range"
                min={0}
                max={100}
                value={fxVol}
                onChange={(e) => {
                  setFxVol(+e.target.value);
                  setSfxVolume(+e.target.value / 100);
                }}
                onPointerUp={() => sfx.doorOpen()}
                onKeyUp={() => sfx.jump()}
                className="range-bar"
                style={{ "--range-pct": `${fxVol}%`, "--range-fill": "#FE2C96" } as React.CSSProperties}
              />
              <h3 className="font-pixel text-yellow text-xl sm:text-2xl w-14 text-end">{fxVol}%</h3>
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>[ {t("language")} ]</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  lang={l.htmlLang}
                  dir={l.rtl ? "rtl" : "ltr"}
                  onClick={() => i18n.changeLanguage(l.code)}
                  aria-pressed={current === l.code}
                  className={`${btnCls} !text-base sm:!text-lg !px-2 font-sans ${current === l.code ? "bg-neon/15 border-glow-sm-neon" : ""}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          {/* Nickname, e-mail, password and account deletion all live on one page: /profile */}
          <section className={card}>
            <h3 className={heading}>[ {t("account")} ]</h3>
            <p className="font-sans text-gray-400 text-sm mb-3">
              {t("account_hint")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/profile" className={btnCls}>
                {t("manage_account")}
              </Link>
              <Link to="/results" className={btnCls}>
                {t("match_history")}
              </Link>
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>[ {t("fullscreen")} ]</h3>
            <button onClick={toggleFullscreen} className={btnCls}>
              {t("toggle_fullscreen")}
            </button>
            {fsDenied && <p className="font-pixel text-pink text-xl mt-2">{t("fullscreen_blocked")}</p>}
          </section>
        </div>

        <button
          onClick={() => { logoutUser(); navigate("/login"); }}
          className="btn-arcade mt-6 w-full sm:w-auto py-2 px-6 text-2xl border-2 border-pink font-pixel text-pink hover:text-glow-sm"
        >
          {t("log_out")}
        </button>
      </div>
    </>
  );
}

export default Settings;
