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

/**
 * emailRedirectTo for signUp (QA F1): always NEXT_PUBLIC_SITE_URL's own /auth/callback (never the request
 * Origin/Host), carrying a safe relative `next` (unsafe or missing -> `fallbackNext`). The callback re-checks
 * `next` with safeNextPath. Supabase Auth still checks the final URL against its Redirect URLs allow list.
 */
export function emailConfirmRedirect(
  next: string | null | undefined,
  siteUrl: string,
  fallbackNext = "/?welcome=new",
): string {
  return `${siteUrl.replace(/\/+$/, "")}/auth/callback?next=${encodeURIComponent(safeNextPath(next, fallbackNext))}`;
}

/**
 * Where /auth/callback sends the browser. `exchange` = supabase.auth.exchangeCodeForSession; returns true on success.
 * Always same-origin: missing code / failed exchange -> /login with a neutral error, success -> safe `next`.
 */
export async function callbackRedirect(
  requestUrl: string,
  exchange: (code: string) => Promise<boolean>,
): Promise<string> {
  const { searchParams, origin } = new URL(requestUrl);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  if (!code) return `${origin}/login?error=missing_code`;
  if (!(await exchange(code))) return `${origin}/login?error=link_invalid`;
  return `${origin}${next}`;
}
