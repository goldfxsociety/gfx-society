// Offline tests: Academy signup with Supabase "Confirm email" ON or OFF, emailRedirectTo sanitization,
// and the /auth/callback redirect. No network, no Supabase.
// Run: node --experimental-strip-types scripts/test-signup-confirm.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { callbackRedirect, emailConfirmRedirect, siteOrigin } from "../src/lib/auth/safe-next.ts";
import { signupOutcome } from "../src/lib/auth/signup-outcome.ts";
import { SIGNUP_CONFIRM_COPY } from "../src/content/signup-confirm.ts";

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
const SITE = "https://gfx-society.vercel.app";
const friendly = (m) => `friendly:${m}`;

// ---- signUp outcome ----
await t("session returned (Confirm email OFF) -> logged in now, unchanged behavior", async () =>
  assert.deepEqual(signupOutcome({ hasSession: true, errorMessage: null }, friendly), { ok: true, needsEmailConfirmation: false }));
await t("no session (Confirm email ON) -> check-email state", async () =>
  assert.deepEqual(signupOutcome({ hasSession: false, errorMessage: null }, friendly), { ok: true, needsEmailConfirmation: true }));
await t("already registered -> same neutral check-email state (no account-existence leak)", async () => {
  for (const m of ["User already registered", "A user with this email address has already been registered", "Email already exists"])
    assert.deepEqual(signupOutcome({ hasSession: false, errorMessage: m }, friendly), { ok: true, needsEmailConfirmation: true }, m);
});
await t("other errors keep their friendly message", async () =>
  assert.deepEqual(signupOutcome({ hasSession: false, errorMessage: "Password should be at least 6 characters" }, friendly), { ok: false, error: "friendly:Password should be at least 6 characters" }));
await t("check-email copy is neutral (no 'we sent to <email>', no 'already exists')", async () => {
  const all = Object.values(SIGNUP_CONFIRM_COPY).join(" ");
  assert.ok(!/already exists|walang account|not registered/i.test(all));
  assert.match(SIGNUP_CONFIRM_COPY.body, /^Kung bago ang account/);
  const page = fs.readFileSync("src/app/signup/page.tsx", "utf8");
  assert.ok(!/sent a confirmation link to \{email\}/.test(page), "page no longer echoes the email in the check-email state");
  assert.ok(!fs.readFileSync("src/app/signup/actions.ts", "utf8").includes("already exists. Try logging in"), "no existence message");
});

// ---- emailRedirectTo ----
await t("own origin kept; path is /auth/callback with encoded safe next", async () => {
  assert.equal(emailConfirmRedirect(SITE, "/system/join", SITE), `${SITE}/auth/callback?next=%2Fsystem%2Fjoin`);
  assert.equal(emailConfirmRedirect("https://gfx-society-git-x-goldfx.vercel.app", "/system/join", SITE), "https://gfx-society-git-x-goldfx.vercel.app/auth/callback?next=%2Fsystem%2Fjoin");
  assert.equal(emailConfirmRedirect("http://localhost:3000", null, SITE), "http://localhost:3000/auth/callback?next=%2F%3Fwelcome%3Dnew");
});
await t("missing / unsafe next -> default /?welcome=new", async () => {
  for (const bad of [null, undefined, "", "https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/\u0000x", "evil", "/https:x"])
    assert.equal(emailConfirmRedirect(SITE, bad, SITE), `${SITE}/auth/callback?next=%2F%3Fwelcome%3Dnew`, String(bad));
});
await t("bad origin candidates -> SITE_URL fallback", async () => {
  for (const bad of [null, "", "null", "http://gfx-society.vercel.app", "https://u:p@evil.test", "https://evil.test/path", "https://evil.test?x=1", "ftp://x.test", "javascript:alert(1)", "not a url"])
    assert.equal(siteOrigin(bad, SITE), SITE, String(bad));
  assert.equal(siteOrigin("https://gfx-society.vercel.app/", SITE + "/"), SITE);
});
await t("signup action always passes emailRedirectTo built by emailConfirmRedirect (SITE_URL fallback)", async () => {
  const a = fs.readFileSync("src/app/signup/actions.ts", "utf8");
  assert.match(a, /emailConfirmRedirect\(candidateOrigin, input\.next, SITE_URL\)/);
  assert.match(a, /options: withCaptcha\(\{[\s\S]*?emailRedirectTo,/);
});

// ---- /auth/callback ----
const ok = async () => true, fail = async () => false;
await t("callback: code exchanged -> same-origin safe next", async () => {
  const seen = [];
  assert.equal(await callbackRedirect(`${SITE}/auth/callback?code=abc&next=%2Fsystem%2Fjoin`, async (c) => { seen.push(c); return true; }), `${SITE}/system/join`);
  assert.deepEqual(seen, ["abc"]);
  assert.equal(await callbackRedirect(`${SITE}/auth/callback?code=abc&next=%2F%3Fwelcome%3Dnew`, ok), `${SITE}/?welcome=new`);
});
await t("callback: unsafe next -> /dashboard (default), never off-site", async () => {
  for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)"])
    assert.equal(await callbackRedirect(`${SITE}/auth/callback?code=abc&next=${encodeURIComponent(bad)}`, ok), `${SITE}/dashboard`, bad);
  assert.equal(await callbackRedirect(`${SITE}/auth/callback?code=abc`, ok), `${SITE}/dashboard`);
});
await t("callback: missing code -> /login?error=missing_code (no exchange)", async () => {
  let called = false;
  assert.equal(await callbackRedirect(`${SITE}/auth/callback?next=%2Fsystem%2Fjoin`, async () => { called = true; return true; }), `${SITE}/login?error=missing_code`);
  assert.equal(called, false);
});
await t("callback: failed exchange -> /login?error=link_invalid", async () =>
  assert.equal(await callbackRedirect(`${SITE}/auth/callback?code=bad&next=%2Fsystem%2Fjoin`, fail), `${SITE}/login?error=link_invalid`));
await t("callback route delegates to callbackRedirect + exchangeCodeForSession", async () => {
  const r = fs.readFileSync("src/app/auth/callback/route.ts", "utf8");
  assert.match(r, /callbackRedirect\(request\.url/);
  assert.match(r, /exchangeCodeForSession\(code\)/);
});

console.log(`ALL PASS signup confirm (${n})`);
