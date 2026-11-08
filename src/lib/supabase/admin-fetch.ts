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
const RESERVE_PATH = "/rest/v1/rpc/member_code_reserve";
const EXPECTED_PROJECT_HOST = "hprbztlbvctlxmmnoigb.supabase.co";
const PLACEHOLDERS = new Set([
  "undefined",
  "null",
  "SUPABASE_SERVICE_ROLE_KEY",
  "process.env.SUPABASE_SERVICE_ROLE_KEY",
]);

export function isModernServerSecret(key: string): boolean {
  return key.startsWith(MODERN_SERVER_SECRET_PREFIX);
}

function quotedOrPlaceholder(key: string): boolean {
  const quoted =
    (key.startsWith('"') && key.endsWith('"') && key.length >= 2) ||
    (key.startsWith("'") && key.endsWith("'") && key.length >= 2);
  return quoted || key.startsWith("$file:") || PLACEHOLDERS.has(key);
}

/** Boolean shape of one reserve call. Values are never logged. */
function reserveShape(request: Request, supabaseUrl: string, serverKey: string) {
  let configuredUrlMatchesExpectedProject = false;
  let originMatchesConfigured = false;
  try {
    const configured = new URL(supabaseUrl);
    const target = new URL(request.url);
    configuredUrlMatchesExpectedProject = configured.hostname === EXPECTED_PROJECT_HOST;
    originMatchesConfigured = target.origin === configured.origin;
  } catch {
    configuredUrlMatchesExpectedProject = false;
    originMatchesConfigured = false;
  }
  const authorization = request.headers.get("authorization");
  return {
    configuredUrlMatchesExpectedProject,
    originMatchesConfigured,
    modernServerFamily: isModernServerSecret(serverKey),
    hasWhitespace: /\s/.test(serverKey),
    quotedOrPlaceholder: quotedOrPlaceholder(serverKey),
    outgoingApikeyEqualsConfigured: request.headers.get("apikey") === serverKey,
    authorizationAbsent: authorization === null,
    independentAuthorization: authorization !== null && authorization !== `Bearer ${serverKey}`,
  };
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
    if (new URL(request.url).pathname === RESERVE_PATH) {
      console.error("[system/join] reserve-shape", reserveShape(request, supabaseUrl, serverKey));
    }
    return baseFetch(request, { cache: "no-store" });
  };
}
