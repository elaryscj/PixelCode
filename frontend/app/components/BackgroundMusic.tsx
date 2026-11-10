import { useRef, useEffect } from "react";
import { useLocation } from "react-router";
import { useAudio } from "../context/AudioContex";

export function BackgroundMusic() {
  const menuRef = useRef<HTMLAudioElement>(null);
  const playRef = useRef<HTMLAudioElement>(null);
  const { volume } = useAudio();
  const { pathname } = useLocation();
  const isPlayPage = /^\/play(?:\/|$)/i.test(pathname);

  // Keep both tracks at the current volume whenever it changes.
  useEffect(() => {
    if (menuRef.current) menuRef.current.volume = volume;
    if (playRef.current) playRef.current.volume = volume;
  }, [volume]);

  // Swap which track plays based on the route.
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

  return (
    <>
      <audio
        ref={menuRef}
        src="/soundtracks/pixelcode_menu_theme.mp3"
        loop
        preload="auto"
      />
      <audio
        ref={playRef}
        src="/soundtracks/pixelcode_play_theme.mp3"
        loop
        preload="auto"
      />
    </>
  );
}