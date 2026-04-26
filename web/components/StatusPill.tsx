import type { CanonicalStatus } from "@/lib/types";

const VARIANT: Record<string, string> = {
  Evaluated: "s-eval",
  Applied: "s-applied",
  Interview: "s-interview",
  Offer: "s-offer",
  Rejected: "s-rejected",
  Discarded: "s-skip",
  SKIP: "s-skip",
  Responded: "s-applied",
};

export function StatusPill({ status }: { status: CanonicalStatus | string }) {
  const v = VARIANT[status] ?? "s-eval";
  return <span className={`status ${v}`}>{status}</span>;
}
