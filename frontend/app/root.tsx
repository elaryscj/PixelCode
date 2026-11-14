import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./app.css";
import { BackgroundMusic } from "./components/BackgroundMusic";
import "./language-config/languages";


export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Restore after hydration so the server and initial client markup agree.
    try {
      const saved = localStorage.getItem("pixelcodeLanguage");
      if (saved === "en" || saved === "kz") void i18n.changeLanguage(saved);
    } catch {
      // Language switching still works when browser storage is unavailable.
    }

    const saveLanguage = (language: string) => {
      try {
        localStorage.setItem("pixelcodeLanguage", language);
      } catch {
        // Keep the selection for this session if storage is unavailable.
      }
    };
    i18n.on("languageChanged", saveLanguage);
    return () => { i18n.off("languageChanged", saveLanguage); };
  }, [i18n]);
  return (
    <html lang={i18n.resolvedLanguage === "kz" ? "kk-Latn" : "en"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#060814" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PixelCode" />
        <meta property="og:title" content="PixelCode Arena" />
        <meta property="og:description" content="Real-time 1v1 coding duels. Race, crack the code doors, climb the ranks." />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-dvh flex-col">
        <main className="flex flex-1 flex-col justify-center">
          {children}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { AudioProvider } from "./context/AudioContex";

export default function App() {
  return (
    <AudioProvider>
      <BackgroundMusic />
      <Outlet />
      <div className="crt-overlay" aria-hidden />
    </AudioProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();
  let message = t("oops");
  let details = t("unexpected_error");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : t("error");
    details =
      error.status === 404
        ? t("requested_page_not_found")
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
