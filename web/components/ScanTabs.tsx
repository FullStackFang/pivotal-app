"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/scan", label: "Scan" },
  { href: "/scan/portals", label: "Portals" },
];

export function ScanTabs() {
  const path = usePathname();
  return (
    <nav className="scan-tabs">
      {TABS.map(t => {
        const active = path === t.href || (t.href !== "/scan" && path?.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`scan-tab ${active ? "is-active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
