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
 * The site's own origin for auth email links, e.g. "https://gfx-society.vercel.app". Accepts a candidate
 * (the request's Origin header) only when it is a bare http(s) origin (no path, query, credentials);
 * plain http only for localhost. Anything else -> `fallbackOrigin` (SITE_URL). Supabase Auth still checks
 * the final URL against its Redirect URLs allow list.
 */
export function siteOrigin(candidate: string | null | undefined, fallbackOrigin: string): string {
  if (candidate) {
    try {
      const u = new URL(candidate);
      const localHttp = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
      if ((u.protocol === "https:" || localHttp) && !u.username && !u.password && u.origin === candidate.replace(/\/$/, "")) {
        return u.origin;
      }
    } catch {
      /* fall through */
    }
  }
  return fallbackOrigin.replace(/\/$/, "");
}

/**
 * emailRedirectTo for signUp: always the site's own /auth/callback, carrying a safe relative `next`
 * (unsafe or missing -> `fallbackNext`). The callback re-checks `next` with safeNextPath.
 */
export function emailConfirmRedirect(
  candidateOrigin: string | null | undefined,
  next: string | null | undefined,
  fallbackOrigin: string,
  fallbackNext = "/?welcome=new",
): string {
  return `${siteOrigin(candidateOrigin, fallbackOrigin)}/auth/callback?next=${encodeURIComponent(safeNextPath(next, fallbackNext))}`;
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
