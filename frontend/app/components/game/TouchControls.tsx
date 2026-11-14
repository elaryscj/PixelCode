// app/components/game/TouchControls.tsx
// On-screen gamepad for phones and tablets. It writes into the same key map the keyboard uses,
// so the physics loop does not know (or care) whether input came from a finger or a key.
import { useCallback, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type Props = {
  /** The game's pressed-keys map (keysPressed.current). */
  keys: Record<string, boolean>;
  canInteract: boolean;
  onInteract: () => void;
  onRespawn: () => void;
};

function Pad({
  code,
  keys,
  label,
  className = "",
  children,
}: {
  code: string;
  keys: Record<string, boolean>;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const press = useCallback(
    (down: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      keys[code] = down;
      if (!down) return;
      try {
        // keep receiving "up" even if the thumb slides off the button
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone: the key still works, it just releases on the next up/cancel */
      }
      navigator.vibrate?.(8);
    },
    [code, keys],
  );
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={press(true)}
      onPointerUp={press(false)}
      onPointerCancel={press(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto touch-none select-none flex items-center justify-center border-2 bg-black/20 opacity-75 active:opacity-100 active:bg-white/20 active:scale-95 transition-transform ${className}`}
    >
      {children}
    </button>
  );
}

export default function TouchControls({ keys, canInteract, onInteract, onRespawn }: Props) {
  return (
    <div
      className="hidden pointer-coarse:flex fixed inset-x-0 bottom-0 z-40 justify-between items-end px-3 pointer-events-none font-pixel"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {/* left thumb: move */}
      <div className="flex gap-3">
        <Pad code="ArrowLeft" keys={keys} label="Move left" className="w-16 h-16 short:w-14 short:h-14 border-neon text-neon text-2xl">
          ◀
        </Pad>
        <Pad code="ArrowRight" keys={keys} label="Move right" className="w-16 h-16 short:w-14 short:h-14 border-neon text-neon text-2xl">
          ▶
        </Pad>
      </div>

      {/* right thumb: actions */}
      <div className="flex items-end gap-3">
        <button
          type="button"
          onClick={onRespawn}
          aria-label="Respawn"
          className="pointer-events-auto w-11 h-11 border-2 border-gray-500 text-gray-300 bg-black/45 text-sm active:scale-95"
        >
          R
        </button>
        {canInteract && (
          <button
            type="button"
            onClick={onInteract}
            aria-label="Open door"
            className="pointer-events-auto w-18 h-18 border-2 border-yellow bg-yellow/20 text-yellow text-xl animate-pulse active:scale-95"
          >
            OPEN
          </button>
        )}
        <Pad code="Space" keys={keys} label="Jump" className="w-20 h-20 short:w-18 short:h-18 rounded-full border-pink text-pink text-lg">
          JUMP
        </Pad>
      </div>
    </div>
  );
}
