// Offline unit tests for the ACCM confirmation mailer (Gmail SMTP via nodemailer). No network, no SMTP, no env reads:
// the transport, the service-role RPC and the logger are all mocked. Fake addresses only (example.test).
// Run: node --experimental-strip-types scripts/test-accm-confirm-mail.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const SRC = pathToFileURL(`${process.cwd()}/src/`).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, SRC).href, shortCircuit: true };
    if (specifier === "./access-request" && context.parentURL?.startsWith(SRC)) return { url: new URL("lib/members/access-request.ts", SRC).href, shortCircuit: true };
    return next(specifier, context);
  },
});
const M = await import("../src/lib/members/accm-confirm-mail.ts");
const AR = await import("../src/lib/members/access-request.ts");
const nodemailer = (await import("nodemailer")).default;

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
const read = (f) => fs.readFileSync(f, "utf8");
const TOKEN = "c0ffee".padEnd(64, "a");
const SITE = "https://gfx-society.vercel.app";
const CFG = { user: "sender@example.test", pass: "app-password-placeholder", from: "GFX Society <sender@example.test>" };

const harness = (o = {}) => {
  const logs = [], sent = [], issued = [];
  const deps = {
    config: "config" in o ? o.config : CFG,
    siteUrl: o.siteUrl ?? SITE,
    issueToken: async () => { issued.push(1); if (o.throwIssue) throw new Error("boom"); return "issue" in o ? o.issue : { email: "accm-user@example.test", token: TOKEN }; },
    send: async (msg) => { if (o.smtpFail) throw new Error(`smtp 535 for ${msg.to} ${TOKEN}`); sent.push(msg); },
    log: (code) => logs.push(code),
  };
  return { deps, logs, sent, issued };
};

// Capture every console channel too, to prove nothing leaks through a default logger.
const consoleOut = [];
for (const k of ["log", "error", "warn", "info", "debug"]) { const orig = console[k]; console[k] = (...a) => { consoleOut.push(a.map(String).join(" ")); if (k === "log") orig(...a); }; }

await t("readMailConfig: all 3 env vars required (blank = missing) -> null; no other env used", async () => {
  assert.deepEqual(M.readMailConfig({ GFX_SMTP_USER: "u@example.test", GFX_SMTP_APP_PASSWORD: "x", GFX_SMTP_FROM: "GFX <u@example.test>" }), { user: "u@example.test", pass: "x", from: "GFX <u@example.test>" });
  for (const drop of ["GFX_SMTP_USER", "GFX_SMTP_APP_PASSWORD", "GFX_SMTP_FROM"]) {
    const env = { GFX_SMTP_USER: "u@example.test", GFX_SMTP_APP_PASSWORD: "x", GFX_SMTP_FROM: "f" };
    delete env[drop]; assert.equal(M.readMailConfig(env), null, drop);
    env[drop] = "   "; assert.equal(M.readMailConfig(env), null, drop + " blank");
  }
});
await t("missing SMTP env fails closed BEFORE a token is issued (no send counted), neutral 'error'", async () => {
  const h = harness({ config: null });
  assert.equal(await M.sendAccmConfirm(h.deps), "error");
  assert.equal(h.issued.length, 0); assert.equal(h.sent.length, 0); assert.deepEqual(h.logs, ["smtp_env_missing"]);
});
await t("no awaiting request -> 'none', nothing sent; rate limited -> 'rate_limited', nothing sent", async () => {
  let h = harness({ issue: { error: "none" } });
  assert.equal(await M.sendAccmConfirm(h.deps), "none"); assert.equal(h.sent.length, 0);
  h = harness({ issue: { error: "rate_limited" } });
  assert.equal(await M.sendAccmConfirm(h.deps), "rate_limited"); assert.equal(h.sent.length, 0);
});
await t("RPC error / throw / bad shape -> 'error', nothing sent, fixed codes only", async () => {
  for (const [o, code] of [[{ issue: null }, "issue_failed"], [{ throwIssue: true }, "issue_failed"], [{ issue: { email: "a@example.test", token: "short" } }, "issue_bad_shape"],
                           [{ issue: { email: "a@example.test\r\nBcc: x@example.test", token: TOKEN } }, "issue_bad_shape"], [{ issue: { email: 5, token: TOKEN } }, "issue_bad_shape"]]) {
    const h = harness(o);
    assert.equal(await M.sendAccmConfirm(h.deps), "error"); assert.equal(h.sent.length, 0); assert.deepEqual(h.logs, [code]);
  }
});
await t("payload shape: from env, to = issued ACCM address, subject, text + html; link pinned to SITE_URL with #token", async () => {
  const h = harness({ siteUrl: SITE + "/" });
  assert.equal(await M.sendAccmConfirm(h.deps), "sent");
  assert.equal(h.sent.length, 1);
  const m = h.sent[0];
  assert.deepEqual(Object.keys(m).sort(), ["from", "html", "subject", "text", "to"]);
  assert.equal(m.from, CFG.from); assert.equal(m.to, "accm-user@example.test");
  assert.equal(m.subject, M.ACCM_CONFIRM_MAIL_COPY.subject);
  const link = `${SITE}/system/join/confirm#token=${TOKEN}`;
  assert.ok(m.text.includes(link) && m.html.includes(`href="${link}"`));
  const links = [...(m.text + m.html).matchAll(/https?:\/\/[^\s"<]+/g)].map((x) => x[0]);
  assert.ok(links.length >= 2 && links.every((l) => l === link), "every link is the pinned one");
  assert.ok(!m.text.includes("?token=") && !m.html.includes("?token="), "token never in a query string");
  assert.ok(m.html.startsWith("<!doctype html>") && !/<script/i.test(m.html));
  assert.deepEqual(h.logs, []);
});
await t("link host comes only from siteUrl (no request-derived host)", async () => {
  const h = harness({ siteUrl: "https://example.test" });
  await M.sendAccmConfirm(h.deps);
  assert.ok(h.sent[0].text.includes(`https://example.test/system/join/confirm#token=${TOKEN}`));
  const src = read("src/lib/members/accm-confirm-send.ts");
  assert.match(src, /siteUrl: SITE_URL/);
  assert.ok(!/headers\(|x-forwarded|host/i.test(src.replace(/smtp\.gmail\.com|GMAIL_SMTP|\bhosted\b/g, "")), "no request host read");
});
await t("SMTP failure -> neutral 'error', the error (with address/token) is never logged", async () => {
  const h = harness({ smtpFail: true });
  assert.equal(await M.sendAccmConfirm(h.deps), "error"); assert.deepEqual(h.logs, ["smtp_send_failed"]);
});
await t("token and address never returned or logged (results are fixed strings; default logger too)", async () => {
  const results = [];
  for (const o of [{}, { smtpFail: true }, { config: null }, { issue: null }, { issue: { error: "none" } }]) {
    const h = harness(o); delete h.deps.log; results.push(await M.sendAccmConfirm(h.deps));
  }
  for (const r of results) assert.ok(["sent", "none", "rate_limited", "error"].includes(r));
  const all = consoleOut.join("\n");
  assert.ok(!all.includes(TOKEN) && !all.includes("accm-user@example.test") && !all.includes(CFG.pass), "nothing sensitive on any console channel");
});
await t("email copy: Taglish + EN, ignore-if-not-you, 24 h single use, no VIP/PDE/profit claims", async () => {
  const { text, html } = M.buildAccmConfirmEmail(`${SITE}/system/join/confirm#token=${TOKEN}`);
  assert.match(text, /Kung hindi ikaw ang nag-request, i-ignore/); assert.match(text, /If this wasn't you, just ignore/);
  assert.match(text, /24 hours/); assert.match(text, /Academy account na nag-request/);
  for (const bad of [/\bVIP\b/i, /\bPDE\b/i, /profit|kita ka|guarantee|win rate|libreng bot|free bot/i]) assert.ok(!bad.test(text + html), String(bad));
  assert.ok(!/accm-user@example\.test/.test(text + html), "body never names the address");
});
await t("mock nodemailer transport: Gmail 465 TLS options + sendMail gets exactly the built message", async () => {
  // Same transport options the wiring uses, with nodemailer's offline JSON transport standing in for SMTP.
  assert.deepEqual(M.GMAIL_SMTP, { host: "smtp.gmail.com", port: 465, secure: true });
  const src = read("src/lib/members/accm-confirm-send.ts");
  assert.match(src, /nodemailer\.createTransport\(\{ \.\.\.GMAIL_SMTP, auth: \{ user: config!\.user, pass: config!\.pass \} \}\)/);
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const h = harness();
  h.deps.send = async (msg) => { const info = await transport.sendMail(msg); h.sent.push(JSON.parse(info.message)); };
  assert.equal(await M.sendAccmConfirm(h.deps), "sent");
  const j = h.sent[0];
  assert.equal(j.to[0].address, "accm-user@example.test"); assert.equal(j.from.address, "sender@example.test");
  assert.ok(j.text.includes(`#token=${TOKEN}`) && j.html.includes(`#token=${TOKEN}`));
});
await t("flag off (default): wiring returns before any env read / token / send; request action passes no sendConfirm", async () => {
  assert.equal(AR.ACCM_CONFIRM_MAIL_LIVE, false);
  const src = read("src/lib/members/accm-confirm-send.ts");
  const body = src.slice(src.indexOf("export async function sendAccmConfirmForUser"));
  assert.ok(body.indexOf("if (!ACCM_CONFIRM_MAIL_LIVE) return") < body.indexOf("process.env"), "flag check before env read");
  const a = read("src/app/system/join/actions.ts");
  assert.match(a, /\.\.\.\(ACCM_CONFIRM_MAIL_LIVE && user\s*\? \{ sendConfirm: async \(\) => \(await sendAccmConfirmForUser\(user\.id\)\) === "sent" \}\s*: \{\}\)/);
  assert.ok(!/formData\.get\("(user_id|uid|email)"\)/.test(a), "no client-supplied user id or email");
});
await t("request flow: flag off ignores ACCM email + never mails; flag on mails once on awaiting", async () => {
  const mk = (rpc, send = "ok") => { const log = []; return { log, deps: { loggedIn: async () => true, submit: async (accm) => { log.push(["rpc", accm]); return rpc; }, sendConfirm: async () => { log.push("send"); return send === "ok"; } } }; };
  const input = { accmEmail: "accm-user@example.test", ibName: "", consent: true };
  let h = mk("pending");
  assert.equal(await AR.submitRequest(h.deps, input, "me@example.test", false), "pending");
  assert.deepEqual(h.log, [["rpc", null]], "flag off: ACCM email dropped, no send");
  h = mk("awaiting_email_confirm");
  assert.equal(await AR.submitRequest(h.deps, input, "me@example.test", true), "awaiting_email_confirm");
  assert.deepEqual(h.log, [["rpc", "accm-user@example.test"], "send"]);
  h = mk("awaiting_email_confirm", "fail");
  assert.equal(await AR.submitRequest(h.deps, input, "me@example.test", true), "error", "send failure -> neutral error, no 'we sent' copy");
  h = mk("accm_email_disabled");
  assert.equal(await AR.submitRequest(h.deps, input, "me@example.test", true), "error", "DB switch off -> neutral error");
});
await t("join form shows the ACCM field and helper only behind the flag; spec pending-confirmation copy present", async () => {
  const f = read("src/app/system/join/join-form.tsx");
  assert.match(f, /\{ACCM_CONFIRM_MAIL_LIVE && \(/);
  const { REQUEST_COPY } = await import("../src/content/access-request.ts");
  assert.equal(REQUEST_COPY.submittedAwaiting, "Halos tapos na. I-click ang confirmation link na pinadala namin sa ACCM email mo (check din ang Spam o Promotions). Iche-check lang namin ang request pag na-confirm na ito.");
  assert.equal(REQUEST_COPY.accmEmailHelper, "Kailangan naming i-confirm ang email na ito, kaya may ipapadala kaming link.");
});
await t("privacy: v1.4 live while flag off; v1.5 only behind the flag and differs only in the v1.5 parts", async () => {
  const page = read("src/app/privacy/page.tsx");
  assert.match(page, /ACCM_CONFIRM_MAIL_LIVE \? "privacy-notice-v1\.5\.md" : "privacy-notice\.md"/);
  const v14 = read("src/content/legal/privacy-notice.md"), v15 = read("src/content/legal/privacy-notice-v1.5.md");
  assert.match(v14, /Version: 1\.4/); assert.ok(!/ACCM email \(kung binigay\)|Different ACCM email/.test(v14));
  assert.match(v15, /Version: 1\.5/); assert.match(v15, /\*\*What changed in v1\.5 \(11 Nov 2026\):\*\*/);
  assert.ok(v15.includes("Kung mag-request ka ng access, sine-save namin ang Academy email mo, ACCM email (kung binigay), at IB name (kung binigay)"));
  assert.ok(v15.includes("| Different ACCM email waiting for confirmation (plain email, private table) | Only until you click the confirmation link, then removed"));
  assert.ok(v15.includes("hashed Academy email, hashed ACCM email if given, IB name if given"));
  assert.match(v15, /\| Google LLC \(Gmail\) \|/);
  // Drift guard: removing the v1.5-only lines from v1.5 and the replaced lines from v1.4 leaves identical text.
  const a = v14.split("\n"), b = v15.split("\n");
  const v15only = (l) => /Version: 1\.5|What changed in v1\.5|^\| Google LLC \(Gmail\)|^\| Different ACCM email waiting|^- \*\*Access request \(optional\):\*\*|^\| Trading System access request/.test(l);
  const v14only = (l) => /Version: 1\.4|^- \*\*Access request \(optional\):\*\*|^\| Trading System access request/.test(l);
  assert.deepEqual(b.filter((l) => !v15only(l)).filter((l, i, arr) => !(l === "" && arr[i - 1] === "")), a.filter((l) => !v14only(l)).filter((l, i, arr) => !(l === "" && arr[i - 1] === "")));
});
await t("admin client comment names the new service-role use; issue RPC called only from the server wiring", async () => {
  assert.match(read("src/lib/supabase/admin.ts"), /issue_accm_confirm_token/);
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name) && read(p).includes('"issue_accm_confirm_token"')) hits.push(p); } };
  walk("src");
  assert.deepEqual(hits, ["src/lib/members/accm-confirm-send.ts"]);
  assert.ok(!/^"use client"/.test(read("src/lib/members/accm-confirm-send.ts")));
});

console.log(`ALL PASS accm confirm mail (${n})`);
