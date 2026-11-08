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

const realError = console.error;
console.error = () => {};
const SHAPE_KEYS = [
  "configuredUrlMatchesExpectedProject",
  "originMatchesConfigured",
  "modernServerFamily",
  "hasWhitespace",
  "quotedOrPlaceholder",
  "outgoingApikeyEqualsConfigured",
  "authorizationAbsent",
  "independentAuthorization",
];

async function captureShape(run) {
  const lines = [];
  console.error = (...args) => lines.push(args);
  try {
    await run();
  } finally {
    console.error = () => {};
  }
  return lines.filter((args) => args[0] === "[system/join] reserve-shape");
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

const PROJECT = "https://hprbztlbvctlxmmnoigb.supabase.co";
const RESERVE = `${PROJECT}/rest/v1/rpc/member_code_reserve`;

function assertShape(payload, expected) {
  assert.deepEqual(Object.keys(payload).sort(), [...SHAPE_KEYS].sort());
  for (const value of Object.values(payload)) assert.equal(typeof value, "boolean");
  for (const [key, value] of Object.entries(expected)) assert.equal(payload[key], value, key);
}

await t("reserve-shape log is finite booleans and leaks neither sentinel nor query", async () => {
  const fetchImpl = createAdminRestFetch(PROJECT, SECRET, async () => new Response("ok", { status: 200 }));
  const lines = await captureShape(() =>
    fetchImpl(`${RESERVE}?email=leak@example.invalid&note=sb_secret_QUERY`, {
      method: "POST",
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
      body: '{"p_email":"leak@example.invalid"}',
    }),
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].length, 2);
  assertShape(lines[0][1], {
    configuredUrlMatchesExpectedProject: true,
    originMatchesConfigured: true,
    modernServerFamily: true,
    hasWhitespace: false,
    quotedOrPlaceholder: false,
    outgoingApikeyEqualsConfigured: true,
    authorizationAbsent: true,
    independentAuthorization: false,
  });
  const blob = JSON.stringify(lines);
  for (const secret of [SECRET, "leak@example.invalid", "sb_secret_QUERY", "hprbztlbvctlxmmnoigb", "supabase.co", "Bearer"]) {
    assert.equal(blob.includes(secret), false, secret);
  }
});

await t("configured host mismatch is a boolean and still strips only the fallback", async () => {
  const other = "https://other-project.supabase.co/rest/v1/rpc/member_code_reserve";
  let authorization;
  const fetchImpl = createAdminRestFetch("https://other-project.supabase.co", SECRET, async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    authorization = request.headers.get("authorization");
    return new Response("ok");
  });
  const lines = await captureShape(() =>
    fetchImpl(other, { method: "POST", headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } }),
  );
  assert.equal(authorization, null);
  assertShape(lines[0][1], {
    configuredUrlMatchesExpectedProject: false,
    originMatchesConfigured: true,
    modernServerFamily: true,
    hasWhitespace: false,
    quotedOrPlaceholder: false,
    outgoingApikeyEqualsConfigured: true,
    authorizationAbsent: true,
    independentAuthorization: false,
  });
});

await t("non-exact reserve paths stay silent", async () => {
  const fetchImpl = createAdminRestFetch(PROJECT, SECRET, async () => new Response("ok"));
  const targets = [
    `${PROJECT}/rest/v1/rpc/member_code_finish`,
    `${PROJECT}/rest/v1/rpc/member_code_reserve/`,
    `${PROJECT}/rest/v1/rpc/member_code_reserve_extra`,
    `${PROJECT}/rest/v1/admins`,
  ];
  const lines = await captureShape(async () => {
    for (const url of targets) {
      await fetchImpl(url, { method: "POST", headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
    }
  });
  assert.equal(lines.length, 0);
});

await t("binding flags are meaningful and do not echo the sentinel", async () => {
  const cases = [
    ["sb_secret_SYNTHETIC with space", { modernServerFamily: true, hasWhitespace: true, quotedOrPlaceholder: false, authorizationAbsent: true }],
    ['"sb_secret_QUOTED"', { modernServerFamily: false, hasWhitespace: false, quotedOrPlaceholder: true, authorizationAbsent: false }],
    ["$file:sentinel", { modernServerFamily: false, hasWhitespace: false, quotedOrPlaceholder: true, authorizationAbsent: false }],
    ["undefined", { modernServerFamily: false, hasWhitespace: false, quotedOrPlaceholder: true, authorizationAbsent: false }],
    ["null", { modernServerFamily: false, hasWhitespace: false, quotedOrPlaceholder: true, authorizationAbsent: false }],
    ["SUPABASE_SERVICE_ROLE_KEY", { modernServerFamily: false, hasWhitespace: false, quotedOrPlaceholder: true, authorizationAbsent: false }],
    ["process.env.SUPABASE_SERVICE_ROLE_KEY", { modernServerFamily: false, hasWhitespace: false, quotedOrPlaceholder: true, authorizationAbsent: false }],
  ];
  for (const [key, expected] of cases) {
    const fetchImpl = createAdminRestFetch(PROJECT, key, async () => new Response("ok"));
    const lines = await captureShape(() =>
      fetchImpl(RESERVE, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    );
    assert.equal(lines.length, 1);
    assertShape(lines[0][1], {
      ...expected,
      configuredUrlMatchesExpectedProject: true,
      originMatchesConfigured: true,
      outgoingApikeyEqualsConfigured: true,
      independentAuthorization: false,
    });
    assert.equal(JSON.stringify(lines).includes(key), false);
  }
});

await t("independent authorization is boolean-only and the response is unchanged", async () => {
  let seen;
  const fetchImpl = createAdminRestFetch(PROJECT, SECRET, async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    seen = {
      method: request.method,
      body: await request.clone().text(),
      apikey: request.headers.get("apikey"),
      authorization: request.headers.get("authorization"),
      cache: init && "cache" in init ? init.cache : undefined,
    };
    return new Response("body-kept", { status: 201 });
  });
  const lines = await captureShape(async () => {
    const response = await fetchImpl(RESERVE, {
      method: "POST",
      headers: { apikey: SECRET, Authorization: "Bearer user-session-jwt" },
      body: '{"p_ip":"203.0.113.10"}',
    });
    assert.equal(response.status, 201);
    assert.equal(await response.text(), "body-kept");
  });
  assert.equal(seen.method, "POST");
  assert.equal(seen.body, '{"p_ip":"203.0.113.10"}');
  assert.equal(seen.apikey, SECRET);
  assert.equal(seen.authorization, "Bearer user-session-jwt");
  assert.equal(seen.cache, "no-store");
  assertShape(lines[0][1], {
    configuredUrlMatchesExpectedProject: true,
    originMatchesConfigured: true,
    modernServerFamily: true,
    hasWhitespace: false,
    quotedOrPlaceholder: false,
    outgoingApikeyEqualsConfigured: true,
    authorizationAbsent: false,
    independentAuthorization: true,
  });
});

console.error = realError;
console.log(`ALL PASS admin rest fetch (${n})`);
