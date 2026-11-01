// Offline tests for src/lib/auth/captcha.ts and every Supabase Auth call site that uses it.
// Run: node scripts/test-auth-captcha.mjs  (Node >= 22, type stripping)
import assert from "node:assert/strict";
import fs from "node:fs";
import { captchaBlocksSubmit, captchaReducer, cleanCaptchaToken, initialCaptchaState, isCaptchaError, withCaptcha, CAPTCHA_LOAD_ERROR } from "../src/lib/auth/captcha.ts";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("PASS", name); };
const on = () => { process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"; };
const off = () => { delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; };

// Each auth path, exactly as the call site builds its options.
const PATHS = {
  "members signInWithOtp (system/join/actions.ts)": (tok) => ({ email: "a@b.c", options: withCaptcha({ shouldCreateUser: true }, tok) }),
  "Academy signUp (signup/actions.ts)": (tok) => ({ email: "a@b.c", password: "pw", options: withCaptcha({ data: { consent_required: true }, emailRedirectTo: "https://x/auth/callback" }, tok) }),
  "signInWithPassword (login/page.tsx)": (tok) => { const options = withCaptcha(undefined, tok); return { email: "a@b.c", password: "pw", ...(options ? { options } : {}) }; },
};
const BEFORE = {
  "members signInWithOtp (system/join/actions.ts)": { email: "a@b.c", options: { shouldCreateUser: true } },
  "Academy signUp (signup/actions.ts)": { email: "a@b.c", password: "pw", options: { data: { consent_required: true }, emailRedirectTo: "https://x/auth/callback" } },
  "signInWithPassword (login/page.tsx)": { email: "a@b.c", password: "pw" },
};
for (const [name, build] of Object.entries(PATHS)) {
  t(`flag OFF: ${name} unchanged (even if a token is around)`, () => { off(); assert.equal(JSON.stringify(build("tok")), JSON.stringify(BEFORE[name])); });
  t(`flag ON: ${name} passes options.captchaToken`, () => { on(); assert.equal(build("tok-1").options.captchaToken, "tok-1"); off(); });
}
t("flag OFF: withCaptcha returns the same object (byte-for-byte)", () => { off(); const o = { a: 1 }; assert.equal(withCaptcha(o, "x"), o); assert.equal(withCaptcha(undefined, "x"), undefined); });
t("flag ON: missing/blank/oversized token -> no captchaToken added", () => { on(); for (const tok of ["", "  ", undefined, null, 5, "x".repeat(5000)]) assert.equal(withCaptcha({ a: 1 }, tok).captchaToken, undefined); assert.equal(cleanCaptchaToken(" t "), "t"); off(); });
t("isCaptchaError matches Supabase's message", () => { assert.ok(isCaptchaError("captcha verification process failed")); assert.ok(!isCaptchaError("Invalid login credentials")); });
t("every Supabase Auth call that CAPTCHA checks goes through withCaptcha", () => {
  const files = { "src/app/system/join/actions.ts": /signInWithOtp\(\{[^}]*options: withCaptcha\(/s, "src/app/signup/actions.ts": /auth\.signUp\(\{[\s\S]*?options: withCaptcha\(/, "src/app/login/page.tsx": /withCaptcha\(undefined, captcha\.token\)[\s\S]*?signInWithPassword\(\{[\s\S]*?\.\.\.\(options \? \{ options \} : \{\}\)/ };
  for (const [f, re] of Object.entries(files)) assert.match(fs.readFileSync(f, "utf8"), re, f);
  // No other CAPTCHA-checked auth call exists (would need withCaptcha too).
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  const hits = walk("src").filter((f) => /\.tsx?$/.test(f)).flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/auth\.(signInWithOtp|signUp|signInWithPassword|resetPasswordForEmail|signInAnonymously|signInWithIdToken|resend)\(/g)].map((m) => `${f}:${m[1]}`));
  assert.deepEqual(hits.sort(), ["src/app/login/page.tsx:signInWithPassword", "src/app/signup/actions.ts:signUp", "src/app/system/join/actions.ts:signInWithOtp"]);
});
// Browser state (Design spec): load failure -> error + disabled; late token -> recovers.
t("flag OFF: state 'off', submit never blocked", () => { off(); const s = initialCaptchaState(); assert.equal(s.status, "off"); assert.equal(captchaBlocksSubmit(s), false); assert.equal(captchaReducer(s, { type: "load-failed" }), s); });
t("flag ON: pending blocks submit until a token arrives", () => { on(); const s = initialCaptchaState(); assert.equal(s.status, "pending"); assert.ok(captchaBlocksSubmit(s)); off(); });
for (const type of ["load-failed", "error", "expired", "timeout"]) t(`flag ON: ${type} -> error shown, submit disabled`, () => { on(); const s = captchaReducer(initialCaptchaState(), { type }); assert.equal(s.status, "error"); assert.ok(captchaBlocksSubmit(s)); off(); });
t("flag ON: late token after an error -> recovers (error cleared, submit enabled)", () => { on(); let s = captchaReducer(initialCaptchaState(), { type: "load-failed" }); s = captchaReducer(s, { type: "token", token: "late" }); assert.deepEqual(s, { token: "late", status: "ok" }); assert.equal(captchaBlocksSubmit(s), false); off(); });
t("flag ON: timeout after a token is ignored", () => { on(); const s = captchaReducer(captchaReducer(initialCaptchaState(), { type: "token", token: "x" }), { type: "timeout" }); assert.equal(s.status, "ok"); off(); });
t("copy is Design's approved TL string", () => { assert.equal(CAPTCHA_LOAD_ERROR, "Hindi ma-load ang security check. I-refresh ang page o i-off muna ang ad blocker, tapos subukan ulit."); });
console.log(`ALL PASS (${n})`);
