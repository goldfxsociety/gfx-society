// Offline unit tests for access journey v2 (spec access-journey-spec.md): request action logic, journey-1 `next`
// helpers, Manila dates, J4 template, copy rules, privacy line, /accm + /broker one gold CTA, F2.
// Run: node --experimental-strip-types scripts/test-access-request.mjs   (Node >= 22.15, no network)
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const SRC = pathToFileURL(`${process.cwd()}/src/`).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, SRC).href, shortCircuit: true };
    return next(specifier, context);
  },
});

const AR = await import("../src/lib/members/access-request.ts");
const { memberNext, joinPath, joinLoginPath, joinSignupPath, MEMBERS_HOME, JOIN_LOGIN_PATH } = await import("../src/lib/members/routes.ts");
const { REQUEST_COPY, REQUEST_COPY_EN, TRANSFER_COPY, TRANSFER_COPY_EN, TRANSFER_TEMPLATE, TRANSFER_TEMPLATE_TEXT, JOIN_SYSTEM_CTA, REQUEST_CONSENT_VERSION } =
  await import("../src/content/access-request.ts");

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
const read = (f) => fs.readFileSync(f, "utf8");

// ---- journey 1: safe next ----
await t("memberNext: safe same-site paths kept; unsafe / missing / join loop -> /training", async () => {
  assert.equal(memberNext("/courses/gold-reset/l1"), "/courses/gold-reset/l1");
  for (const bad of [null, "", "https://evil.test", "//evil.test", "/\\evil", "javascript:alert(1)", "/system/join", "/system/join?next=/x", "/system/join/confirm"])
    assert.equal(memberNext(bad), MEMBERS_HOME, String(bad));
});
await t("joinPath / joinLoginPath / joinSignupPath carry next; default equals the PR66 constants", async () => {
  assert.equal(joinPath(null), "/system/join");
  assert.equal(joinPath("/training"), "/system/join");
  assert.equal(joinPath("/courses/a/b"), "/system/join?next=%2Fcourses%2Fa%2Fb");
  assert.equal(joinLoginPath(""), JOIN_LOGIN_PATH);
  assert.equal(joinLoginPath("/courses/a/b"), "/login?next=%2Fsystem%2Fjoin%3Fnext%3D%252Fcourses%252Fa%252Fb");
  assert.equal(joinSignupPath("https://evil.test"), "/signup?next=%2Fsystem%2Fjoin");
  // round trip: /login hands `next` to safeNextPath, which must accept it
  const inner = decodeURIComponent(joinLoginPath("/courses/a/b").split("next=")[1]);
  assert.equal(inner, "/system/join?next=%2Fcourses%2Fa%2Fb");
});
await t("join action + page use the safe next helpers; consent remembered via my_join_state", async () => {
  const a = read("src/app/system/join/actions.ts");
  assert.match(a, /redirect\(memberNext\(next\)\)/);
  assert.match(a, /redirect\(joinLoginPath\(next\)\)/);
  assert.match(a, /rpc\("my_join_state"\)/);
  assert.match(a, /formData\.get\("consent"\) === "on" \|\| \(await d\.consentRecorded\(\)\)/);
  const p = read("src/app/system/join/page.tsx");
  assert.match(p, /if \(membership !== "none"\) redirect\(dest\)/);
  assert.match(read("src/lib/members/membership.ts"), /redirect\(joinPath\(path\)\)/);
});

// ---- request action logic ----
const mk = (o = {}) => {
  const log = [];
  return { log, deps: {
    loggedIn: async () => { log.push("user"); return o.loggedIn ?? true; },
    submit: async (accm, ib) => { log.push(["rpc", accm, ib]); return o.rpc === undefined ? "pending" : o.rpc; },
    ...(o.send ? { sendConfirm: async () => { log.push("send"); return o.send === "ok"; } } : {}),
  } };
};
const IN = (o = {}) => ({ accmEmail: "", ibName: "", consent: true, ...o });
const ME = "me@example.test";
await t("logged out -> login_required, no RPC", async () => { const m = mk({ loggedIn: false }); assert.equal(await AR.submitRequest(m.deps, IN(), null), "login_required"); assert.deepEqual(m.log, ["user"]); });
await t("consent not ticked -> consent_required, no RPC", async () => { const m = mk(); assert.equal(await AR.submitRequest(m.deps, IN({ consent: false }), ME), "consent_required"); assert.equal(m.log.length, 1); });
await t("mail not live: ACCM email ignored (never sent to the RPC), IB name cleaned", async () => {
  const m = mk();
  assert.equal(AR.ACCM_CONFIRM_MAIL_LIVE, false);
  assert.equal(await AR.submitRequest(m.deps, IN({ accmEmail: "other@example.test", ibName: " Team  https://x.test/a Ana " }), ME), "pending");
  assert.deepEqual(m.log[1], ["rpc", null, "Team Ana"]);
});
await t("mail live: invalid / same ACCM email caught before the RPC", async () => {
  for (const [v, want] of [["nope", "invalid_email"], ["a@b", "invalid_email"], ["x".repeat(250) + "@a.test", "invalid_email"], [" ME@example.test ", "same_email"]]) {
    const m = mk(); assert.equal(await AR.submitRequest(m.deps, IN({ accmEmail: v }), ME, true), want, v); assert.equal(m.log.length, 1);
  }
});
await t("mail live: awaiting -> sends the link; no mailer or failed send -> neutral error (never claims 'sent')", async () => {
  assert.equal(await AR.submitRequest(mk({ rpc: "awaiting_email_confirm", send: "ok" }).deps, IN({ accmEmail: "o@example.test" }), ME, true), "awaiting_email_confirm");
  assert.equal(await AR.submitRequest(mk({ rpc: "awaiting_email_confirm", send: "fail" }).deps, IN({ accmEmail: "o@example.test" }), ME, true), "error");
  assert.equal(await AR.submitRequest(mk({ rpc: "awaiting_email_confirm" }).deps, IN({ accmEmail: "o@example.test" }), ME, true), "error");
  assert.equal(await AR.submitRequest(mk({ rpc: "awaiting_email_confirm", send: "ok" }).deps, IN(), ME, false), "error");
});
for (const r of ["pending", "matched", "unverified_email", "already_member", "invalid_email", "same_email", "rate_limited"])
  await t(`RPC '${r}' -> '${r}'`, async () => assert.equal(await AR.submitRequest(mk({ rpc: r }).deps, IN(), ME), r));
await t("RPC none -> login_required; join_consent_required / null / unknown -> error", async () => {
  assert.equal(await AR.submitRequest(mk({ rpc: "none" }).deps, IN(), ME), "login_required");
  for (const r of ["join_consent_required", null, "", "expired", "weird"]) assert.equal(await AR.submitRequest(mk({ rpc: r }).deps, IN(), ME), "error", String(r));
});
await t("cleanIbName mirrors SQL: no URLs/domains/control chars, max 60", async () => {
  assert.equal(AR.cleanIbName("Sub IB https://evil.test/x www.spam.test Juan dela Cruz evil.com"), "Sub IB Juan dela Cruz");
  assert.equal(AR.cleanIbName("a\u0000b\nc"), "a b c");
  assert.equal(AR.cleanIbName("x".repeat(80)).length, 60);
  assert.equal(AR.cleanIbName("   "), "");
});

// ---- dates ----
await t("nextFirstManila: next month's 1st in Asia/Manila", async () => {
  assert.equal(AR.nextFirstManila(new Date("2026-11-11T06:00:00Z")), "Dec 1, 2026");
  assert.equal(AR.nextFirstManila(new Date("2026-12-15T00:00:00Z")), "Jan 1, 2027");
  assert.equal(AR.nextFirstManila(new Date("2026-11-30T16:30:00Z")), "Jan 1, 2027", "00:30 Dec 1 Manila -> Jan 1");
  assert.equal(AR.nextFirstManila(new Date("2026-11-30T15:59:00Z")), "Dec 1, 2026", "23:59 Nov 30 Manila");
  assert.equal(AR.manilaDate("2026-11-10T17:00:00Z"), "Nov 11, 2026");
});
await t("active-request copy uses the dates verbatim", async () => {
  assert.equal(REQUEST_COPY.activeRequest("Nov 11, 2026", "Dec 1, 2026"),
    "May active request ka na, submitted Nov 11, 2026. Iche-check ito sa Dec 1, 2026, at sa bawat monthly update hanggang ma-match.");
  assert.equal(REQUEST_COPY_EN.activeRequest("Nov 11, 2026", "Dec 1, 2026"),
    "You already have an active request (submitted Nov 11, 2026). It'll be checked on Dec 1, 2026, and at every monthly update until it matches.");
});
await t("confirm link: pinned to site URL, 64-hex token only", async () => {
  const tok = "a".repeat(64);
  assert.equal(AR.accmConfirmUrl("https://gfx-society.vercel.app/", tok), `https://gfx-society.vercel.app/system/join/confirm?token=${tok}`);
  assert.throws(() => AR.accmConfirmUrl("https://gfx-society.vercel.app", "x"));
});
await t("confirm landing: no redirect target from the URL, no-referrer, noindex, RPC only for a 64-hex token", async () => {
  const p = read("src/app/system/join/confirm/page.tsx");
  assert.ok(!/redirect\(|searchParams\.next|sp\.next/.test(p));
  assert.match(p, /referrer: "no-referrer"/);
  assert.match(p, /index: false/);
  assert.match(p, /\/\^\[0-9a-f\]\{64\}\$\/\.test\(token\)/);
  assert.match(p, /rpc\("confirm_accm_email", \{ p_token: token \}\)/);
});

// ---- J4 template ----
await t("J4 template exact (To/Subject/Body) and Copy text", async () => {
  assert.equal(TRANSFER_TEMPLATE.to, "csse@accmfx.com, roselle@accmfx.com");
  assert.equal(TRANSFER_TEMPLATE.subject, "For Transfer IB");
  assert.equal(TRANSFER_TEMPLATE.body, "Hi, please transfer my account to IB goldfx.society@gmail.com\n\nThank you.");
  assert.equal(TRANSFER_TEMPLATE_TEXT, "To: csse@accmfx.com, roselle@accmfx.com\nSubject: For Transfer IB\n\nHi, please transfer my account to IB goldfx.society@gmail.com\n\nThank you.");
});
await t("J4 mailto href exact and decodes to the same template", async () => {
  assert.equal(TRANSFER_TEMPLATE.mailto, "mailto:csse@accmfx.com,roselle@accmfx.com?subject=For%20Transfer%20IB&body=Hi%2C%20please%20transfer%20my%20account%20to%20IB%20goldfx.society%40gmail.com%0A%0AThank%20you.");
  const u = new URL(TRANSFER_TEMPLATE.mailto);
  assert.equal(u.pathname, "csse@accmfx.com,roselle@accmfx.com");
  assert.equal(u.searchParams.get("subject"), TRANSFER_TEMPLATE.subject);
  assert.equal(u.searchParams.get("body"), TRANSFER_TEMPLATE.body);
});
await t("J4 UI: inline expander (aria-expanded), Copy + mailto outline, aria-live Copied, no second-account CTA", async () => {
  const j = read("src/app/system/join/transfer-help.tsx");
  assert.match(j, /aria-expanded=\{open\}/);
  assert.match(j, /aria-live="polite"/);
  assert.equal(j.match(/variant: "outline"/g)?.length, 2);
  assert.ok(!/variant: "default"|<Button\b/.test(j), "nothing gold");
  assert.ok(!/accmHref|AccmLink|cents account|Open ACCM/i.test(j), "no account-opening CTA");
  assert.match(j, /T\.clause54/); assert.match(j, /T\.timing/);
});

// ---- copy rules ----
const ALL = JSON.stringify([REQUEST_COPY, REQUEST_COPY_EN, TRANSFER_COPY, TRANSFER_COPY_EN, JOIN_SYSTEM_CTA]) + REQUEST_COPY.activeRequest("x", "y") + REQUEST_COPY_EN.activeRequest("x", "y");
await t("copy rules: no VIP / PDE / income / profit / win-rate / guarantee / free bot / demo first / deposit requirement", async () => {
  for (const re of [/\bVIP\b/i, /\bPDE\b/, /win[- ]?rate/i, /\bprofit/i, /\bincome\b/i, /free bot/i, /demo first/i, /guarantee/i, /minimum deposit|min deposit/i]) assert.ok(!re.test(ALL), String(re));
});
await t("waiting copy promises only the monthly update / next 1st (no same-day, no faster check)", async () => {
  assert.ok(!/same[- ]day|today|ngayon|within \d+ (hour|day)|24 ?h|oras/i.test(ALL));
  for (const s of [REQUEST_COPY.intro, REQUEST_COPY.submittedPending, TRANSFER_COPY.step2]) assert.match(s, /every 1st of the month/);
});
await t("no transfer-timing promise; no deletion promise; consent says data is saved", async () => {
  assert.match(TRANSFER_COPY.timing, /Hindi namin ma-promise/);
  assert.ok(!/30 days|30-day|auto-delete|expire/i.test(REQUEST_COPY.consent + REQUEST_COPY_EN.consent));
  assert.match(REQUEST_COPY.consent, /mag-email sa goldfx\.society@gmail\.com/);
  assert.equal(REQUEST_CONSENT_VERSION, "request-v1");
  assert.match(read("supabase/migrations/20261111120000_access_requests.sql"), /p_consent_version is distinct from 'request-v1'/);
});
await t("spec copy verbatim (spot checks)", async () => {
  assert.equal(REQUEST_COPY.openLink, "Hindi pa naka-verify? I-request dito.");
  assert.equal(REQUEST_COPY.submit, "I-submit ang request");
  assert.equal(REQUEST_COPY.rateLimited, "Medyo marami nang tries. Maghintay muna nang kaunti, tapos subukan ulit.");
  assert.equal(TRANSFER_COPY.link, "Naka-register ka na sa ACCM pero sa ibang IB?");
  assert.equal(TRANSFER_COPY.caption, "Template mula sa GFX team. I-copy o i-open as is.");
  assert.ok(!JSON.stringify(TRANSFER_COPY).includes("Jarvis"), "no internal bot names in public J4 copy");
  assert.equal(JOIN_SYSTEM_CTA, "Join the Trading System");
});

// ---- join page / form structure ----
await t("request form: hidden when logged out (page has no form), 16px inputs, labels, aria-describedby, role=status, one gold", async () => {
  const f = read("src/app/system/join/join-form.tsx");
  const page = read("src/app/system/join/page.tsx");
  assert.ok(!page.includes("RequestForm") && !page.includes("submitAccessRequest"));
  assert.match(f, /role="status"/);
  assert.match(f, /aria-describedby=\{consentErr \? "ar-consent-err" : undefined\}/);
  assert.match(f, /aria-expanded=\{formOpen\}/);
  assert.match(f, /\{ACCM_CONFIRM_MAIL_LIVE && \(/, "ACCM email field only when the mailer is live");
  assert.match(f, /showVerify = !\(noMatch && \(formOpen \|\| active \|\| submitted\)\)/, "verify gold hidden once the request form is open");
  assert.ok(!/IB_DISCLOSURE|Partner broker/.test(f), "no partner line inside the form (page footer has it once)");
  assert.equal(page.match(/SYSTEM_COPY\.risk/g)?.length, 1);
});

// ---- /accm + /broker: one gold CTA "Join the Trading System" ----
for (const [file, extra] of [["src/app/accm/page.tsx", "src/app/accm/accm-self-check.tsx"], ["src/app/broker/page.tsx", null]]) {
  await t(`${file}: exactly one gold CTA -> /system/join; Discord + account buttons outline; disclosures kept`, async () => {
    const src = read(file) + (extra ? read(extra) : "");
    assert.equal(src.match(/variant: "default"/g)?.length, 1, "one gold");
    assert.match(src, /<Link href="\/system\/join" className=\{cn\(buttonVariants\(\{ variant: "default" \}\), "[^"]*h-11 w-full"\)\}>\s*\{JOIN_SYSTEM_CTA\}/);
    assert.match(src, /DiscordApplyLink page="(accm|broker)" className=\{cn\(buttonVariants\(\{ variant: "outline" \}\)/);
    assert.match(src, /JOIN_COPY\.intro[\s\S]*SYSTEM_COPY\.underCta/);
    assert.ok(!/\bVIP\b|\bPDE\b/.test(src)); // existing FAQ/self-check negations ("walang guaranteed profit") are disclaimers
  });
}
await t("/accm: heading + coming-soon fallback; self-check button outline with disclosure", async () => {
  const p = read("src/app/accm/page.tsx");
  assert.match(p, /3\. Pagka-register: join the Trading System/);
  assert.match(p, /Discord: coming soon\./);
  const s = read("src/app/accm/accm-self-check.tsx");
  assert.match(s, /variant: "outline" \}\), "h-12 flex-1 text-base"/);
  assert.match(s, /Open cents account →/); assert.match(s, /\{disclosure\}/);
});
await t("/broker: Step 2 heading; account CTA outline with IbDisclosureShort", async () => {
  const p = read("src/app/broker/page.tsx");
  assert.match(p, /Step 2: Join the Trading System/);
  assert.match(p, /variant: "outline" \}\), "h-12 w-full text-base"\)\}\s*>\s*Open ACCM Cents Account →\s*<\/AccmLink>\s*<IbDisclosureShort \/>/);
});

// ---- privacy + F2 ----
await t("privacy: request-data line (TL + EN), no deletion promise for requests, no stale email-code login", async () => {
  const p = read("src/content/legal/privacy-notice.md");
  assert.ok(p.includes("Kung mag-request ka ng access, sine-save namin ang Academy email mo at IB name (kung binigay) para i-check sa ACCM member data sa bawat monthly update. Hindi namin ito auto-dine-delete. Kung gusto mong burahin ang data na ito, mag-email sa goldfx.society@gmail.com."));
  assert.ok(p.includes("We don't delete this data automatically. To ask us to delete it, email goldfx.society@gmail.com."));
  const sec = p.slice(p.indexOf("### Members area verification"), p.indexOf("### Website analytics"));
  assert.ok(!/6-digit|walang password|passwordless|code request log|Email-code login/i.test(sec), "members section describes Academy login");
  assert.match(sec, /normal Academy account mo \(email \+ password\)/);
  assert.match(p, /Version: 1\.4/);
  // Mailer off (ACCM_CONFIRM_MAIL_LIVE=false): no ACCM-email promise until Privacy v1.5.
  assert.ok(!/ACCM email|Different ACCM email|confirmation link we send/i.test(p), "no ACCM-email confirm copy while mailer is off");
});
await t("F2: no stale member_code_reserve comment in admin.ts", async () => {
  assert.ok(!read("src/lib/supabase/admin.ts").includes("member_code_reserve"));
});

console.log(`ALL PASS access request (${n})`);
