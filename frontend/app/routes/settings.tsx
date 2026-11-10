import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import MusicSlider from "../components/MusicSlider";
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


  const [language, setLanguage] = useState('en')
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

  return (  
    <>
      <div className="star-background"></div>
      <div className="flex items-center justify-center gap-12 mx-auto max-w-200 lg:flex sm:hidden">
        <div>
          <div className="music-audio">
            <h3 className="font-pixel text-neon text-3xl my-4">[ {t("music_audio")} ]</h3>
            <MusicSlider />
          </div>

          <div className="language w-full">
            <label htmlFor="language" className="block font-pixel text-neon text-3xl my-4">
              [ {t("language")} ]
            </label>
            <div className="flex items-center justify-start gap-4">
              <button className="py-1 px-4 text-2xl font-bold border hover:text-glow-sm border-neon hover:border-glow-neon-sm font-pixel text-yellow" value={'en'} lang="en" onClick={() => {i18n.changeLanguage('en')}}>English</button>
              <button className="py-1 px-4 text-2xl font-bold border hover:text-glow-sm border-neon hover:border-glow-neon-sm font-pixel text-yellow" value={'kz'} lang="kz" onClick={() => {i18n.changeLanguage('kz')}}>Qazaqsha</button>
            </div>
          </div>
        </div>
        <div>

          <div className="nickname w-full">
            <label htmlFor="nickname" className="block font-pixel text-neon text-3xl my-4">
              [ {t("nickname")} ]
            </label>
            <div className="flex items-center justify-start gap-4">
              <input
                id="nickname"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={NICKNAME_MAX}
                placeholder="Player"
                className="py-1 px-3 text-2xl bg-transparent border border-neon font-pixel text-yellow outline-none focus:border-glow-neon-sm"
              />
              <button
                onClick={() => saveNickname(draft)}
                disabled={!canSave}
                className="py-1 px-4 text-2xl font-bold border border-neon font-pixel text-yellow hover:text-glow-sm hover:border-glow-neon-sm disabled:opacity-40 disabled:pointer-events-none"
              >
                Save
              </button>
            </div>
          </div>

          <div className="fullscreen w-full">
            <h3 className="font-pixel text-neon text-3xl my-4">[ FULLSCREEN ]</h3>
            <button onClick={toggleFullscreen} className="py-1 px-4 text-2xl font-bold border border-neon font-pixel text-yellow hover:text-glow-sm hover:border-glow-neon-sm">
              Toggle fullscreen
            </button>
            {fsDenied && <p className="font-pixel text-pink text-xl mt-2">Fullscreen was blocked by the browser.</p>}
          </div>

          <button
            onClick={() => { logoutUser(); navigate("/login"); }}
            className="mt-8 py-1 px-4 text-2xl font-bold border-2 border-pink font-pixel text-pink hover:text-glow-sm"
          >
            Log out
          </button>
        </div>
      </div>
      <h3 className="font-pixel text-4xl text-yellow hover:text-glow-sm text-center lg:hidden">Sorry, the game is not yet available for your device...</h3>
    </> 
  );
}
 
export default Settings;