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
// Guard scanner: direct calls (auth.x( / auth?.x( / auth["x"]( , any whitespace) and destructuring
// (const { x } = supabase.auth, { x: alias } = ..., { auth: { x } } = supabase).
const CAPTCHA_METHODS = "signInWithOtp|signUp|signInWithPassword|resetPasswordForEmail|signInAnonymously|signInWithIdToken|resend";
function findAuthCalls(code) {
  const out = [];
  // Receivers: `auth` itself plus any alias of it (`const a = supabase.auth;`, `let a = (await c()).auth`).
  const aliases = [...code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*?\.\s*auth\b\s*(?=[;\n)]|$)/g)].map((m) => m[1]);
  const recv = ["auth", ...new Set(aliases)].map((r) => r.replace(/\$/g, "\\$")).join("|");
  // A call is `(`, or `.call(` / `.apply(` / `.bind(` on the method.
  const invoke = `\\s*(?:\\(|\\.\\s*(?:call|apply|bind)\\s*\\()`;
  for (const m of code.matchAll(new RegExp(`\\b(?:${recv})\\s*\\??\\.\\s*(${CAPTCHA_METHODS})${invoke}|\\b(?:${recv})\\s*\\??\\.?\\s*\\[\\s*["'\`](${CAPTCHA_METHODS})["'\`]\\s*\\]${invoke}`, "g"))) out.push(m[1] ?? m[2]);
  // Computed member on auth / an alias (`auth[m](...)`): can't be checked statically -> flagged as unsafe.
  out.push(...[...code.matchAll(new RegExp(`\\b(?:${recv})\\s*\\??\\.?\\s*\\[\\s*(?!["'\`](?:${CAPTCHA_METHODS})["'\`]\\s*\\])`, "g"))].map(() => "COMPUTED"));
  const destr = (body) => [...body.matchAll(new RegExp(`(?:^|[,{\\s])(${CAPTCHA_METHODS})\\s*(?=[,}:=\\s])`, "g"))].map((m) => m[1]);
  for (const m of code.matchAll(/\{([^{}]*)\}\s*=\s*[\w$.?\s()]*?\bauth\b\s*[;\n)]/g)) out.push(...destr(m[1]));
  for (const m of code.matchAll(/\bauth\s*:\s*\{([^{}]*)\}/g)) out.push(...destr(m[1]));
  return out;
}
t("guard scanner catches direct, optional, bracket, destructured, aliased, computed and .call/.apply/.bind auth calls", () => {
  const cases = {
    "await supabase.auth.signUp({ email })": ["signUp"],
    "await supabase.auth\n  .signInWithOtp({ email })": ["signInWithOtp"],
    "supabase.auth?.resend({ type: 'signup' })": ["resend"],
    "supabase.auth['resetPasswordForEmail'](e)": ["resetPasswordForEmail"],
    "const { signUp } = supabase.auth;\nawait signUp({ email });": ["signUp"],
    "const { signInWithOtp: sendCode, getUser } = client.auth\n": ["signInWithOtp"],
    "const {\n  resend,\n  signInAnonymously,\n} = (await createClient()).auth;": ["resend", "signInAnonymously"],
    "const { auth: { signInWithPassword } } = supabase;": ["signInWithPassword"],
    "const { data: { user } } = await supabase.auth.getUser();": [],
    "const { signUp } = props;": [],
    // QA #57 P3: alias, computed member, .call / .apply / .bind
    "const a = supabase.auth;\nawait a.signUp({ email });": ["signUp"],
    "const a = (await createClient()).auth\na?.signInWithOtp({ email })": ["signInWithOtp"],
    "const a = supabase.auth; a['resend']({})": ["resend"],
    "const m = 'signUp'; await supabase.auth[m]({ email });": ["COMPUTED"],
    "const a = supabase.auth; await a[m]({ email });": ["COMPUTED"],
    "supabase.auth.signInWithOtp.call(supabase.auth, { email })": ["signInWithOtp"],
    "supabase.auth.signUp.apply(supabase.auth, [{ email }])": ["signUp"],
    "const f = supabase.auth.resend.bind(supabase.auth); f({})": ["resend"],
    "const a = supabase.auth; a.signInWithPassword.call(a, {})": ["signInWithPassword"],
    "const a = supabase.auth; await a.getUser();": [],
    "const a = other.authority; a.signUp()": [],
  };
  for (const [code, want] of Object.entries(cases)) assert.deepEqual(findAuthCalls(code).sort(), want.sort(), code);
});
t("every Supabase Auth call that CAPTCHA checks goes through withCaptcha", () => {
  const files = { "src/app/system/join/actions.ts": /signInWithOtp\(\{[^}]*options: withCaptcha\(/s, "src/app/signup/actions.ts": /auth\.signUp\(\{[\s\S]*?options: withCaptcha\(/, "src/app/login/page.tsx": /withCaptcha\(undefined, captcha\.token\)[\s\S]*?signInWithPassword\(\{[\s\S]*?\.\.\.\(options \? \{ options \} : \{\}\)/ };
  for (const [f, re] of Object.entries(files)) assert.match(fs.readFileSync(f, "utf8"), re, f);
  // No other CAPTCHA-checked auth call exists (would need withCaptcha too).
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  const hits = walk("src").filter((f) => /\.tsx?$/.test(f)).flatMap((f) => findAuthCalls(fs.readFileSync(f, "utf8")).map((m) => `${f}:${m}`));
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
