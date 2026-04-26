import "./globals.css";
import { Albert_Sans, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { Topbar } from "@/components/Topbar";
import { NavRail } from "@/components/NavRail";
import { CommandBar } from "@/components/CommandBar";
import { listApplications } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

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
