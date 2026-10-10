/**
 * Only allow same-site relative redirect targets (QA L3): must start with a
 * single "/", no "//" (protocol-relative), no backslashes, no scheme, no
 * control characters. Anything else falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(next)) return fallback;
  return next;
}
