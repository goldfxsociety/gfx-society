// Offline tests for the Academy-login membership path (11 Nov plan): /system/join consent action logic,
// membership + proxy gates without OTP AMR (incl. S8 delisted-owner access), and source guards.
// Run: node --experimental-strip-types scripts/test-members-consent.mjs   (Node >= 22.15, no network)
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

// Resolve "@/..." to src, "next/server" to its CJS entry, and swap @supabase/ssr for an in-memory fake.
const SRC = pathToFileURL(`${process.cwd()}/src/`).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@supabase/ssr") return { url: "gfx-mock:ssr", shortCircuit: true };
    if (specifier === "next/server") return next("next/server.js", context);
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, SRC).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "gfx-mock:ssr")
      return { format: "module", shortCircuit: true, source: "export const createServerClient = (...a) => globalThis.__gfxSupabase(...a);" };
    return next(url, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";

const { submitConsent } = await import("../src/lib/members/consent-flow.ts");
const { NextRequest, NextResponse } = await import("next/server.js");
const { trainingGate } = await import("../src/lib/training/proxy-gate.ts");
const { membersRedirect } = await import("../src/lib/members/proxy-gate.ts");

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
const read = (f) => fs.readFileSync(f, "utf8");

// ---- consent action logic ----
const mk = (o = {}) => {
  const log = [];
  return { log, deps: {
    loggedIn: async () => { log.push("user"); return o.loggedIn ?? true; },
    recordConsent: async () => { log.push("rpc"); return o.rpc === undefined ? "active" : o.rpc; },
  } };
};
await t("logged out -> login_required, no RPC (no allowlist lookup before login)", async () => {
  const m = mk({ loggedIn: false });
  assert.equal(await submitConsent(m.deps, true), "login_required");
  assert.deepEqual(m.log, ["user"]);
});
await t("no consent tick -> consent_required, no RPC", async () => {
  const m = mk();
  assert.equal(await submitConsent(m.deps, false), "consent_required");
  assert.ok(!m.log.includes("rpc"));
});
for (const r of ["active", "no_match", "unverified_email", "rate_limited"])
  await t(`RPC '${r}' -> '${r}'`, async () => assert.equal(await submitConsent(mk({ rpc: r }).deps, true), r));
await t("RPC 'none' (session gone) -> login_required", async () => assert.equal(await submitConsent(mk({ rpc: "none" }).deps, true), "login_required"));
await t("RPC error / unexpected -> generic error (no enumeration)", async () => {
  for (const r of [null, "matched", "", "weird"]) assert.equal(await submitConsent(mk({ rpc: r }).deps, true), "error", String(r));
});

// ---- proxy gates without OTP ----
// Fake Supabase: claims (no amr at all = password session), my_membership, my_payment_info, is_admin.
const fake = (o) => () => ({
  auth: { getClaims: async () => ({ data: o.sub ? { claims: { sub: o.sub, amr: [{ method: "password" }] } } : null }) },
  rpc: async (fn, args) => {
    (o.calls ??= []).push(fn);
    if (fn === "my_membership") return { data: o.membership ?? "none", error: null };
    if (fn === "my_payment_info") return { data: { state: o.owned?.includes(args.p_course_slug) ? "approved" : "not_member" }, error: null };
    if (fn === "is_admin") return { data: false, error: null };
    return { data: null, error: { code: "x" } };
  },
});
const gate = async (path, o) => {
  globalThis.__gfxSupabase = fake(o);
  const res = await trainingGate(new NextRequest(`https://gfx.test${path}`), NextResponse.next());
  if (!res) return "pass";
  const loc = res.headers.get("location");
  return loc ? `307 ${new URL(loc).pathname}${new URL(loc).search}` : `rewrite ${res.headers.get("x-middleware-rewrite") ?? ""}`;
};
const U = "11111111-1111-1111-1111-111111111111";
await t("training: logged out -> /login?next=/training", async () => assert.equal(await gate("/training", {}), "307 /login?next=%2Ftraining"));
await t("training: logged out lesson -> /login?next=<lesson>", async () => assert.equal(await gate("/courses/gold-strategy-basics/l1", {}), "307 /login?next=%2Fcourses%2Fgold-strategy-basics%2Fl1"));
await t("training: password session + active -> allowed (no OTP needed)", async () => assert.equal(await gate("/training", { sub: U, membership: "active" }), "pass"));
await t("training: password session + grace -> allowed", async () => assert.equal(await gate("/training", { sub: U, membership: "grace" }), "pass"));
await t("training: password session non-member -> /system/join (next=/training is the default, so omitted)", async () => assert.equal(await gate("/training", { sub: U }), "307 /system/join"));
await t("journey 1: non-member lesson deep link kept through /system/join?next=", async () => assert.equal(await gate("/courses/gold-strategy-basics/l1", { sub: U }), "307 /system/join?next=%2Fcourses%2Fgold-strategy-basics%2Fl1"));
await t("S8: delisted owner (password session) keeps bought lesson + capstone", async () => {
  assert.equal(await gate("/courses/gold-strategy-basics/l1", { sub: U, owned: ["gold-strategy-basics"] }), "pass");
  assert.equal(await gate("/courses/gold-strategy-basics/capstone", { sub: U, owned: ["gold-strategy-basics"] }), "pass");
});
await t("S8: owner path never opens /pay or /placement; unbought course -> /system/join", async () => {
  assert.equal(await gate("/courses/gold-strategy-basics/pay", { sub: U, owned: ["gold-strategy-basics"] }), "307 /system/join?next=%2Fcourses%2Fgold-strategy-basics%2Fpay");
  assert.equal(await gate("/courses/gold-strategy-basics/placement", { sub: U, owned: ["gold-strategy-basics"] }), "307 /system/join?next=%2Fcourses%2Fgold-strategy-basics%2Fplacement");
  assert.equal(await gate("/courses/gold-advanced-setups/l1", { sub: U, owned: ["gold-strategy-basics"] }), "307 /system/join?next=%2Fcourses%2Fgold-advanced-setups%2Fl1");
});
await t("legacy /system/members: member -> /training, non-member -> /system/join", async () => {
  assert.equal(await gate("/system/members", { sub: U, membership: "active" }), "307 /training");
  assert.equal(await gate("/system/members", { sub: U }), "307 /system/join");
});
await t("members proxy: password session member passes; logged out / non-member -> /system/join", async () => {
  const run = async (o) => { globalThis.__gfxSupabase = fake(o); return membersRedirect(new NextRequest("https://gfx.test/system/members/x"), NextResponse.next()); };
  assert.equal(await run({ sub: U, membership: "active" }), null);
  assert.equal(new URL((await run({ sub: U })).headers.get("location")).pathname, "/system/join");
  const o = {}; assert.equal(new URL((await run(o)).headers.get("location")).pathname, "/system/join");
  assert.ok(!(o.calls ?? []).includes("my_membership"), "logged out: no RPC");
});

// ---- source guards ----
await t("no OTP AMR gate left in app code", async () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  // captcha.ts only lists signInWithOtp in a doc comment (generic helper); it makes no auth call.
  const hits = walk("src").filter((f) => /\.tsx?$/.test(f) && (/sessionIsOtp|otp-amr|otp-flow|\bamr\b|verifyOtp/.test(read(f)) || (f !== "src/lib/auth/captcha.ts" && /signInWithOtp/.test(read(f)))));
  assert.deepEqual(hits, []);
  assert.ok(!fs.existsSync("src/lib/members/otp-amr.ts") && !fs.existsSync("src/lib/members/otp-flow.ts"));
});
await t("join action: user server client + record_member_consent only (no service role, no reserve)", async () => {
  const a = read("src/app/system/join/actions.ts");
  assert.match(a, /from "@\/lib\/supabase\/server"/);
  assert.match(a, /rpc\("record_member_consent", \{ p_version: MEMBERS_CONSENT_VERSION \}\)/);
  for (const bad of ["createAdminClient", "lib/supabase/admin", "member_code_", "SERVICE_ROLE", "signInWithOtp", "issue_accm_confirm_token"]) assert.ok(!a.includes(bad), bad);
  // headers() is used only to pass the client IP to submit_access_request (hashed in SQL for the 10/IP/24 h limit).
  assert.equal(a.match(/headers\(\)/g)?.length ?? 0, 1);
});
await t("join UI: no email field / code input; logged-out CTA to /login?next=/system/join", async () => {
  const ui = read("src/app/system/join/page.tsx") + read("src/app/system/join/join-form.tsx");
  // Only the optional ACCM email (request form, behind ACCM_CONFIRM_MAIL_LIVE) is an email input; never on the logged-out screen.
  assert.ok(!/name="email"|name="code"|one-time-code/.test(ui));
  assert.ok(!read("src/app/system/join/page.tsx").includes('type="email"'));
  assert.match(read("src/lib/members/routes.ts"), /JOIN_LOGIN_PATH = "\/login\?next=%2Fsystem%2Fjoin"/);
  assert.match(read("src/app/system/join/page.tsx"), /href=\{joinLoginPath\(next\)\}/);
});
await t("consent version unchanged and matches SQL", async () => {
  assert.match(read("src/content/members-gate.ts"), /MEMBERS_CONSENT_VERSION = "join-v2"/);
  assert.match(read("supabase/migrations/20261111000000_academy_login_membership.sql"), /p_version is distinct from 'join-v2'/);
});
await t("copy rules: no VIP / PDE / income or win-rate claims / free bot / demo first", async () => {
  const copy = read("src/content/members-gate.ts") + read("src/content/signup-confirm.ts");
  for (const re of [/\bVIP\b/i, /\bPDE\b/, /win[- ]?rate/i, /\bprofit/i, /\bincome\b/i, /free bot/i, /demo first/i, /guarantee/i]) assert.ok(!re.test(copy), String(re));
  const page = read("src/app/system/join/page.tsx");
  assert.equal(page.match(/SYSTEM_COPY\.risk/g)?.length, 1, "risk line once");
  assert.equal(page.match(/IB_DISCLOSURE_TEXT\}/g)?.length, 1, "IB disclosure once");
});

console.log(`ALL PASS members consent (${n})`);
