/** GCash Ref No.: 13 digits, printed 4-3-6 ("1234 567 890123"). Soft check only; never blocks submit. */
export function normalizeGcashRef(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function isValidGcashRef(raw: string): boolean {
  return /^\d{13}$/.test(normalizeGcashRef(raw));
}

export function formatGcashRef(ref: string): string {
  return /^\d{13}$/.test(ref) ? `${ref.slice(0, 4)} ${ref.slice(4, 7)} ${ref.slice(7)}` : ref;
}
