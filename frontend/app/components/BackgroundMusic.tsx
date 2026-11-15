import { useRef, useEffect } from "react";
import { useLocation } from "react-router";
import { useAudio } from "../context/AudioContex";

// Lo-fi tracks from Open Lo-Fi (CC0, public domain) - see public/soundtracks/CREDITS.txt.
// Each list plays its tracks one after another and starts over at the end.
const MENU_TRACKS = [
  "/soundtracks/lofi-2-am-debug-loop.mp3",
  "/soundtracks/lofi-cursor-after-midnight.mp3",
];
const PLAY_TRACKS = [
  "/soundtracks/lofi-pixel-quest-save-point.mp3",
  "/soundtracks/lofi-rain-off-the-neon-signs.mp3",
];

export function BackgroundMusic() {
  const menuRef = useRef<HTMLAudioElement>(null);
  const playRef = useRef<HTMLAudioElement>(null);
  const menuIndex = useRef(0);
  const playIndex = useRef(0);
  const { volume } = useAudio();
  const { pathname } = useLocation();
  const isPlayPage = /^\/play(?:\/|$)/i.test(pathname);

  // Keep both players at the current volume whenever it changes.
  useEffect(() => {
    if (menuRef.current) menuRef.current.volume = volume;
    if (playRef.current) playRef.current.volume = volume;
  }, [volume]);

  // Swap which playlist plays based on the route.
  useEffect(() => {
    const active = isPlayPage ? playRef.current : menuRef.current;
    const inactive = isPlayPage ? menuRef.current : playRef.current;

    inactive?.pause();
    if (!active) return;

    const start = () => {
      void active.play().catch(() => {
        // Retry on user interaction if autoplay is blocked.
      });
    };

    start();
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);

    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      active.pause();
    };
  }, [isPlayPage]);

  // When a track ends, load the next one of the same list and keep playing.
  const next = (el: HTMLAudioElement | null, tracks: string[], index: { current: number }) => {
    if (!el) return;
    index.current = (index.current + 1) % tracks.length;
    el.src = tracks[index.current];
    void el.play().catch(() => {});
  };

  return (
    <>
      <audio
        ref={menuRef}
        src={MENU_TRACKS[0]}
        preload="auto"
        onEnded={() => next(menuRef.current, MENU_TRACKS, menuIndex)}
      />
      <audio
        ref={playRef}
        src={PLAY_TRACKS[0]}
        preload="none"
        onEnded={() => next(playRef.current, PLAY_TRACKS, playIndex)}
      />
    </>
  );
}
