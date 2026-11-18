// app/components/JoinQr.tsx — QR code of a lesson's join link (drawn in the browser, no outside service).
// Students scan it with the phone camera and land on /lesson/CODE with the code already filled in.
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function JoinQr({ url, className = "" }: { url: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // dark modules on white with a quiet zone: phone cameras read that best, also from a projector
    QRCode.toDataURL(url, { margin: 2, width: 720, errorCorrectionLevel: "M", color: { dark: "#050814", light: "#ffffff" } })
      .then((s) => alive && setSrc(s))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!src) return <div className={`bg-white/10 ${className}`} />;
  return <img src={src} alt={url} className={`bg-white [image-rendering:pixelated] ${className}`} />;
}
