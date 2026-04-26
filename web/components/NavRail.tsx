"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavRail({ counts }: { counts: { pipeline: number } }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const item = (label: string, href: string, badge?: string) => (
    <Link key={href} href={href} className={`rail-link ${isActive(href) ? "is-active" : ""}`}>
      <span>{label}</span>
      {badge && <span className="badge">{badge}</span>}
    </Link>
  );
  return (
    <nav className="rail">
      <div className="group"><h6>Workspace</h6></div>
      {item("Pipeline",     "/",         String(counts.pipeline))}
      {item("Evaluate URL", "/evaluate")}
      {item("Reports",      "/reports")}
    </nav>
  );
}
