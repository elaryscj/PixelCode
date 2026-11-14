// Shown for a split second while a browser-only screen mounts.
export default function ScreenLoading() {
  return (
    <div className="flex flex-1 min-h-[50vh] items-center justify-center font-pixel text-neon text-2xl">
      LOADING<span className="blink-caret">_</span>
    </div>
  );
}
