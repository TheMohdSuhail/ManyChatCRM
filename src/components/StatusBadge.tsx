import { statusMeta } from "@/lib/statuses";

export function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.color}`}>{m.label}</span>;
}
