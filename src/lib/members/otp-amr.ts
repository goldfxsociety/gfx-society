/** True when the verified JWT `amr` contains method "otp" (Supabase POST /verify for email codes). */
export function sessionIsOtp(amr: unknown): boolean {
  return Array.isArray(amr) && amr.some((a) => typeof a === "object" && a !== null && (a as { method?: unknown }).method === "otp");
}
