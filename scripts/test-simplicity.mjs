// Offline tests for the simplicity / UX sprint (design/trading-system/simplicity-review-spec.md v2 + Ben's decisions):
// one gold CTA per page (incl. /en/accm, /en/broker, /en/system/join), disclosures + risk line byte-identical to their
// sources on main, long /accm risk text inside the "Risk warning" expander, Signals card not a link and claim/date-free,
// EN J4 caption, copy rules, docs G6/G7. No network, no Supabase, no env reads.
// Run: node --experimental-strip-types scripts/test-simplicity.mjs   (Node >= 22.15; needs `git` with origin/main)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const SRC = pathToFileURL(`${root}/src/`).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, SRC).href, shortCircuit: true };
    return next(specifier, context);
  },
});

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const main = (f) => execFileSync("git", ["show", `origin/main:${f}`], { cwd: root, encoding: "utf8" });
const golds = (s) => s.match(/variant: (?:[^,}"]*\? )?"default"/g)?.length ?? 0;
// JSX text as rendered: collapse whitespace runs, decode the two entities used in these files.
const jsxText = (s) => s.replace(/\s+/g, " ").replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

const { RISK_LINE, RISK_LINE_EN_SHORT } = await import("../src/config/training.ts");
const { IB_DISCLOSURE_TEXT, IB_DISCLOSURE_TEXT_EN, NEUTRAL_LICENSING_TEXT } = await import("../src/config/partners.ts");
const { ACCM_COPY, ACCM_COPY_EN, SELF_CHECK_EN, SELF_CHECK_UI } = await import("../src/content/accm-guide.ts");
const { BROKER_COPY, BROKER_COPY_EN } = await import("../src/content/broker-guide.ts");
const { JOIN_COPY, JOIN_COPY_EN, SYSTEM_COPY, SYSTEM_UNDER_CTA_EN } = await import("../src/content/members-gate.ts");
const { TRANSFER_COPY, TRANSFER_COPY_EN, REQUEST_COPY, REQUEST_COPY_EN, JOIN_SYSTEM_CTA } = await import("../src/content/access-request.ts");
const { ME } = await import("../src/config/members-home.ts");
const { joinPath, joinLoginPath, joinSignupPath, joinBaseFrom, memberNext, MEMBERS_HOME } = await import("../src/lib/members/routes.ts");

// ---- one gold per page (source: page + the layout/components it renders) ----
const PAGES = {
  "/": ["src/app/page.tsx"],
  "/academy": ["src/app/academy/page.tsx", "src/components/academy/accm-bridge.tsx"],
  "/start": ["src/app/start/page.tsx"],
  "/community": ["src/app/community/page.tsx"],
  "/accm + /en/accm": ["src/app/accm/page.tsx", "src/app/en/accm/page.tsx", "src/app/accm/accm-guide.tsx", "src/app/accm/accm-self-check.tsx"],
  "/broker + /en/broker": ["src/app/broker/page.tsx", "src/app/en/broker/page.tsx", "src/app/broker/broker-guide.tsx"],
};
for (const [route, files] of Object.entries(PAGES)) {
  await t(`${route}: exactly one gold (variant "default") CTA`, async () => {
    const src = files.map(read).join("\n");
    assert.equal(golds(src), 1, route);
    assert.ok(!/<Button\b/.test(src), "no shadcn <Button> (defaults to gold)");
  });
}
await t("public gold CTA is Join the Trading System (home, academy bridge, start step 4, community, accm, broker)", async () => {
  assert.match(read("src/app/page.tsx"), /<Link href="\/system\/join" className=\{cn\(buttonVariants\(\{ variant: "default" \}\)[^>]*>\s*\{JOIN_SYSTEM_CTA\}/);
  assert.match(read("src/app/page.tsx"), /<Link href=\{FIRST_LESSON_PATH\} className=\{cn\(buttonVariants\(\{ variant: "outline" \}\)[^>]*>\s*Start Lesson 1 →/);
  assert.match(read("src/components/academy/accm-bridge.tsx"), /<Link href="\/system\/join" className=\{cn\(buttonVariants\(\{ variant: "default" \}\)[^>]*>\s*\{JOIN_SYSTEM_CTA\}/);
  assert.match(read("src/app/academy/page.tsx"), /variant: "outline" \}\), "h-12 w-full text-base"\)\}>\s*Start here →/);
  const start = read("src/app/start/page.tsx");
  assert.match(start, /variant: s\.n === 4 \? "default" : "outline"/);
  assert.match(start, /href: "\/system\/join",\s*cta: JOIN_SYSTEM_CTA/);
  assert.match(read("src/app/community/page.tsx"), /<Link href="\/system\/join" className=\{cn\(buttonVariants\(\{ variant: "default" \}\)[^>]*>\s*\{JOIN_SYSTEM_CTA\}/);
  assert.equal(JOIN_SYSTEM_CTA, "Join the Trading System");
});
await t("/system/join + /en/system/join: one gold at a time (login CTA logged out; Verify / Submit logged in)", async () => {
  const view = read("src/app/system/join/join-view.tsx");
  assert.equal(golds(view), 1, "logged-out login CTA");
  assert.ok(!/<Button\b/.test(view));
  const form = read("src/app/system/join/join-form.tsx");
  assert.equal(form.match(/<Button\b/g)?.length, 2, "Verify + Submit");
  assert.match(form, /showVerify = !\(noMatch && \(formOpen \|\| active \|\| submitted\)\)/, "Submit only shows when Verify is hidden");
  assert.equal(golds(form), 0);
  for (const p of ["src/app/system/join/page.tsx", "src/app/en/system/join/page.tsx"]) assert.match(read(p), /<JoinView lang="(tl|en)"/, p);
});
await t("member home: one gold (Ituloy →), two exclusive branches", async () => {
  const tr = read("src/app/training/page.tsx");
  assert.equal(golds(tr), 2, "lesson branch + finished branch, never both");
  assert.match(tr, /current && lesson \? \([\s\S]*?\) : finished \? \([\s\S]*?\) : null/);
  assert.equal(ME.heroCta, "Ituloy →");
});

await t("home: exactly one gold + byte-identical one-line IB disclosure, small/muted in the footer (not a button/link)", async () => {
  const home = read("src/app/page.tsx");
  assert.equal(golds(home), 1, "home: one gold");
  assert.ok(!/<Button\b/.test(home));
  assert.match(home, /import \{ IbDisclosureShort \} from "@\/components\/compliance\/ib-disclosure";/);
  const footer = home.match(/<footer\b[^>]*data-testid="home-footer"[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer, "home footer present");
  assert.match(footer, /<IbDisclosureShort \/>/, "default (PH) line, no text override");
  assert.match(footer, /\{RISK_LINE\}/, "risk line stays in the footer");
  assert.ok(!/buttonVariants|<Link\b|<a\b/.test(footer), "footer has no button or link");
  assert.equal(home.match(/<IbDisclosureShort\b/g)?.length, 1, "IB line once");
  const comp = read("src/components/compliance/ib-disclosure.tsx");
  assert.match(comp, /export function IbDisclosureShort\(\{ text = IB_DISCLOSURE_TEXT \}/, "defaults to the partner-config line");
  assert.match(comp, /<p className="text-xs text-muted-foreground">\s*<strong>Disclosure:<\/strong> \{text\}\s*<\/p>/, "small muted text");
  assert.equal(IB_DISCLOSURE_TEXT, "Partner broker ng GFX ang ACCM.");
});
// ---- disclosures + risk line byte-identical ----
await t("RISK_LINE, IB_DISCLOSURE_TEXT, EN disclosure, NEUTRAL_LICENSING_TEXT byte-identical to main / spec", async () => {
  const mt = main("src/config/training.ts"), mp = main("src/config/partners.ts");
  assert.ok(mt.includes(`export const RISK_LINE = ${JSON.stringify(RISK_LINE)};`));
  assert.equal(RISK_LINE, "Max 1% risk per trade. Education lang, not financial advice.");
  assert.ok(mp.includes(`export const IB_DISCLOSURE_TEXT = ${JSON.stringify(IB_DISCLOSURE_TEXT)};`));
  assert.equal(IB_DISCLOSURE_TEXT, "Partner broker ng GFX ang ACCM.");
  assert.ok(mp.includes(IB_DISCLOSURE_TEXT_EN), "EN line was already noted in partners.ts on main");
  assert.equal(IB_DISCLOSURE_TEXT_EN, "ACCM is GFX's partner broker.");
  assert.ok(read("src/content/legal/ib-disclosure.md").includes(IB_DISCLOSURE_TEXT_EN));
  assert.equal(RISK_LINE_EN_SHORT, "Max 1% risk per trade. Education only, not financial advice.");
  assert.ok(mp.includes(NEUTRAL_LICENSING_TEXT));
  assert.equal(SYSTEM_COPY.risk, RISK_LINE);
});
await t("IbDisclosureFull, accm-bridge disclosure, /broker risk box byte-identical to main", async () => {
  const full = (s) => jsxText(s.slice(s.indexOf("export function IbDisclosureFull"), s.lastIndexOf("}")));
  assert.equal(full(read("src/components/compliance/ib-disclosure.tsx")), full(main("src/components/compliance/ib-disclosure.tsx")));
  const bridge = (s) => s.match(/export const ACCM_BRIDGE_DISCLOSURE =\s*`[^`]+`/)[0];
  assert.equal(bridge(read("src/components/academy/accm-bridge.tsx")), bridge(main("src/components/academy/accm-bridge.tsx")));
  const mb = main("src/app/broker/page.tsx");
  const box = mb.slice(mb.indexOf("Start small. Risk warning."), mb.indexOf("</div>", mb.indexOf("Start small. Risk warning.")));
  const body = jsxText(box.slice(box.indexOf('text-muted-foreground">') + 23, box.lastIndexOf("</p>")));
  assert.equal(BROKER_COPY.riskBody, body);
  assert.equal(BROKER_COPY.riskTitle, "Start small. Risk warning.");
  assert.match(read("src/app/broker/broker-guide.tsx"), /<IbDisclosureFull \/>/);
  // EN risk box: Appendix H verbatim.
  assert.equal(BROKER_COPY_EN.riskBody, "If you trade, start small with a cents account: only money you can afford to lose. Max 1% risk per trade, always with a stop loss. Trading forex, gold and CFDs with leverage carries a high risk of losing money and is not suitable for everyone. Education only, not financial advice. Only trade with money you can afford to lose.");
});
await t("IB line + risk line shown on every public page that names ACCM (PH + EN)", async () => {
  assert.equal(ACCM_COPY.ib, IB_DISCLOSURE_TEXT); assert.equal(ACCM_COPY_EN.ib, IB_DISCLOSURE_TEXT_EN);
  assert.equal(BROKER_COPY.ib, IB_DISCLOSURE_TEXT); assert.equal(BROKER_COPY_EN.ib, IB_DISCLOSURE_TEXT_EN);
  const g = read("src/app/accm/accm-guide.tsx");
  assert.match(g, /data-testid="ib-line">\{c\.ib\}/);
  assert.match(g, /<RiskFooter compact=\{lang\} \/>/);
  assert.match(g, /<AccmSelfCheck href=\{accmHref\("accm_page"\)\} disclosure=\{c\.ib\} lang=\{lang\} \/>/, "self-check visible + disclosure");
  const v = read("src/app/system/join/join-view.tsx");
  assert.match(v, /\{en \? RISK_LINE_EN_SHORT : SYSTEM_COPY\.risk\}/);
  assert.match(v, /\{en \? IB_DISCLOSURE_TEXT_EN : IB_DISCLOSURE_TEXT\}/);
  assert.match(read("src/app/page.tsx"), /\{RISK_LINE\}/);
  const bridge = read("src/components/academy/accm-bridge.tsx");
  assert.ok(bridge.indexOf("Open ACCM account (optional)") < bridge.indexOf("{ACCM_BRIDGE_DISCLOSURE}"));
});

// ---- /accm risk: long text inside the existing "Risk warning" expander (render) ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gfx-simp-"));
const require = createRequire(path.join(root, "package.json"));
for (const [mod, src] of Object.entries({ "config/training": "src/config/training.ts", "components/academy/risk-footer": "src/components/academy/risk-footer.tsx" })) {
  let code = ts.transpileModule(read(src), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  code = code.replace(/require\("@\/([^"]+)"\)/g, (_, m) => `require(${JSON.stringify(path.join(tmp, m + ".js"))})`);
  code = code.replace(/require\("([^."/@][^"]*|@[^/"]+\/[^"]+)"\)/g, (_, m) => `require(${JSON.stringify(require.resolve(m))})`);
  fs.mkdirSync(path.dirname(path.join(tmp, mod + ".js")), { recursive: true });
  fs.writeFileSync(path.join(tmp, mod + ".js"), code);
}
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const RF = require(path.join(tmp, "components/academy/risk-footer.js"));
const strip = (h) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
const split = (h) => { const i = h.indexOf("<details"); return { outside: strip(h.slice(0, i)), inside: strip(h.slice(i, h.indexOf("</details>"))) }; };
await t("RiskFooter wording byte-identical to main (all three paragraphs)", async () => {
  const m = jsxText(main("src/components/academy/risk-footer.tsx"));
  assert.ok(m.includes(`<strong>Start small.</strong> ${RF.RISK_START_SMALL} </p>`));
  assert.ok(m.includes(`> ${RF.RISK_EDU_LINE} </p>`));
  assert.ok(m.includes(`> ${RF.RISK_WARNING_LONG} </p>`));
  assert.ok(RF.RISK_WARNING_LONG.startsWith("GFX Society provides trading education only"));
});
await t("RiskFooter default (Academy pages): rendered text unchanged from main", async () => {
  const h = strip(renderToStaticMarkup(React.createElement(RF.RiskFooter)));
  assert.equal(h, `Start small. ${RF.RISK_START_SMALL}${RF.RISK_EDU_LINE}Risk warning${RF.RISK_WARNING_LONG}`);
});
await t("/accm: short RISK_LINE visible; Start small + Education + long warning only inside the closed Risk warning <details>", async () => {
  const html = renderToStaticMarkup(React.createElement(RF.RiskFooter, { compact: "tl" }));
  const { outside, inside } = split(html);
  assert.equal(outside, RISK_LINE);
  assert.equal(inside, `Risk warning${"Start small. " + RF.RISK_START_SMALL}${RF.RISK_EDU_LINE}${RF.RISK_WARNING_LONG}`);
  assert.ok(!/<details[^>]*\sopen/.test(html), "expander closed by default");
  assert.equal(html.match(/<details/g).length, 1, "the one existing expander");
  assert.match(html, /<summary[^>]*>Risk warning<\/summary>/);
});
await t("/en/accm: RISK_LINE_EN_SHORT visible; English long warning (byte-identical) inside the expander; no Taglish", async () => {
  const html = renderToStaticMarkup(React.createElement(RF.RiskFooter, { compact: "en" }));
  const { outside, inside } = split(html);
  assert.equal(outside, RISK_LINE_EN_SHORT);
  assert.equal(inside, `Risk warning${RF.RISK_WARNING_LONG}`);
  assert.ok(!/\b(lang|ang|sa|mo|laging|kaya)\b/.test(strip(html)));
});

// ---- Signals card ----
await t("Signals card: not a link/button, aria-disabled, not focusable, no gold/hover, no dates or claims, order", async () => {
  const tr = read("src/app/training/page.tsx");
  const a = tr.indexOf('data-testid="card-signals"');
  const card = tr.slice(tr.lastIndexOf("<div", a), tr.indexOf("</div>", a) + 6);
  assert.match(card, /aria-disabled="true"/);
  assert.ok(!/<Link|<a\b|href=|<button|onClick|tabIndex|role="button"|hover:|variant:|bg-primary|border-primary/.test(card), card);
  const s = [ME.home.signalsTitle, ME.home.signalsLine, ME.home.signalsBadge].join(" ");
  assert.equal(ME.home.signalsTitle, "Signals"); assert.equal(ME.home.signalsLine, "Coming soon."); assert.equal(ME.home.signalsBadge, "Coming soon");
  assert.ok(!/\d/.test(s), "no dates or numbers");
  assert.ok(!/profit|win|pips?|accura|%|guarant|live|daily|weekly|join|vip|free/i.test(s), "no claims");
  const order = ["card-continue", "card-courses", "card-signals", "card-account"].map((id) => tr.indexOf(`data-testid="${id}"`));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), "Continue, Courses, Signals, Account");
  assert.match(tr, /<Link href="\/courses"/); assert.match(tr, /<Link href="\/account"/);
  assert.ok(!/IB_DISCLOSURE|Partner broker/.test(tr), "members area: no IB line");
  assert.equal(tr.match(/<MembersFooter/g)?.length, 1, "risk line once");
});

// ---- EN pages ----
await t("EN J4 caption, EN reuse verbatim, JOIN_COPY_EN keys match JOIN_COPY", async () => {
  assert.equal(TRANSFER_COPY_EN.caption, "Template from the GFX team. Copy or open it as is.");
  assert.equal(TRANSFER_COPY.caption, "Template mula sa GFX team. I-copy o i-open as is.");
  assert.deepEqual(Object.keys(JOIN_COPY_EN).sort(), Object.keys(JOIN_COPY).sort());
  assert.deepEqual(Object.keys(REQUEST_COPY_EN).sort(), Object.keys(REQUEST_COPY).sort());
  assert.deepEqual(Object.keys(TRANSFER_COPY_EN).sort(), Object.keys(TRANSFER_COPY).sort());
  for (const k of ["loginCta", "signupLink", "submit"]) assert.equal(JOIN_COPY_EN[k], JOIN_COPY[k], k);
  assert.equal(JOIN_COPY_EN.title, "Join the Trading System"); assert.equal(JOIN_COPY.title, "Join the Trading System");
  assert.equal(JOIN_COPY_EN.loggedOutIntro, "Log in with your Academy account to verify your membership.");
  assert.equal(JOIN_COPY.loggedOutIntro, "Log in with your Academy account para ma-verify ang membership mo.");
  assert.equal(JOIN_COPY_EN.helpSummary, "Having trouble?"); assert.equal(JOIN_COPY.helpSummary, "May problema?");
  assert.equal(SYSTEM_UNDER_CTA_EN, "This is members-only for people registered with ACCM under GFX's IB line. The free Academy lessons are open to everyone.");
  assert.equal(SELF_CHECK_EN.length, 5);
  assert.equal(SELF_CHECK_UI.en.tickFirst, "Tick all 5 above first.");
  const form = read("src/app/system/join/join-form.tsx"), help = read("src/app/system/join/transfer-help.tsx");
  assert.match(form, /lang === "en"\s*\? \{ C: JOIN_COPY_EN, R: REQUEST_COPY_EN/);
  assert.match(help, /const T = lang === "en" \? TRANSFER_COPY_EN : TRANSFER_COPY;/);
});
await t("EN headlines + no ACCM in any H1 / title / og:title (PH + EN)", async () => {
  assert.equal(ACCM_COPY_EN.h1, "Start small, then join the Trading System");
  assert.equal(ACCM_COPY.h1, "Mag-start small, tapos join the Trading System");
  assert.equal(BROKER_COPY.h1, "Start small when you're ready"); assert.equal(BROKER_COPY_EN.h1, "Start small when you're ready");
  for (const c of [ACCM_COPY, ACCM_COPY_EN, BROKER_COPY, BROKER_COPY_EN]) for (const k of ["h1", "title"]) assert.ok(!/ACCM/.test(c[k]), `${c.path} ${k}`);
  assert.ok(!/ACCM/.test(JOIN_COPY.title + JOIN_COPY_EN.title));
  assert.match(read("src/app/accm/accm-guide.tsx"), /openGraph: \{\s*title: c\.title/);
  assert.match(read("src/app/broker/broker-guide.tsx"), /openGraph: \{\s*title: c\.title/);
});
await t("language switch + hreflang both ways on accm / broker / join", async () => {
  const pairs = [["src/app/accm/accm-guide.tsx", "/en/accm", "/accm"], ["src/app/broker/broker-guide.tsx", "/en/broker", "/broker"], ["src/app/system/join/join-view.tsx", "/en/system/join", "/system/join"]];
  for (const [f, en, tl] of pairs) assert.ok(read(f).includes(`enHref="${en}" tlHref="${tl}"`), f);
  for (const f of ["src/app/accm/accm-guide.tsx", "src/app/broker/broker-guide.tsx", "src/app/system/join/page.tsx", "src/app/en/system/join/page.tsx"]) {
    const s = read(f);
    assert.match(s, /languages: \{ en: "\/en\/[a-z/]+", "fil-PH": "\/[a-z/]+", "x-default": "\/[a-z/]+" \}/, f);
  }
  assert.match(read("src/components/academy/language-switch.tsx"), /enHref = EN, tlHref = TL/, "Gold Starter defaults kept");
});
await t("EN join door: login/signup return to /en/system/join; same actions; next loop guard", async () => {
  assert.equal(joinLoginPath("", "/en/system/join"), "/login?next=%2Fen%2Fsystem%2Fjoin");
  assert.equal(joinSignupPath("", "/en/system/join"), "/signup?next=%2Fen%2Fsystem%2Fjoin");
  assert.equal(joinPath("/courses/a/b", "/en/system/join"), "/en/system/join?next=%2Fcourses%2Fa%2Fb");
  assert.equal(joinBaseFrom("/en/system/join"), "/en/system/join");
  for (const bad of [null, "", "https://evil.test", "/en/system/joinx", "/login"]) assert.equal(joinBaseFrom(bad), "/system/join", String(bad));
  assert.equal(memberNext("/en/system/join"), MEMBERS_HOME);
  assert.equal(memberNext("/en/system/join?next=/x"), MEMBERS_HOME);
  const form = read("src/app/system/join/join-form.tsx");
  assert.equal(form.match(/<input type="hidden" name="join_base" value=\{base\} \/>/g)?.length, 2);
  assert.match(form, /import \{ joinConsent, submitAccessRequest, type JoinState, type RequestState \} from "\.\/actions";/);
  assert.ok(!fs.existsSync(path.join(root, "src/app/en/system/join/actions.ts")), "no second action file");
});

// ---- copy rules ----
await t("copy rules on all new / changed public copy: no VIP, PDE, income/profit/win-rate claims, free bot, demo first, internal names", async () => {
  const copy = JSON.stringify([ACCM_COPY, ACCM_COPY_EN, BROKER_COPY, BROKER_COPY_EN, JOIN_COPY, JOIN_COPY_EN, SYSTEM_UNDER_CTA_EN, SELF_CHECK_EN, SELF_CHECK_UI, ME.home, TRANSFER_COPY_EN])
    + ["src/app/page.tsx", "src/app/community/page.tsx", "src/app/start/page.tsx", "src/components/academy/accm-bridge.tsx", "src/app/training/page.tsx"].map(read).join("");
  for (const re of [/\bVIP\b/i, /\bPDE\b/, /win[- ]?rate/i, /\bincome\b/i, /free bot/i, /demo first/i, /\bJarvis\b/, /\bBen\b/]) assert.ok(!re.test(copy.replace(/\/\/.*$|\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/gm, "")), String(re));
  // "profit" / "guarantee" only as negations (risk disclaimers), never as a claim.
  for (const m of copy.matchAll(/[^.]*\b(profit|guarantee)[^.]*\./gi)) assert.match(m[0], /\b(no|not|walang|hindi|is profit guaranteed|guaranteed ba)\b|\?/i, m[0]);
  assert.ok(!/Discord community namin ay para sa/.test(read("src/app/community/page.tsx")), "no Discord-first block");
  assert.ok(!/NextStepLink/.test(read("src/app/page.tsx") + read("src/app/community/page.tsx") + read("src/app/start/page.tsx")), "Discord-first next step removed");
  assert.ok(!/makakasali ka rin sa GFX Society Discord/.test(read("src/components/academy/accm-bridge.tsx")), "Discord-promise paragraph deleted");
  assert.ok(!/Messenger/.test(copy.replace(/Wala kaming Messenger|We don't use Messenger/g, "")));
});
await t("EN copy objects carry no Taglish", async () => {
  const vals = (o) => (typeof o === "string" ? [o] : typeof o === "function" ? [o("x", "y")] : Object.values(o ?? {}).flatMap(vals));
  const en = JSON.stringify(vals([ACCM_COPY_EN, BROKER_COPY_EN, JOIN_COPY_EN, SYSTEM_UNDER_CTA_EN, SELF_CHECK_EN, SELF_CHECK_UI.en, REQUEST_COPY_EN, TRANSFER_COPY_EN]));
  for (const w of ["ang", "lang", "mo", "namin", "kung", "hindi", "pera", "laging", "muna", "ito", "sa", "mag-", "i-"]) assert.ok(!new RegExp(`(^|[\\s"(])${w}(?=[\\s".,)])`, "i").test(en), w);
});

// ---- docs G6 / G7 ----
await t("docs G6: purge bound says within / up to 8 days (Privacy v1.5), not 'after 7 days'; G7: cron monitoring note", async () => {
  const d = read("docs/accm-confirm-mailer.md");
  assert.ok(!/after 7 days/.test(d));
  assert.match(d, /purged within \(up to\) 8 days/);
  assert.match(d, /"within 8 days"[\s\S]*"up to 8\s+days"/);
  const p = read("src/content/legal/privacy-notice-v1.5.md");
  assert.ok(p.includes("within 8 days if it isn't") && p.includes("up to 8 days if you don't confirm it"), "Privacy v1.5 wording");
  assert.match(d, /### Monitoring the purge cron \(`purge_member_gate_logs`\)/);
  assert.match(d, /\[cron\/members-cleanup\] purge failed/);
  assert.ok(read("src/app/api/cron/members-cleanup/route.ts").includes('"[cron/members-cleanup] purge failed"'), "log line named in the doc exists");
});

console.log(`ALL PASS simplicity (${n})`);
