import { useTranslation } from "react-i18next";
import { useAudio } from "../context/AudioContex";

export default function MusicSlider() {
  const { t } = useTranslation();
  const { volume, setVolume } = useAudio();
  const val = Math.round(volume * 100);   // 0–1 → 0–100 for the input
  const pct = val;                        // min0/max100, so pct === val

  return (
    <div>
      <label htmlFor="music-volume" className="font-pixel text-xl sm:text-3xl">{t("music_volume")}</label>

      <div className="flex items-center justify-center gap-4">
        <input
          id="music-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={val}
          onChange={(e) => setVolume(+e.target.value / 100)}   // 0–100 → 0–1
          className="range-bar"
          style={{
            background: `linear-gradient(to right, #5fd0ea 0% ${pct}%, #16233c ${pct}% 100%)`,
          }}
        />
        <h3 className="font-pixel text-yellow text-xl sm:text-2xl w-14 text-right">{val}%</h3>
      </div>
    </div>
  );
}