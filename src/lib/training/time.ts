/** "Nov 3, 3:30 PM PHT" (spec §0.5). */
export function formatPht(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  return `${s} PHT`;
}
