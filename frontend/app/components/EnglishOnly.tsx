// app/components/EnglishOnly.tsx
// Screens that are not translated yet are English text. In Arabic / Urdu the page runs right-to-left, which
// scrambles English punctuation and numbers ("04 / 01", ".the end") and right-aligns it. Wrapping such a screen
// keeps it left-to-right English until it gets translations; then the wrapper is simply removed.
import type { ReactNode } from "react";

export default function EnglishOnly({ children }: { children: ReactNode }) {
  return (
    <div dir="ltr" lang="en" className="contents">
      {children}
    </div>
  );
}
