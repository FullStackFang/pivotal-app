import { ScanTabs } from "@/components/ScanTabs";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="scan-page">
      <ScanTabs />
      {children}
    </div>
  );
}
