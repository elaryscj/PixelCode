import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import MusicSlider from "../components/MusicSlider";
import { getSfxVolume, setSfxVolume, sfx } from "~/lib/sfx";
import { useNavigate } from "react-router";
import { logoutUser } from "~/api/auth";
import { useNickname, saveNickname, isValidNickname, NICKNAME_MAX } from "~/lib/nickname";

const Settings = () => {

  const { t, i18n } = useTranslation();

    const nickname = useNickname();
    const [draft, setDraft] = useState("");

    useEffect(() => {
      if (nickname) setDraft(nickname);
    }, [nickname]);

  const canSave = isValidNickname(draft) && draft.trim() !== nickname;

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
            <label htmlFor="sfx-volume" className="block font-pixel text-xl sm:text-3xl mt-4">Sound Effects</label>
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
                style={{ background: `linear-gradient(to right, #FE2C96 0% ${fxVol}%, #16233c ${fxVol}% 100%)` }}
              />
              <h3 className="font-pixel text-yellow text-xl sm:text-2xl w-14 text-right">{fxVol}%</h3>
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>[ {t("language")} ]</h3>
            <div className="flex flex-wrap items-center gap-3">
              {[
                ["en", "English"],
                ["kz", "Qazaqsha"],
              ].map(([code, label]) => (
                <button
                  key={code}
                  lang={code}
                  onClick={() => i18n.changeLanguage(code)}
                  className={`${btnCls} ${current === code ? "bg-neon/15 border-glow-sm-neon" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className={card}>
            <label htmlFor="nickname" className={heading}>
              [ {t("nickname")} ]
            </label>
            <div className="flex items-center gap-3">
              <input
                id="nickname"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={NICKNAME_MAX}
                placeholder="Player"
                className="min-w-0 flex-1 py-2 px-3 text-xl sm:text-2xl bg-transparent border border-neon font-pixel text-yellow outline-none focus:border-glow-sm-neon"
              />
              <button onClick={() => saveNickname(draft)} disabled={!canSave} className={btnCls}>
                Save
              </button>
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>[ FULLSCREEN ]</h3>
            <button onClick={toggleFullscreen} className={btnCls}>
              Toggle fullscreen
            </button>
            {fsDenied && <p className="font-pixel text-pink text-xl mt-2">Fullscreen was blocked by the browser.</p>}
          </section>
        </div>

        <button
          onClick={() => { logoutUser(); navigate("/login"); }}
          className="btn-arcade mt-6 w-full sm:w-auto py-2 px-6 text-2xl border-2 border-pink font-pixel text-pink hover:text-glow-sm"
        >
          Log out
        </button>
      </div>
    </>
  );
}

export default Settings;
