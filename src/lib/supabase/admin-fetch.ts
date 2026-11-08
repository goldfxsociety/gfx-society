/**
 * REST fetch for the server-only admin client.
 *
 * @supabase/supabase-js 2.117.3 documents that `sb_secret_` keys belong only in
 * `apikey` and must not be sent as Bearer tokens. That version applies
 * `omitApiKeyAsBearer` to the Functions client only. REST, including `.rpc()`,
 * still sets `Authorization: Bearer ${key}` when no user session exists.
 * There is no public client option that changes the REST path.
 *
 * This adapter removes that one fallback header. It does not treat
 * `sb_publishable_` keys as server secrets, and it leaves every other
 * Authorization value, legacy JWT key, origin, and non-REST path unchanged.
 */

const MODERN_SERVER_SECRET_PREFIX = "sb_secret_";

export function isModernServerSecret(key: string): boolean {
  return key.startsWith(MODERN_SERVER_SECRET_PREFIX);
}

function restPath(url: URL): boolean {
  return url.pathname === "/rest/v1" || url.pathname.startsWith("/rest/v1/");
}

export function createAdminRestFetch(
  supabaseUrl: string,
  serverKey: string,
  baseFetch: typeof fetch = globalThis.fetch,
): typeof fetch {
  const origin = new URL(supabaseUrl).origin;
  const fallbackBearer = `Bearer ${serverKey}`;
  const stripFallback = isModernServerSecret(serverKey);

  return (input, init) => {
    const request = new Request(input, init);
    if (stripFallback) {
      const url = new URL(request.url);
      if (url.origin === origin && restPath(url) && request.headers.get("authorization") === fallbackBearer) {
        request.headers.delete("authorization");
      }
    }
    return baseFetch(request, { cache: "no-store" });
  };
}
