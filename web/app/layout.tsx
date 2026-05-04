import "./globals.css";
import { Albert_Sans, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { Topbar } from "@/components/Topbar";
import { NavRail } from "@/components/NavRail";
import { CommandBar } from "@/components/CommandBar";
import { listApplications } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

// Inline theme bootstrap. Runs before React hydration and before first paint
// so the page renders in the correct mode immediately. The content is a
// fixed string literal — no untrusted input flows in, no XSS surface.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(_){}})();`;

const body    = Albert_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono    = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata = { title: "career-ops" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  fullIndex();
  const apps = listApplications({});
  const offers = apps.filter(a => a.status === "Offer").length;
  const scored = apps.filter(a => typeof a.score === "number") as Array<{ score: number }>;
  const avgScore = scored.length ? scored.reduce((s, a) => s + a.score, 0) / scored.length : 0;

  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        <div className="app">
          <Topbar
            session={`SF-${Date.now().toString().slice(-5)}`}
            evaluated={apps.length}
            offers={offers}
            avgScore={avgScore}
          />
          <NavRail counts={{ pipeline: apps.length }} />
          <main>{children}</main>
          <CommandBar />
        </div>
      </body>
    </html>
  );
}
