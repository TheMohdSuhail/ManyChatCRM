export const STATUSES = [
  { value: "NEW", label: "New", color: "bg-blue-100 text-blue-800" },
  { value: "CONTACTED", label: "Contacted", color: "bg-amber-100 text-amber-800" },
  { value: "INTERESTED", label: "Interested", color: "bg-purple-100 text-purple-800" },
  { value: "FOLLOW_UP", label: "Follow-up", color: "bg-orange-100 text-orange-800" },
  { value: "CONVERTED", label: "Converted", color: "bg-green-100 text-green-800" },
  { value: "LOST", label: "Lost", color: "bg-gray-200 text-gray-700" },
] as const;

export type LeadStatus = (typeof STATUSES)[number]["value"];

export function isValidStatus(s: string): s is LeadStatus {
  return STATUSES.some((x) => x.value === s);
}

export function statusMeta(s: string) {
  return STATUSES.find((x) => x.value === s) ?? STATUSES[0];
}
