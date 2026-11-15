// Offline tests for the simplicity / UX sprint (design/trading-system/simplicity-review-spec.md v2 + Ben's decisions):
// one gold CTA per page (incl. /en/accm, /en/broker, /en/system/join), disclosures + risk line byte-identical to their
// sources on main, long /accm risk text inside the "Risk warning" expander, Signals card not a link and claim/date-free,
// EN J4 caption, copy rules, docs G6/G7. No network, no Supabase, no env reads.
// Run: node --experimental-strip-types scripts/test-simplicity.mjs   (Node >= 22.15; needs `git` with the pre-sprint base commit)
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
// "main" = the pre-sprint base (93117d5, main before PR #70): disclosures and risk texts must stay byte-identical to it.
const BASE_REF = "93117d5e1b0ca29efa00876b6ab2b48bca149701";
const main = (f) => execFileSync("git", ["show", `${BASE_REF}:${f}`], { cwd: root, encoding: "utf8" });
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
const { INCLUDED_NOTE, COMING_LATER_COURSE_NOTE, COURSES_LEDE } = await import("../src/config/training.ts");
const { MEMBERS_ONLY_HINT, SYSTEM_ROWS_SUMMARY } = await import("../src/content/members-gate.ts");
const ACCM_BRIDGE_DISCLOSURE_SRC = main("src/components/academy/accm-bridge.tsx").match(/export const ACCM_BRIDGE_DISCLOSURE =\s*`[^`]+`;/)[0];
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
// ---- QA P1-1 (39b865e) + P2-1 (bfd965d, PR55 rule): every public page with the gold Join, an ACCM CTA or an IB line
// shows the 1% sentence ("Max 1% risk per trade", case-sensitive as in QA's audit) exactly once and the education line
// (/Education (lang|only),? (not|hindi) financial advice/i) exactly once. Counted over the page's source literals
// (comments stripped) plus each render of a shared constant. The shared RISK_LINE is required except where noted.
const RISK_RE = /Max 1% risk per trade/g;
const EDU_RE = /Education (?:lang|only),? (?:not|hindi) financial advice/gi;
const stripC = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$|([^:"'`])\/\/[^"'`\n]*$/gm, "$1");
const count = (txt, re) => txt.match(re)?.length ?? 0;
const RISK_PAGES = [
  // route, page source files, rendered-text extras, regex for shared-line render sites (null = not required, with reason)
  { route: "/", files: ["src/app/page.tsx"], shared: /\{RISK_LINE\}/g },
  { route: "/community", files: ["src/app/community/page.tsx"], shared: /\{RISK_LINE\}/g },
  { route: "/start", files: ["src/app/start/page.tsx"], shared: /\{s\.risk\}/g },
  { route: "/academy", files: ["src/app/academy/page.tsx", "src/components/academy/accm-bridge.tsx"], shared: /\{RISK_LINE\}/g },
  { route: "/resources", files: ["src/app/resources/page.tsx"], shared: /\{RISK_LINE\}/g },
  { route: "/go/<code>", files: ["src/app/go/[code]/page.tsx"], shared: /\{RISK_LINE\}/g },
  { route: "/system/join", files: ["src/app/system/join/join-view.tsx"], extra: () => "", shared: /SYSTEM_COPY\.risk\}/g },
  // Design (pr70-review): the long risk box sits under the CTA; no second short line. The box carries both once.
  { route: "/broker", files: ["src/app/broker/broker-guide.tsx"], extra: () => Object.values(BROKER_COPY).filter((v) => typeof v === "string").join("\n"), shared: null },
  { route: "/en/broker", files: ["src/app/broker/broker-guide.tsx"], extra: () => Object.values(BROKER_COPY_EN).filter((v) => typeof v === "string").join("\n"), shared: null },
  // Has its own 1% line (local RISK_LINE) and the Disclaimer's education line; adding the shared line would double both.
  { route: "/academy/gold-starter", files: ["src/app/academy/gold-starter/page.tsx"], shared: null },
  // Follow-up PR (P2.6): /system renders SYSTEM_COPY.risk (=== RISK_LINE); /courses gets it from MembersFooter.
  { route: "/system", files: ["src/app/system/page.tsx"], extra: () => Object.values(SYSTEM_COPY).filter((v) => typeof v === "string").join("\n"), shared: null },
  { route: "/courses", files: ["src/app/courses/page.tsx", "src/components/training/members-footer.tsx"], extra: () => [INCLUDED_NOTE, COMING_LATER_COURSE_NOTE].join("\n"), shared: /\{RISK_LINE\}/g },
  // Variant B (en-gold-starter-risk-fix.md §1): one 1% sentence via RISK_LINE_EN, one NFA line in the Disclaimer.
  { route: "/en/academy/gold-starter", files: ["src/app/en/academy/gold-starter/page.tsx", "src/content/en-gold-starter.tsx"], shared: null },
];
for (const pg of RISK_PAGES) {
  await t(`${pg.route}: "Max 1% risk per trade" once, "not financial advice" once${pg.shared ? ", shared RISK_LINE rendered" : ""}`, async () => {
    const src = stripC(pg.files.map(read).join("\n"));
    const sharedN = pg.shared ? count(src, pg.shared) : 0;
    const txt = src + "\n" + (pg.extra?.() ?? "");
    const risk = count(txt, RISK_RE) + sharedN, edu = count(txt, EDU_RE) + sharedN;
    assert.equal(risk, 1, `${pg.route}: 1% sentence count`);
    assert.equal(edu, 1, `${pg.route}: education line count`);
    if (pg.shared) {
      assert.equal(sharedN, 1, "shared line rendered once");
      assert.ok(/SYSTEM_COPY\.risk/.test(src) || /import \{[^}]*\bRISK_LINE\b[^}]*\} from "@\/config\/training";/.test(src), "RISK_LINE imported, not retyped");
      assert.ok(!src.includes(RISK_LINE), "not retyped as a literal");
    }
  });
}
await t("/accm + /en/accm: visible 1% + education line once via RiskFooter compact; the long text only inside the expander", async () => {
  assert.match(read("src/app/accm/accm-guide.tsx"), /<RiskFooter compact=\{lang\} \/>/);
  const rf = read("src/components/academy/risk-footer.tsx");
  assert.match(rf, /<p data-testid="risk-line">\{compact === "en" \? RISK_LINE_EN_SHORT : RISK_LINE\}<\/p>/);
  assert.equal(count(stripC(read("src/app/accm/accm-guide.tsx")) + JSON.stringify(ACCM_COPY), RISK_RE), 0, "no other 1% sentence in the /accm copy");
  assert.equal(count(stripC(read("src/app/accm/accm-guide.tsx")) + JSON.stringify(ACCM_COPY), EDU_RE), 0);
});
await t("P2-1 fixes: /broker drops the extra short line; duplicates removed or trimmed with existing wording only", async () => {
  const b = read("src/app/broker/broker-guide.tsx");
  assert.ok(!/RISK_LINE/.test(b), "/broker: no shared short line (Design)");
  for (const c of [BROKER_COPY, BROKER_COPY_EN]) { assert.equal(count(c.riskBody, RISK_RE), 1); assert.equal(count(c.riskBody, EDU_RE), 1); }
  assert.match(read("src/app/start/page.tsx"), /note: IB_DISCLOSURE_TEXT,\s*risk: RISK_LINE,/);
  const trimmed = "Real risk of loss. Start small, laging may stop loss.";
  for (const f of ["src/app/start/page.tsx", "src/app/go/[code]/page.tsx"]) {
    assert.ok(main(f).includes("Education only, not financial advice. Real risk of loss. Start small, max 1% risk, laging may stop loss."), `${f} on main`);
    assert.ok(read(f).includes(trimmed), `${f}: only the non-duplicated part kept`);
  }
  assert.match(read("src/components/academy/accm-bridge.tsx"), /\{ACCM_BRIDGE_DISCLOSURE\}<\/p>\s*<p className="text-xs text-muted-foreground" data-testid="risk-line">\{RISK_LINE\}<\/p>\s*<\/section>/);
  assert.ok(read("src/components/academy/accm-bridge.tsx").includes(ACCM_BRIDGE_DISCLOSURE_SRC), "IB disclosure unchanged");
  assert.ok(!read("src/app/resources/page.tsx").includes("Education lang, not financial advice. Max 1% risk per trade."), "/resources: old duplicate removed");
  assert.ok(!/SHARED_RISK_LINE/.test(read("src/app/academy/gold-starter/page.tsx")));
});
await t("/community: RISK_LINE rendered next to the gold Join + IB line; meta description Join-first, not Discord-first", async () => {
  const c = read("src/app/community/page.tsx");
  assert.match(c, /\{JOIN_SYSTEM_CTA\}[\s\S]*?\{IB_DISCLOSURE_TEXT\}<\/p>\s*<p className="text-xs text-muted-foreground" data-testid="risk-line">\{RISK_LINE\}<\/p>/);
  const desc = c.match(/const DESC =\s*"([^"]+)"/)?.[1];
  assert.ok(desc && /join the Trading System/.test(desc) && !/Discord/i.test(desc), desc);
  assert.match(c, /description: DESC,[\s\S]*openGraph: \{[^}]*description: DESC/, "description and og:description share it");
  assert.ok(!/Discord/.test(c.replace(/\/\/.*$/gm, "")), "no Discord on /community");
});
await t("/go/<code>: one gold (Start learning), outline Join the Trading System -> /system/join, no Discord-first next step; IB + RISK_LINE", async () => {
  const g = read("src/app/go/[code]/page.tsx");
  assert.equal(golds(g), 1);
  assert.match(g, /variant: "default" \}\)\} min-h-11`\}>\s*Start learning →/);
  // Follow-up (QA P3-8): the Join link is a NextStepLink again, so next_step_click (location "go") fires.
  assert.match(g, /<NextStepLink\s+location="go"\s+href="\/system\/join"\s+className=\{cn\(buttonVariants\(\{ variant: "outline" \}\)[^>]*>\s*\{JOIN_SYSTEM_CTA\}\s*<\/NextStepLink>/);
  assert.ok(!/partner community|GO_NEXT_STEP_HREF/.test(g), "Discord-first next step removed");
  assert.match(g, /\{IB_DISCLOSURE_TEXT\}<\/p>\s*<p className="text-xs text-muted-foreground" data-testid="risk-line">\{RISK_LINE\}<\/p>/);
});
await t("P3-4: J4 FAQ on /accm + /en/accm says the template is there after you log in; rest of each answer byte-identical", async () => {
  const j4 = (c) => c.faq.find((f) => f.a.includes("For Transfer IB")).a;
  const PH_OLD = "I-email ang ACCM from the email na naka-register mo sa ACCM. Ang template ay nasa Join the Trading System (May problema?). To: csse@accmfx.com, roselle@accmfx.com. Subject: For Transfer IB. Huwag mag-open ng second account. Hindi namin ma-promise kung gaano katagal — naka-depende ito sa ACCM.";
  const EN_OLD = "Email ACCM from the email registered with ACCM. The template is on Join the Trading System (Having trouble?). To: csse@accmfx.com, roselle@accmfx.com. Subject: For Transfer IB. Don't open a second account. We can't promise how long the transfer will take — timing depends on ACCM.";
  assert.ok(j4(ACCM_COPY).includes('sa "May problema?" sa Join the Trading System page, pagka-log in mo.'));
  assert.ok(j4(ACCM_COPY_EN).includes('under "Having trouble?" on the Join the Trading System page, after you log in.'));
  assert.equal(j4(ACCM_COPY), PH_OLD.replace("nasa Join the Trading System (May problema?).", 'nasa "May problema?" sa Join the Trading System page, pagka-log in mo.'));
  assert.equal(j4(ACCM_COPY_EN), EN_OLD.replace("on Join the Trading System (Having trouble?).", 'under "Having trouble?" on the Join the Trading System page, after you log in.'));
});
await t("Design (2): EN min deposit = PH facts; 'Long-press to copy' kept with the visible Copy chip; sr-only ' (opens in a new tab)' leading space", async () => {
  const facts = (x) => x.match(/^Min deposit \$50 · GCash, Maya, other e-wallets\./)?.[0];
  assert.ok(facts(SELF_CHECK_UI.tl.minDeposit) && facts(SELF_CHECK_UI.en.minDeposit) === facts(SELF_CHECK_UI.tl.minDeposit));
  assert.equal(SELF_CHECK_UI.en.manual, "Long-press to copy");
  assert.match(read("src/app/accm/accm-self-check.tsx"), /aria-label=\{`Copy invitation code \$\{CODE\}`\}[\s\S]*?Code: \{CODE\} ⧉/);
  assert.ok(read("src/components/funnel/discord-apply-link.tsx").includes('lang === "en" ? " (opens in a new tab)" :'));
});
await t("P3-7: cron route comment covers both purges (1-day logs + ACCM 8-day bound)", async () => {
  const r = read("src/app/api/cron/members-cleanup/route.ts");
  assert.ok(r.includes("purge_member_gate_logs") && r.includes("purge_stale_accm_emails") && r.includes("up to 8 days") && r.includes("Monitoring the purge cron"));
  assert.ok(!r.includes("so the 1-day retention holds without the cron"));
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

// ======== Follow-up PR (simplicity-followup): P2.6, P3, /broker link, P3-8, gold-starter, P3-6 ========
await t("P2.6 /system: compact; one gold = Join the Trading System; rows in one closed expander; members-only line, RISK_LINE x1, IB line", async () => {
  const s = read("src/app/system/page.tsx");
  assert.equal(golds(s), 1);
  assert.match(s, /<Link href="\/system\/join" className=\{cn\(buttonVariants\(\{ variant: "default" \}\)[^>]*>\s*\{JOIN_SYSTEM_CTA\}/);
  assert.match(s, /<Expander summary=\{SYSTEM_ROWS_SUMMARY\} testId="system-rows">[\s\S]*C\.rows\.map[\s\S]*<\/Expander>/);
  assert.ok(!/<Expander[^>]*open/.test(s), "rows closed by default");
  assert.match(s, /\{C\.underCta\}/); assert.equal(s.match(/\{C\.risk\}/g)?.length, 1); assert.match(s, /\{IB_DISCLOSURE_TEXT\}/);
  assert.equal(SYSTEM_COPY.risk, RISK_LINE);
  assert.ok(!("joinCta" in SYSTEM_COPY), "old 'Join as member' CTA retired (Design: swap to JOIN_SYSTEM_CTA)");
  const m = main("src/content/members-gate.ts");
  for (const k of ["title", "intro", "underCta"]) assert.ok(m.includes(JSON.stringify(SYSTEM_COPY[k]).slice(1, -1)), `SYSTEM_COPY.${k} unchanged`);
  for (const row of SYSTEM_COPY.rows) assert.ok(m.includes(row.body), "row copy unchanged");
  assert.equal(SYSTEM_ROWS_SUMMARY, "Ano ang kasama?");
});
await t("P2.6 /courses: compact cards (title, chip, price, action); notes under a closed Learn more; 24px padding; gold logic unchanged", async () => {
  const c = read("src/app/courses/page.tsx");
  assert.ok(!/catalog\.forWho|catalog\.included/.test(c), "who-it's-for + included list only on /courses/<slug>");
  assert.match(read("src/app/courses/[slug]/page.tsx"), /catalog\.forWho[\s\S]*catalog\.included\.map/);
  assert.match(c, /<Expander summary="Learn more" testId="courses-learn-more">\s*<p>\{INCLUDED_NOTE\}<\/p>\s*<p>\{COMING_LATER_COURSE_NOTE\}<\/p>\s*<\/Expander>\s*<MembersFooter \/>/);
  assert.match(c, /max-w-\[640px\] flex-1 flex-col gap-6 px-6/);
  assert.match(c, /text-muted-foreground">\{COURSES_LEDE\.ph\}<\/p>/);
  assert.equal(COURSES_LEDE.ph, "Self-paced, Taglish.");
  assert.equal(COURSES_LEDE.en, "Self-paced. Lessons in Taglish for now.");
  // PH line on PH pages only: nothing under src/app/en (or EN copy files) uses the PH lede or COURSES_LEDE.ph.
  const enFiles = execFileSync("git", ["ls-files", "src/app/en", "src/content"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => /\.(tsx?|mjs)$/.test(f));
  for (const f of enFiles) {
    const src = read(f);
    if (f.startsWith("src/app/en/") || /_EN\b|\ben\b/.test(f)) assert.ok(!src.includes("Self-paced, Taglish.") && !src.includes("COURSES_LEDE.ph"), `${f}: no PH lede on /en`);
  }
  assert.ok(!read("src/app/courses/page.tsx").includes("COURSES_LEDE.en"), "PH /courses uses the PH lede");
  assert.equal(c.match(/COMING_LATER_COURSE_NOTE\}/g)?.length, 1, "coming-later line once");
  assert.equal(main("src/app/courses/page.tsx").match(/function pickGold[\s\S]*?\n\}/)[0], c.match(/function pickGold[\s\S]*?\n\}/)[0], "pickGold unchanged");
});
await t("P2.6 /account: Delete copy + form in a closed <details>, wording unchanged; risk line once (MembersFooter for members, own line otherwise)", async () => {
  const a = read("src/app/account/page.tsx");
  assert.match(a, /<Expander summary="Delete my account" heading testId="delete-account"[^>]*>[\s\S]*<DeleteAccountForm \/>\s*<\/Expander>/);
  const words = (x) => x.replace(/<[^>]+>|\{" "\}/g, " ").replace(/\s+/g, " ");
  for (const frag of ["Ide-delete nito agad ang account mo at ang Academy data mo: profile, lesson progress, quiz attempts, diagnostic results at activity events. Hindi na ito maibabalik.",
    "Itatago lang namin ang consent record mo (anong boxes ang na-tick mo at kailan) nang 3 years, naka-link lang sa one-way hash ng email mo, bilang proof of consent, as described in the"]) {
    assert.ok(words(main("src/app/account/page.tsx")).includes(frag) && words(a).includes(frag), frag.slice(0, 40));
  }
  assert.equal(a.match(/data-testid="risk-line">\{RISK_LINE\}/g)?.length, 2, "logged-out view + non-member view");
  assert.match(a, /\{showMembersNav\(membership\) \? null : \(\s*<p className="text-xs text-muted-foreground" data-testid="risk-line">\{RISK_LINE\}<\/p>/, "own line only when MembersFooter is not shown");
});
await t("P3 type/spacing pass (Appendix G): H1 24px inner / 30px landing, H2 18px, 24px page padding, 16px card padding, 12px radius", async () => {
  const gs = read("src/app/academy/gold-starter/page.tsx");
  assert.match(gs, /flex-col gap-8 px-6 py-6/); assert.ok(!/text-xl font-semibold/.test(gs), "gold-starter H2 18px");
  assert.match(read("src/app/go/[code]/page.tsx"), /<h1 className="text-2xl font-bold tracking-tight">Welcome to GFX Society<\/h1>/);
  assert.match(read("src/app/start/page.tsx"), /bg-amber-500\/10 p-4 text-sm/);
  assert.match(read("src/app/accm/accm-guide.tsx"), /<details key=\{f\.q\} className="rounded-lg border border-border px-4">/);
  assert.match(read("src/app/courses/page.tsx"), /<h2 className="text-lg font-semibold">/);
  assert.equal(read("src/components/compliance/ib-disclosure.tsx"), read_at("a141f8f4d09dbf677cc86c3d13924c566649e744", "src/components/compliance/ib-disclosure.tsx"), "IB disclosure file byte-identical (not part of the type pass)");
  assert.equal(read("src/app/signup/page.tsx"), read_at("a141f8f4d09dbf677cc86c3d13924c566649e744", "src/app/signup/page.tsx"), "/signup (required consent) untouched");
});
function read_at(ref, f) { return execFileSync("git", ["show", `${ref}:${f}`], { cwd: root, encoding: "utf8" }); }
await t("/broker link: muted text link on /resources, /accm and /en/accm (Design P2 note); never gold, not in the bottom nav", async () => {
  const res = read("src/app/resources/page.tsx");
  assert.match(res, /<Link href="\/broker" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline" data-testid="broker-link">\s*Choosing a broker →\s*<\/Link>/);
  assert.match(read("src/app/accm/accm-guide.tsx"), /<Link href=\{c\.brokerHref\} className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline" data-testid="broker-link">\s*\{c\.brokerLink\}/);
  assert.equal(ACCM_COPY.brokerHref, "/broker"); assert.equal(ACCM_COPY_EN.brokerHref, "/en/broker");
  assert.equal(ACCM_COPY.brokerLink, "Choosing a broker →"); assert.equal(ACCM_COPY_EN.brokerLink, "Choosing a broker →");
  assert.ok(!/broker/i.test(read("src/components/layout/bottom-nav.tsx")), "bottom nav unchanged (5 items at 360px)");
  assert.equal(golds(res), 0);
});
await t("P3-8: next_step_click restored on /go Join (NextStepLink, fixed location label); event props carry no PII", async () => {
  const n = read("src/components/funnel/next-step-link.tsx");
  assert.match(n, /onClick=\{\(\) => gfxEvent\("next_step_click", \{ location \}\)\}/);
  assert.match(n, /href = NEXT_STEP_HREF,/);
  const { safeProps } = await import("../src/lib/analytics/events.ts");
  assert.deepEqual(safeProps({ location: "go", utm_source: "instagram", utm_content: "fb261012_lotsize", a: "me@example.test", b: "09171234567" }),
    { location: "go", utm_source: "instagram", utm_content: "fb261012_lotsize" });
  assert.match(read("src/lib/analytics/events.ts"), /track\(name, safeProps\(\{ \.\.\.firstTouch\(\), \.\.\.props \}\)\)/);
  assert.ok(!/GO_NEXT_STEP_HREF|NEXT_STEP_HREF/.test(read("src/lib/links/go-codes.ts")), "unused GO_NEXT_STEP_HREF removed");
});
await t("/academy/gold-starter: next-step copy (Design PR71) is Join-first (outline Join -> /system/join, then the ACCM steps link); one gold (Lesson 1)", async () => {
  const gs = read("src/app/academy/gold-starter/page.tsx");
  const sec = gs.match(/data-testid="gold-starter-next">([\s\S]*?)<\/section>/)[1];
  assert.match(sec, /<p data-testid="gold-starter-next-copy">\s*Kapag ready ka na, puwede kang mag-join sa Trading System\. Sa ngayon, focus muna sa Starter Kit at Lesson 1\.\s*<\/p>/);
  assert.ok(!/Para sa later/.test(sec), "old 'Para sa later' copy gone");
  const iJoin = sec.indexOf('href="/system/join"'), iSteps = sec.indexOf("Tingnan ang steps →");
  assert.ok(iJoin > 0 && iSteps > iJoin, "Join before the steps link");
  assert.match(sec, /variant: "outline"/); assert.ok(!/variant: "default"/.test(sec), "not gold");
  assert.ok(!/partner community|Discord/i.test(sec), "not Discord-first");
  assert.match(sec, /\{IB_DISCLOSURE_TEXT\}/);
  const implicitGold = gs.match(/buttonVariants\(\{ size: "lg" \}\)/g)?.length ?? 0; // default variant = gold
  assert.equal(golds(gs) + implicitGold, 1);
});
await t("P3-6: members-only hint before the Join click on Home (minimal), /start step 4, /community, gold-starter", async () => {
  assert.equal(MEMBERS_ONLY_HINT, "Members-only ang Trading System.");
  const home = read("src/app/page.tsx");
  assert.ok(home.indexOf("{MEMBERS_ONLY_HINT}") > home.indexOf("{JOIN_SYSTEM_CTA}") && home.indexOf("{MEMBERS_ONLY_HINT}") < home.indexOf("No signup needed to learn."), "Home: one short line right under the buttons");
  assert.equal(home.match(/MEMBERS_ONLY_HINT\}/g)?.length, 1);
  assert.match(read("src/app/start/page.tsx"), /\{s\.n === 4 \? <p className="mt-1 text-xs text-muted-foreground" data-testid="members-only-hint">\{MEMBERS_ONLY_HINT\}<\/p> : null\}/);
  const c = read("src/app/community/page.tsx");
  assert.ok(c.indexOf("{MEMBERS_ONLY_HINT}") > 0 && c.indexOf("{MEMBERS_ONLY_HINT}") < c.indexOf("{JOIN_SYSTEM_CTA}"), "/community: before the gold Join");
  assert.ok(read("src/app/academy/gold-starter/page.tsx").includes("{MEMBERS_ONLY_HINT}"));
});
await t("QA P3-5 stays closed: /community risk line asserted here and in simplicity-e2e", async () => {
  assert.ok(RISK_PAGES.some((p) => p.route === "/community" && p.shared));
  assert.match(read("scripts/qa/simplicity-e2e.mjs"), /slug: "community", path: "\/community", gold: JOIN, risk: RISK_LINE/);
});

// ======== /en/academy/gold-starter Variant B (cents-first), en-gold-starter-risk-fix.md §1 ========
// .tsx copy module: transpile with the same helper approach as RiskFooter above (JSX values -> React elements).
const loadEnGs = () => {
  const code = ts.transpileModule(read("src/content/en-gold-starter.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    .replace(/require\("([^."/@][^"]*|@[^/"]+\/[^"]+)"\)/g, (_, m) => `require(${JSON.stringify(require.resolve(m))})`);
  const f = path.join(tmp, "content/en-gold-starter.js");
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, code);
  return require(f);
};
await t("/en/academy/gold-starter Variant B: exact strings; Disclaimer byte-intact; extra NFA paragraph removed; one mode only", async () => {
  const G = loadEnGs();
  assert.equal(G.RISK_LINE_EN, "If you trade, start small with a cents account: only money you can afford to lose. Max 1% risk per trade, always with a stop loss.");
  assert.equal(G.BOX.items[1], "Start small with a cents account: real money, but only small amounts you can afford to lose, always with a stop loss.");
  const DISC = "Trading involves a real risk of loss. GoldFX Global is an education project of GFX Society. Education only, not financial advice. If you trade, start small (e.g. a cents account), max 1% risk per trade, always with a stop loss.";
  assert.equal(G.DISCLAIMER, DISC);
  assert.ok(main("src/content/en-gold-starter.tsx").includes(`const DISCLAIMER_NO_DEMO =\n  "${DISC}";`), "same bytes as the pre-sprint live Disclaimer");
  const faq = G.FAQ.find((f) => f.q === "Where should I trade?");
  assert.equal(faq.a, "Lesson 3 explains how cents accounts work, if you want to try small real money you can afford to lose. A free MT5 demo is optional, only to learn the buttons. You'll learn how to check a broker's licence yourself.");
  assert.equal(faq.ib, true);
  assert.ok(!("RISK_MODE" in G), "demo_first switch removed");
  const pg = read("src/app/en/academy/gold-starter/page.tsx");
  assert.ok(!pg.includes("<p className=\"mt-1\">Education only, not financial advice.</p>"), "golden-rule NFA paragraph removed");
  assert.match(pg, /<strong>\{RISK_LINE_EN\}<\/strong>/);
  assert.match(pg, /<strong>Disclaimer:<\/strong> \{DISCLAIMER\}/);
});
await t("/en/academy/gold-starter: byte-identical IB line under the 'Where should I trade?' answer", async () => {
  const pg = read("src/app/en/academy/gold-starter/page.tsx");
  assert.match(pg, /\{"ib" in f && f\.ib \? \(\s*<p className="pb-3 text-xs text-muted-foreground" data-testid="faq-ib-line">\{IB_DISCLOSURE_TEXT_EN\}<\/p>/);
  assert.match(pg, /import \{ IB_DISCLOSURE_TEXT_EN \} from "@\/config\/partners";/);
  assert.equal(IB_DISCLOSURE_TEXT_EN, "ACCM is GFX's partner broker.");
});
await t("No demo-first wording in EN site copy (/en pages, EN content, *_EN copy objects)", async () => {
  const DEMO_FIRST = /demo first|demo-first|start on a demo|practi[cs]e on a demo|on your demo|demo account first|demo muna/i;
  const files = execFileSync("git", ["ls-files", "src/app/en", "src/content", "src/config"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => /\.(tsx?|md)$/.test(f));
  for (const f of files) {
    const src = stripC(read(f)).replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!DEMO_FIRST.test(src), `${f}: ${src.match(new RegExp(`.{0,40}(${DEMO_FIRST.source}).{0,40}`, "i"))?.[0]}`);
  }
  const G = loadEnGs();
  const all = JSON.stringify([G.RISK_LINE_EN, G.BOX.items.filter((x) => typeof x === "string"), G.FAQ, G.DISCLAIMER]);
  assert.ok(!DEMO_FIRST.test(all));
});
// ======== lesson-end-buttons (en-gold-starter-risk-fix.md §2) + QA P3-10 / P3-12 ========
await t("LessonNav: one mid-course label 'Next lesson →' (no 'Start {level} →'); last Academy lesson = gold Join -> /system/join", async () => {
  const n = read("src/components/academy/lesson-nav.tsx");
  assert.ok(!/Start \{nextLevelTitle\}|Next module|partner community|guided training|sumali sa\s+Discord/.test(n), "old labels / Discord-first copy gone");
  assert.equal(n.match(/<span className="text-base font-semibold">Next lesson →<\/span>/g)?.length, 2, "level-end + mid-level both 'Next lesson →'");
  assert.match(n, /<NextStepLink\s+location="academy_complete"\s+href="\/system\/join"\s+className=\{cn\(buttonVariants\(\{ variant: "default" \}\)[^>]*>\s*\{JOIN_SYSTEM_CTA\}\s*<\/NextStepLink>/);
  assert.match(n, /\{MEMBERS_ONLY_HINT\}<\/p>\s*\{\/\*[^]*?\*\/\}\s*<NextStepLink\s+location="academy_complete"/, "hint before the Join");
  assert.ok(n.includes("{IB_DISCLOSURE_TEXT}"));
  // Each branch renders exactly one gold: level-end box (next) | Academy-complete box | mid-level link.
  assert.equal(n.match(/variant: "default"/g)?.length, 2, "NEXT_GOLD + Join");
});
await t("LessonHelp: Discord only as a muted 'Apply to join our Discord →' (approved /accm label) under closed 'May problema?', with the IB line", async () => {
  const n = read("src/components/academy/lesson-nav.tsx");
  const h = n.slice(n.indexOf("export function LessonHelp"), n.indexOf("export function LessonNav"));
  assert.match(h, /<Expander summary=\{JOIN_COPY\.helpSummary\} testId="lesson-help">/);
  assert.match(h, /<NextStepLink location="lesson_help" className="inline-flex min-h-11 items-center self-start underline">\s*\{ACCM_COPY\.discordCta\}/);
  assert.ok(!/variant/.test(h), "not a button");
  assert.match(h, /\{IB_DISCLOSURE_TEXT\}/);
  assert.equal(ACCM_COPY.discordCta, "Apply to join our Discord →"); assert.equal(ACCM_COPY_EN.discordCta, "Apply to join our Discord →");
  assert.equal(JOIN_COPY.helpSummary, "May problema?");
  const lp = read("src/app/academy/[levelSlug]/[lessonSlug]/page.tsx");
  assert.equal(lp.match(/<LessonHelp \/>/g)?.length, 1, "one help expander on every lesson");
  assert.ok(!/DiscordAfterAccmReminder|afterPrimary=/.test(lp), "Discord reminder cards removed from lessons");
  assert.ok(!fs.existsSync(path.join(root, "src/components/funnel/discord-after-accm-reminder.tsx")), "unused reminder component deleted");
});
await t("Training lesson ends: 'Next lesson →' (no 'Next module →'); Gold Reset last = gold Join + muted Back; GSB/GAS last -> capstone; capstone has the one gold Join", async () => {
  const c = read("src/app/courses/[slug]/[lessonSlug]/page.tsx");
  assert.ok(!/Next module →|Go to capstone/.test(c));
  assert.match(c, /className=\{nextGold\} data-testid="lesson-next">\s*<span className="text-base font-semibold">Next lesson →<\/span>\s*<span className="text-sm opacity-80">\{next\.title\}<\/span>/);
  assert.match(c, /<Link href=\{`\/courses\/\$\{slug\}\/capstone`\} className=\{nextGold\} data-testid="lesson-next">\s*<span className="text-base font-semibold">Next lesson →<\/span>\s*<span className="text-sm opacity-80">Capstone<\/span>/);
  assert.match(c, /<Link href="\/system\/join" className=\{gold\} data-testid="lesson-join">\s*\{JOIN_SYSTEM_CTA\}/);
  assert.match(c, /className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">\s*Back to Gold Reset/);
  assert.match(c, /Next module \(pass the quiz first\)/, "locked state unchanged (outline, disabled)");
  const cap = read("src/app/courses/[slug]/capstone/page.tsx");
  assert.equal(golds(cap), 1);
  assert.match(cap, /<Link href="\/system\/join" className=\{cn\(buttonVariants\(\{ variant: "default" \}\), "min-h-11 w-full"\)\} data-testid="capstone-join">\s*\{JOIN_SYSTEM_CTA\}/);
  assert.match(cap, /<ContentDisclaimerFooter disclaimer=\{cap\?\.disclaimer\} \/>/, "risk/NFA via the content disclaimer (or MembersFooter), unchanged");
  assert.ok(!/IB_DISCLOSURE/.test(c + cap), "no IB line in the members area");
});
await t("QA P3-10: gold-starter Join and 'Tingnan ang steps' log distinct next_step_click locations", async () => {
  const gs = read("src/app/academy/gold-starter/page.tsx");
  assert.match(gs, /<NextStepLink\s+location="gold_starter_join"\s+href="\/system\/join"/);
  assert.match(gs, /<NextStepLink location="gold_starter_steps" className="inline-flex min-h-11 items-center self-start font-medium underline">\s*Tingnan ang steps →/);
  assert.ok(!/location="gold_starter"/.test(gs));
  const nsl = read("src/components/funnel/next-step-link.tsx");
  for (const l of ["gold_starter_join", "gold_starter_steps", "lesson_help", "academy_complete"]) assert.ok(nsl.includes(`| "${l}"`), l);
  const { safeProps } = await import("../src/lib/analytics/events.ts");
  assert.deepEqual(safeProps({ location: "gold_starter_join", x: "a@b.test" }), { location: "gold_starter_join" }, "PII filter kept");
});
await t("QA P3-12: collapsed /account delete section keeps an h2 'Delete my account' inside <summary>", async () => {
  assert.match(read("src/components/layout/expander.tsx"), /\{heading \? <h2 className="text-sm font-medium">\{summary\}<\/h2> : summary\}/);
  assert.match(read("src/app/account/page.tsx"), /<Expander summary="Delete my account" heading testId="delete-account"/);
});

console.log(`ALL PASS simplicity (${n})`);
