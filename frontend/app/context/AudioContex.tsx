import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AudioCtx = { volume: number; setVolume: (v: number) => void };

const Ctx = createContext<AudioCtx | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  // Start at a constant default so server and client render the same thing.
  const [volume, setVolumeState] = useState<number>(0.8);

  // Load the saved value AFTER mount — client-only, so no localStorage on the server.
  useEffect(() => {
    const stored = localStorage.getItem("musicVolume");
    if (stored !== null) setVolumeState(Number(stored));
  }, []);

  // Persist on user change only (not in an effect, to avoid clobbering the loaded value).
  const setVolume = (v: number) => {
    setVolumeState(v);
    localStorage.setItem("musicVolume", String(v));
  };

  return <Ctx.Provider value={{ volume, setVolume }}>{children}</Ctx.Provider>;
}

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}