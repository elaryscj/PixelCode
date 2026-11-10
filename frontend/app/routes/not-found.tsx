import { Link } from "react-router";

const NotFound = () => (
  <>
    <div className="grid-background" />
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 font-pixel px-6">
      <p className="text-neon text-xl">PIXELCODE ARENA / ROUTE ERROR</p>
      <div className="flex flex-wrap items-center justify-center gap-16">
        <div className="w-88 border border-neon/40 bg-[#0a0f24] p-8 flex flex-col items-center gap-5">
          <h2 className="text-pink text-4xl">BROKEN GATE</h2>
          <span className="border border-pink text-pink text-base px-6 py-1">CONNECTION LOST</span>
          <img src="/doors/door-locked.png" alt="" className="w-32 h-auto" style={{ imageRendering: "pixelated" }} />
          <span className="w-full h-1 bg-pink" />
          <p className="font-sans text-gray-300 text-sm text-center">Gate offline. No passage at this address.</p>
        </div>
        <div className="flex flex-col gap-6 max-w-xl">
          <h1 className="text-yellow text-[184px]/none text-glow-sm">404</h1>
          <h2 className="text-white text-[64px]/none">Page not found</h2>
          <p className="font-sans text-gray-400 text-lg">
            This door leads nowhere. The route is broken, but your arena is still waiting.
          </p>
          <Link to="/" className="self-start text-center px-16 py-3 bg-pink border-2 border-yellow text-black text-2xl">
            Back to Menu
          </Link>
          <p className="font-sans text-gray-500 text-sm">ERROR_CODE: ROUTE_NOT_FOUND</p>
        </div>
      </div>
    </div>
  </>
);

export default NotFound;
