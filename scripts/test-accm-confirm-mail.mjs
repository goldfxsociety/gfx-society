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
    // Extensionless relative imports inside src/ (e.g. "./access-request", "./admin-fetch") resolve to the .ts file.
    if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/.test(specifier) && context.parentURL?.startsWith(SRC)) return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
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
  assert.equal(m.from, CFG.from); assert.deepEqual(m.to, { name: "", address: "accm-user@example.test" }, "Q5: to is an object with an empty name");
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
await t("Design-approved email copy (11 Nov): confirm button described, not quoted; standard education footer", async () => {
  const C = M.ACCM_CONFIRM_MAIL_COPY;
  assert.ok(C.tl[1].includes("pindutin ang confirm button."));
  assert.ok(C.en[1].includes("press the confirm button."));
  assert.ok(![...C.tl, ...C.en].some((l) => l.includes('"')), "no quoted button labels");
  assert.equal(C.footer, "GFX Society \u00b7 goldfx.society@gmail.com \u00b7 Education lang, not financial advice.");
  assert.ok(!JSON.stringify(C).includes("Jarvis") && !JSON.stringify(C).includes("Ben"), "no internal or founder names");
});

await t("mock nodemailer transport: Gmail 465 TLS options + sendMail gets exactly the built message", async () => {
  // Same transport options the wiring uses, with nodemailer's offline JSON transport standing in for SMTP.
  assert.deepEqual(M.GMAIL_SMTP, { host: "smtp.gmail.com", port: 465, secure: true });
  const src = read("src/lib/members/accm-confirm-send.ts");
  assert.match(src, /nodemailer\.createTransport\(\{ \.\.\.GMAIL_SMTP, \.\.\.SMTP_TIMEOUTS, auth: \{ user: config!\.user, pass: config!\.pass \} \}\)/);
  const transport = nodemailer.createTransport({ jsonTransport: true, ...M.SMTP_TIMEOUTS });
  const h = harness();
  h.deps.send = async (msg) => { const info = await transport.sendMail(msg); h.sent.push(JSON.parse(info.message)); };
  assert.equal(await M.sendAccmConfirm(h.deps), "sent");
  const j = h.sent[0];
  assert.deepEqual(j.to, [{ address: "accm-user@example.test", name: "" }]); assert.equal(j.from.address, "sender@example.test");
  assert.ok(j.text.includes(`#token=${TOKEN}`) && j.html.includes(`#token=${TOKEN}`));
});
await t("go-live: flag is true; rollback guard (flag false) still returns before any env read / token / send", async () => {
  assert.equal(AR.ACCM_CONFIRM_MAIL_LIVE, true);
  const src = read("src/lib/members/accm-confirm-send.ts");
  const body = src.slice(src.indexOf("export async function sendAccmConfirmForUser"));
  assert.ok(body.indexOf("if (!ACCM_CONFIRM_MAIL_LIVE) return") < body.indexOf("process.env"), "flag check before env read");
  const a = read("src/app/system/join/actions.ts");
  assert.match(a, /\.\.\.\(ACCM_CONFIRM_MAIL_LIVE && user\s*\? \{ sendConfirm: async \(\) => \(await sendAccmConfirmForUser\(user\.id\)\) === "sent" \}\s*: \{\}\)/);
  assert.ok(!/formData\.get\("(user_id|uid|email)"\)/.test(a), "no client-supplied user id or email");
});
await t("live wiring (real server path, env scrubbed in this process): missing SMTP env fails closed + neutral, no token, no client, no SMTP", async () => {
  const KEYS = ["GFX_SMTP_USER", "GFX_SMTP_APP_PASSWORD", "GFX_SMTP_FROM", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"];
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  const origFetch = globalThis.fetch, origCT = nodemailer.createTransport;
  let fetches = 0, transports = 0;
  globalThis.fetch = async () => { fetches++; throw new Error("no network in tests"); };
  nodemailer.createTransport = (...a) => { transports++; return origCT.apply(nodemailer, a); };
  const before = consoleOut.length;
  try {
    const S = await import("../src/lib/members/accm-confirm-send.ts");
    const uid = "11111111-1111-1111-1111-111111111111";
    assert.equal(await S.sendAccmConfirmForUser(uid), "error", "no SMTP env -> neutral error");
    // SMTP env present (placeholders, this process only) but no service-role key -> still neutral, nothing issued.
    Object.assign(process.env, { GFX_SMTP_USER: "u@example.test", GFX_SMTP_APP_PASSWORD: "placeholder", GFX_SMTP_FROM: "GFX Society <u@example.test>" });
    assert.equal(await S.sendAccmConfirmForUser(uid), "error", "no admin client -> neutral error");
    assert.equal(fetches, 0, "no RPC / network call"); assert.equal(transports, 0, "no SMTP transport created");
    const out = consoleOut.slice(before).join("\n");
    assert.ok(!out.includes("placeholder") && !out.includes("u@example.test") && !out.includes(uid), "no env value, address or user id logged");
    // The request action only mails through this server function, with the server-verified user id.
    const a = read("src/app/system/join/actions.ts");
    assert.match(a, /\.\.\.\(ACCM_CONFIRM_MAIL_LIVE && user\s*\? \{ sendConfirm: async \(\) => \(await sendAccmConfirmForUser\(user\.id\)\) === "sent" \}\s*: \{\}\)/);
    const callers = fs.readdirSync("src", { recursive: true }).filter((f) => /\.tsx?$/.test(f)).filter((f) => read(`src/${f}`).includes("sendAccmConfirmForUser("));
    assert.deepEqual(callers.sort(), ["app/system/join/actions.ts", "lib/members/accm-confirm-send.ts"], "only the server action calls the mailer");
    assert.ok(!read("src/app/system/join/join-form.tsx").includes("accm-confirm"), "client form never imports the mailer");
  } finally {
    globalThis.fetch = origFetch; nodemailer.createTransport = origCT;
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
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
await t("join form shows the ACCM field and helper behind the (now live) flag; spec pending-confirmation copy present", async () => {
  const f = read("src/app/system/join/join-form.tsx");
  assert.match(f, /\{ACCM_CONFIRM_MAIL_LIVE && \(/);
  const { REQUEST_COPY } = await import("../src/content/access-request.ts");
  assert.equal(REQUEST_COPY.submittedAwaiting, "Halos tapos na. I-click ang confirmation link na pinadala namin sa ACCM email mo (check din ang Spam o Promotions). Iche-check lang namin ang request pag na-confirm na ito.");
  assert.equal(REQUEST_COPY.accmEmailHelper, "Kailangan naming i-confirm ang email na ito, kaya may ipapadala kaming link.");
});
await t("privacy: v1.5 served now (flag live); v1.4 kept as rollback history; they differ only in the v1.5 parts", async () => {
  assert.equal(AR.ACCM_CONFIRM_MAIL_LIVE, true);
  const page = read("src/app/privacy/page.tsx");
  assert.match(page, /ACCM_CONFIRM_MAIL_LIVE \? "privacy-notice-v1\.5\.md" : "privacy-notice\.md"/);
  const v14 = read("src/content/legal/privacy-notice.md"), v15 = read("src/content/legal/privacy-notice-v1.5.md");
  assert.match(v14, /Version: 1\.4/); assert.ok(!/ACCM email \(kung binigay\)|Different ACCM email/.test(v14));
  assert.match(v15, /Version: 1\.5/); assert.match(v15, /\*\*What changed in v1\.5 \(11 Nov 2026\):\*\*/);
  assert.ok(v15.includes("Kung mag-request ka ng access, sine-save namin ang Academy email mo, ACCM email (kung binigay), at IB name (kung binigay)"));
  assert.ok(v15.includes("| Different ACCM email waiting for confirmation (plain email, private table) | Only until you click the confirmation link, or 7 days if you don't confirm it, then removed (the hash stays with the request). The link itself works once and expires after 24 hours. |"));
  assert.ok(v15.includes("and we remove it once it is confirmed, or after 7 days if it isn't."), "Q2 Design wording (EN, section 2)");
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

await t("Q1: analytics beforeSend strips the URL fragment from every event; layout uses it; confirm page strips #token", async () => {
  const { stripUrlFragment } = await import("../src/lib/analytics-scrub.ts");
  assert.deepEqual(stripUrlFragment({ type: "pageview", url: `${SITE}/system/join/confirm#token=${TOKEN}` }), { type: "pageview", url: `${SITE}/system/join/confirm` });
  assert.deepEqual(stripUrlFragment({ type: "event", url: `${SITE}/x?y=1#a#b` }), { type: "event", url: `${SITE}/x?y=1` });
  const e = { type: "pageview", url: `${SITE}/training` };
  assert.equal(stripUrlFragment(e), e, "no fragment: same event object");
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /<SiteAnalytics \/>/); assert.ok(!/<Analytics\b/.test(layout), "no bare <Analytics /> left");
  assert.match(read("src/components/analytics/site-analytics.tsx"), /<Analytics beforeSend=\{stripUrlFragment\} \/>/);
  const f = read("src/app/system/join/confirm/confirm-form.tsx");
  const take = f.slice(f.indexOf("function takeToken"), f.indexOf("export function ConfirmForm"));
  assert.ok(take.indexOf("window.location.hash") < take.indexOf('window.history.replaceState(null, "", window.location.pathname)'), "reads #token, then replaceState strips it");
});
await t("Q4: SMTP connection/greeting/socket timeouts ~10 s each, used by the real transport", async () => {
  assert.deepEqual(M.SMTP_TIMEOUTS, { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000 });
  const opts = nodemailer.createTransport({ ...M.GMAIL_SMTP, ...M.SMTP_TIMEOUTS, auth: { user: "u@example.test", pass: "placeholder" } }).options;
  for (const k of ["connectionTimeout", "greetingTimeout", "socketTimeout"]) assert.equal(opts[k], 10000, k);
  assert.match(read("src/lib/members/accm-confirm-send.ts"), /\.\.\.SMTP_TIMEOUTS/);
});
await t("Q5: app + mailer accept only a plain addr-spec ACCM email", async () => {
  const bad = ["Name<a@example.test>", "<a@example.test>", '"a"@example.test', "a'b@example.test", "a,b@example.test", "a b@example.test",
               "a@example.test\r\nbcc@example.test", "a@example.test\n", "a;b@example.test", "a@localhost", "a@-x.test", "a@@example.test", "Name a@example.test"];
  for (const e of bad) {
    assert.ok(!AR.ACCM_EMAIL_RE.test(e), `regex rejects ${JSON.stringify(e)}`);
    // Outer whitespace is trimmed before validation (and before the RPC), so only inner bad characters reach the regex.
    if (e.trim() === e) assert.equal(AR.validateRequest({ accmEmail: e, ibName: "", consent: true }, "me@example.test", true), "invalid_email", JSON.stringify(e));
    const h = harness({ issue: { email: e, token: TOKEN } });
    assert.equal(await M.sendAccmConfirm(h.deps), "error"); assert.equal(h.sent.length, 0); assert.deepEqual(h.logs, ["issue_bad_shape"]);
  }
  for (const ok of ["first.last+tag@mail.example-co.test", "A_B%c@x.io"]) {
    assert.ok(AR.ACCM_EMAIL_RE.test(ok), ok);
    assert.equal(AR.validateRequest({ accmEmail: ok, ibName: "", consent: true }, "me@example.test", true), null, ok);
  }
  const sql = read("supabase/migrations/20261111130000_accm_confirm_mailer.sql");
  assert.ok(sql.includes("v_accm !~ '^[a-z0-9._%+-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'"), "same rule in SQL");
});
await t("Q8: HTML mail has one button per language block (TL + EN), same pinned href, full width on mobile, >= 44px", async () => {
  const link = `${SITE}/system/join/confirm#token=${TOKEN}`;
  const { html, text } = M.buildAccmConfirmEmail(link);
  const [tl, en] = html.split("<hr");
  const btn = (block, label) => [...block.matchAll(/<a href="([^"]+)" style="([^"]+)">([^<]+)<\/a>/g)].filter((m) => m[3] === label);
  const a = btn(tl, "I-confirm ang ACCM email"), b = btn(en, "Confirm ACCM email");
  assert.equal(a.length, 1, "TL button in the TL block"); assert.equal(b.length, 1, "EN button in the EN block");
  assert.equal(a[0][1], link); assert.equal(b[0][1], link); assert.equal(a[0][2], b[0][2], "same style");
  for (const k of ["display:block", "width:100%", "max-width:320px", "min-height:44px", "line-height:20px", "padding:12px 16px", "box-sizing:border-box"]) assert.ok(a[0][2].includes(k), k);
  assert.ok(en.includes(`<p style="margin:12px 0;font-size:12px;color:#555">${link}</p>`), "small plain fallback link kept");
  assert.equal(M.ACCM_CONFIRM_MAIL_COPY.buttonEn, "Confirm ACCM email");
  assert.equal(text.split(link).length - 1, 2, "plain text: link once per language block");
});
await t("Q7: nodemailer + @types/nodemailer pinned to exact versions (lockfile matches)", async () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies.nodemailer, "10.3.1"); assert.equal(pkg.devDependencies["@types/nodemailer"], "8.0.2");
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.packages["node_modules/nodemailer"].version, "10.3.1"); assert.equal(lock.packages["node_modules/@types/nodemailer"].version, "8.0.2");
  assert.equal(lock.packages[""].dependencies.nodemailer, "10.3.1");
});
await t("Q8 marker gone; Q9 Copied timer cleared on unmount", async () => {
  assert.ok(!read("src/content/access-request.ts").includes("Pending GFX Design review"));
  const th = read("src/app/system/join/transfer-help.tsx");
  assert.match(th, /useEffect\(\(\) => \(\) => \{\s*if \(timer\.current\) clearTimeout\(timer\.current\);\s*\}, \[\]\)/);
  assert.match(th, /timer\.current = setTimeout\(\(\) => setCopied\(true\), 50\)/);
});

await t("page titles: no page title repeats the site name the layout template already adds", async () => {
  assert.match(read("src/app/layout.tsx"), /template: `%s \| \$\{SITE_NAME\}`/);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(tsx?|mdx?)$/.test(e.name) ? [`${d}/${e.name}`] : []));
  const bad = walk("src/app").filter((f) => f !== "src/app/layout.tsx").filter((f) => /\btitle:\s*["'`][^"'`]*GFX Society/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(bad, [], "use a bare title (template adds the name) or title: { absolute: ... }");
  for (const [f, tt] of [["src/app/privacy/page.tsx", "Privacy Notice"], ["src/app/terms/page.tsx", "Terms of Use"], ["src/app/risk/page.tsx", "Risk Disclaimer"], ["src/app/disclosure/page.tsx", "IB Disclosure"]])
    assert.ok(read(f).includes(`title: "${tt}"`), f);
  assert.ok(read("src/app/go/[code]/page.tsx").includes('title: { absolute: "GFX Society" }'));
});

await t("docs (R1/R2 + go-live): migration-history repair mapping, purge latency, go-live order with exact SQL, rollback", async () => {
  const d = read("docs/accm-confirm-mailer.md");
  for (const v of ["20261111071025", "20261111073716", "20261111120000_access_requests.sql", "20261111130000_accm_confirm_mailer.sql"]) assert.ok(d.includes(v), v);
  assert.ok(d.includes("supabase migration repair --status reverted 20261111071025 20261111073716"));
  assert.ok(d.includes("supabase migration repair --status applied  20261111120000 20261111130000"));
  assert.match(d, /before any future `supabase db push`/i);
  assert.match(d, /Latency \(QA R2\): up to about 7 days \+ 1 day/);
  assert.ok(d.includes("update private.app_settings set value = 'true' where key = 'accm_confirm_mail_live';"));
  const order = ["a. Set `GFX_SMTP_USER`", "b. Hosted check", "c. Turn the DB switch on", "d. Merge the go-live PR", "e. Post-deploy smoke checks"].map((x) => d.indexOf(x));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), "go-live steps a-e in order");
  const rb = d.slice(d.indexOf("## Rollback"));
  assert.ok(rb.indexOf("`ACCM_CONFIRM_MAIL_LIVE` back to `false`") < rb.indexOf("Turn the DB switch off") && rb.indexOf("Turn the DB switch off") < rb.indexOf("delete from private.access_request_accm"), "rollback: flag, switch, scrub");
});

console.log(`ALL PASS accm confirm mail (${n})`);
