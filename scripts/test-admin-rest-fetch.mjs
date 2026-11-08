// Synthetic-key tests for the admin REST fetch adapter. No network and no real secrets.
// node --experimental-strip-types scripts/test-admin-rest-fetch.mjs
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createAdminRestFetch, isModernServerSecret } from "../src/lib/supabase/admin-fetch.ts";

const ORIGIN = "https://project.example.test";
const SECRET = "sb_secret_SYNTHETIC_NOT_A_REAL_KEY";
const PUBLISHABLE = "sb_publishable_SYNTHETIC_NOT_A_REAL_KEY";
const LEGACY = "eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.synthetic";
const FALLBACK = `Bearer ${SECRET}`;
const REST = `${ORIGIN}/rest/v1/rpc/member_code_reserve`;

function harness(key = SECRET) {
  const calls = [];
  const fetchImpl = createAdminRestFetch(ORIGIN, key, async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const headers = {};
    request.headers.forEach((value, name) => {
      headers[name] = value;
    });
    calls.push({
      url: request.url,
      method: request.method,
      headers,
      cache: init && "cache" in init ? init.cache : undefined,
      body: await request.clone().text(),
    });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  });
  return { fetchImpl, calls };
}

let n = 0;
const t = async (name, fn) => {
  await fn();
  n++;
  console.log("PASS", name);
};

assert.equal(isModernServerSecret(SECRET), true);
assert.equal(isModernServerSecret(PUBLISHABLE), false);
assert.equal(isModernServerSecret(LEGACY), false);
assert.equal(isModernServerSecret("sb_secret"), false);

await t("Headers instance: strips only the exact modern fallback bearer and keeps apikey", async () => {
  const { fetchImpl, calls } = harness();
  const headers = new Headers();
  headers.set("apikey", SECRET);
  headers.set("Authorization", FALLBACK);
  await fetchImpl(REST, { method: "POST", headers, body: '{"p_email":"a@b.c"}' });
  assert.equal(calls[0].headers.apikey, SECRET);
  assert.equal("authorization" in calls[0].headers, false);
  assert.equal(calls[0].cache, "no-store");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body, '{"p_email":"a@b.c"}');
  assert.equal(headers.get("authorization"), FALLBACK);
});

await t("plain object and lowercase header name", async () => {
  const { fetchImpl, calls } = harness();
  await fetchImpl(REST, { method: "POST", headers: { apikey: SECRET, authorization: FALLBACK } });
  assert.equal(calls[0].headers.apikey, SECRET);
  assert.equal("authorization" in calls[0].headers, false);
});

await t("header tuples", async () => {
  const { fetchImpl, calls } = harness();
  await fetchImpl(REST, { method: "POST", headers: [["apikey", SECRET], ["Authorization", FALLBACK]] });
  assert.equal(calls[0].headers.apikey, SECRET);
  assert.equal("authorization" in calls[0].headers, false);
});

await t("exact equality keeps a different bearer, a lowercase scheme, and a combined value", async () => {
  for (const authorization of ["Bearer user-session-jwt", `bearer ${SECRET}`, `${FALLBACK}, Bearer other`]) {
    const { fetchImpl, calls } = harness();
    await fetchImpl(REST, { method: "POST", headers: { apikey: SECRET, authorization } });
    assert.equal(calls[0].headers.authorization, authorization, authorization);
    assert.equal(calls[0].headers.apikey, SECRET);
  }
});

await t("Fetch header normalization trims trailing whitespace before the exact compare", async () => {
  const { fetchImpl, calls } = harness();
  await fetchImpl(REST, { method: "POST", headers: { apikey: SECRET, Authorization: `${FALLBACK} ` } });
  assert.equal("authorization" in calls[0].headers, false);
  assert.equal(calls[0].headers.apikey, SECRET);
});

await t("legacy JWT key is not stripped even when Authorization is Bearer plus that key", async () => {
  const { fetchImpl, calls } = harness(LEGACY);
  await fetchImpl(REST, { method: "POST", headers: { apikey: LEGACY, Authorization: `Bearer ${LEGACY}` } });
  assert.equal(calls[0].headers.authorization, `Bearer ${LEGACY}`);
  assert.equal(calls[0].headers.apikey, LEGACY);
});

await t("publishable key is not treated as a server secret", async () => {
  const { fetchImpl, calls } = harness(PUBLISHABLE);
  await fetchImpl(REST, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}` },
  });
  assert.equal(calls[0].headers.authorization, `Bearer ${PUBLISHABLE}`);
});

await t("other origins and non-REST paths keep the fallback bearer", async () => {
  const { fetchImpl, calls } = harness();
  await fetchImpl("https://other.example.test/rest/v1/rpc/member_code_reserve", {
    method: "POST",
    headers: { Authorization: FALLBACK, apikey: SECRET },
  });
  await fetchImpl(`${ORIGIN}/auth/v1/token`, { method: "POST", headers: { Authorization: FALLBACK, apikey: SECRET } });
  await fetchImpl(`${ORIGIN}/storage/v1/object/receipts`, { method: "GET", headers: { Authorization: FALLBACK } });
  assert.equal(calls[0].headers.authorization, FALLBACK);
  assert.equal(calls[1].headers.authorization, FALLBACK);
  assert.equal(calls[2].headers.authorization, FALLBACK);
});

await t("Request plus init: init headers replace the request headers", async () => {
  const { fetchImpl, calls } = harness();
  const original = new Request(REST, { method: "POST", headers: { Authorization: FALLBACK, apikey: SECRET } });
  await fetchImpl(original, { headers: { Authorization: "Bearer user-session-jwt", apikey: SECRET } });
  assert.equal(calls[0].headers.authorization, "Bearer user-session-jwt");
  assert.equal(calls[0].headers.apikey, SECRET);
  assert.equal(original.headers.get("authorization"), FALLBACK);
});

await t("Request without init headers keeps a legitimate bearer and still forces no-store", async () => {
  const { fetchImpl, calls } = harness();
  const original = new Request(`${ORIGIN}/rest/v1/rpc/member_code_finish`, {
    method: "POST",
    headers: { Authorization: "Bearer user-session-jwt", apikey: SECRET },
    cache: "force-cache",
  });
  await fetchImpl(original);
  assert.equal(calls[0].headers.authorization, "Bearer user-session-jwt");
  assert.equal(calls[0].headers.apikey, SECRET);
  assert.equal(calls[0].cache, "no-store");
});

await t("Request whose init replaces Authorization with the fallback is stripped", async () => {
  const { fetchImpl, calls } = harness();
  const original = new Request(REST, { headers: { Authorization: "Bearer user-session-jwt", apikey: "other" } });
  await fetchImpl(original, { method: "POST", headers: { Authorization: FALLBACK, apikey: SECRET } });
  assert.equal("authorization" in calls[0].headers, false);
  assert.equal(calls[0].headers.apikey, SECRET);
  assert.equal(calls[0].method, "POST");
});

await t("supabase-js REST rpc through this adapter does not send the modern secret as Bearer", async () => {
  const seen = [];
  const client = createClient(ORIGIN, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: createAdminRestFetch(ORIGIN, SECRET, async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        seen.push({
          path: new URL(request.url).pathname,
          apikey: request.headers.get("apikey") === SECRET,
          authorization: request.headers.get("authorization"),
          cache: init && "cache" in init ? init.cache : undefined,
        });
        return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
      }),
    },
  });
  await client.rpc("member_code_reserve", { p_email: "synthetic@example.invalid", p_ip: "203.0.113.10" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].path, "/rest/v1/rpc/member_code_reserve");
  assert.equal(seen[0].apikey, true);
  assert.equal(seen[0].authorization, null);
  assert.equal(seen[0].cache, "no-store");
});

console.log(`ALL PASS admin rest fetch (${n})`);
