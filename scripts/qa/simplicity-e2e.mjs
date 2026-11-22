// 360px + 414px layout/copy checks + screenshots for the simplicity sprint (simplicity-review-spec.md v2). Fully
// offline: a local fake Supabase on 127.0.0.1:54329 with fake users only (same approach as join-360-e2e.mjs).
// 1) NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build
// 2) npx next start -p 3093   3) BASE=http://127.0.0.1:3093 node scripts/qa/simplicity-e2e.mjs [--out <dir>]
//    (needs puppeteer-core + Chrome; CHROME=/path overrides /usr/bin/google-chrome)
import http from "node:http";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://127.0.0.1:3093";
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (ok, label, extra = "") => { if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", label, ok ? "" : extra); };

const RISK_LINE = "Max 1% risk per trade. Education lang, not financial advice.";
const RISK_EN = "Max 1% risk per trade. Education only, not financial advice.";
const IB = "Partner broker ng GFX ang ACCM.";
const IB_EN = "ACCM is GFX's partner broker.";
const LONG = "GFX Society provides trading education only — not financial advice.";
const JOIN = "Join the Trading System";
// PR55 P2-1 rule, same counters as QA's risk-audit: once each per page, in visible text.
const RISK_RE = /Max 1% risk per trade/g;
const EDU_RE = /Education (?:lang|only),? (?:not|hindi) financial advice/gi;
const cnt = (t, re) => (t.replace(/\s+/g, " ").match(re) || []).length;

// ---- fake Supabase (fake ids / example.test only) ----
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
// Sprint 3 tiers: "fresh" = consented Explorer (join-v2 on file); "explorer" = signed in, confirmed, no consent yet.
// Post-migration DB answers: Gold Reset is 'free' for members and consented Explorers only.
const SCN = { member: { member: true }, fresh: { member: false, consent: true }, explorer: { member: false, consent: false } };
const goldReset = (s) => Boolean(s && (s.member || s.consent));
const LESSONS = [
  { id: "l1", slug: "lesson-1", title: "Example lesson 1", sort: 1, training_modules: { sort: 1, title: "Example module", slug: "m1", learning_goal: null } },
  { id: "l2", slug: "lesson-2", title: "Example lesson 2", sort: 2, training_modules: { sort: 1, title: "Example module", slug: "m1", learning_goal: null } },
];
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const tok = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    let scn = null;
    try { scn = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()).scn; } catch { /* anon */ }
    const s = SCN[scn];
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.url.startsWith("/auth/v1/user")) {
      if (!s) return send(401, { code: 401, msg: "no" });
      return send(200, { id: "11111111-1111-1111-1111-111111111111", aud: "authenticated", role: "authenticated", email: "learner@example.test",
        email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" });
    }
    if (req.url.startsWith("/rest/v1/consent_records")) { res.writeHead(200, { "content-type": "application/json", "content-range": "0-0/1" }); return res.end("[]"); }
    if (req.url.startsWith("/rest/v1/training_lessons")) return send(200, goldReset(s) ? LESSONS : []);
    if (req.url.startsWith("/rest/v1/training_progress")) return send(200, goldReset(s) ? [{ lesson_id: "l1", completed_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z", quiz_score: null }] : []);
    if (/^\/rest\/v1\/(profiles|member_status|training_capstones|capstone_progress)/.test(req.url)) return send(200, []);
    const m = req.url.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      if (m[1] === "my_membership") return send(200, s?.member ? "active" : "none");
      if (m[1] === "my_payment_info") {
        const slug = JSON.parse(body || "{}").p_course_slug;
        if (slug === "gold-reset") return send(200, goldReset(s) ? { state: "free", course_id: "c-gold-reset", price_php: 0 } : { state: "not_member" });
        return send(200, s?.member ? { state: "not_found" } : { state: "not_member" });
      }
      if (m[1] === "my_join_state") return send(200, s ? { consent: s.member || s.consent, request: null } : null);
      if (m[1] === "record_member_consent") return send(200, "no_match");
    }
    send(404, {});
  });
});
await new Promise((r) => mock.listen(54329, "127.0.0.1", r));

const sessionCookie = (scn) => {
  const now = Math.floor(Date.now() / 1000);
  const access = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: "11111111-1111-1111-1111-111111111111", role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now, scn })}.fakesig`;
  const session = { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "fake-refresh",
    user: { id: "11111111-1111-1111-1111-111111111111", aud: "authenticated", role: "authenticated", email: "learner@example.test" } };
  return { name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url: BASE };
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const ctx = await browser.createBrowserContext();
const open = async (path, width, scn, { noJs = false } = {}) => {
  for (const c of await ctx.cookies()) await ctx.deleteCookie(c);
  if (scn) await ctx.setCookie(sessionCookie(scn));
  const page = await ctx.newPage();
  if (noJs) await page.setJavaScriptEnabled(false); // /go/<code> client-redirects to /academy after 1.5 s
  await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
};

// Gold = computed background of the primary token (#d4a017), visible, in <main>.
async function measure(page) {
  return page.evaluate(() => {
    const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const main = document.querySelector("main") ?? document.body;
    const all = [...main.querySelectorAll("*")].filter(vis);
    const gold = all.filter((el) => getComputedStyle(el).backgroundColor === "rgb(212, 160, 23)").map((el) => el.textContent.trim());
    const small = [];
    for (const el of main.querySelectorAll("a, button, input, summary")) {
      if (!vis(el) || el.type === "hidden") continue;
      const target = el.type === "checkbox" ? el.closest("label") ?? el : el;
      const h = target.getBoundingClientRect().height;
      if (h < 43.5 && !(el.tagName === "A" && el.closest("p, li") && el.closest("p, li").textContent.trim() !== el.textContent.trim() && document.body.dataset.inlineOk)) small.push(`${el.tagName}:${(el.textContent || el.type || "").trim().slice(0, 30)}:${Math.round(h)}`);
    }
    // Text inside closed <details> (not visible until opened), counted separately from visible text.
    const hidden = [...main.querySelectorAll("details:not([open])")].map((d) => [...d.childNodes].filter((n) => n.nodeName !== "SUMMARY").map((n) => n.textContent).join(" ")).join(" ");
    const accmCta = [...main.querySelectorAll("a, button")].filter(vis).filter((e) => /accm|accmfx/i.test(e.getAttribute("href") || "") || /ACCM/.test(e.textContent || "")).length;
    return { sw: document.documentElement.scrollWidth, vw: window.innerWidth, gold, small, text: main.innerText, hidden, accmCta, lang: main.querySelector("[lang]")?.getAttribute("lang") ?? null };
  });
}

const PAGES = [
  { slug: "home", path: "/", gold: JOIN, risk: RISK_LINE, ib: IB, ibMuted: true },
  { slug: "member-home", path: "/training", scn: "member", gold: "Ituloy →", risk: RISK_LINE, noIb: true },
  { slug: "accm", path: "/accm", gold: JOIN, risk: RISK_LINE, ib: IB, lang: "fil" },
  { slug: "en-accm", path: "/en/accm", gold: JOIN, risk: RISK_EN, ib: IB_EN, lang: "en" },
  { slug: "broker", path: "/broker", gold: JOIN, ib: IB, lang: "fil", noShared: true },
  { slug: "en-broker", path: "/en/broker", gold: JOIN, ib: IB_EN, lang: "en", noShared: true },
  { slug: "system-join", path: "/system/join", gold: "Log in with your Academy account", risk: RISK_LINE, ib: IB, lang: "fil" },
  { slug: "en-system-join", path: "/en/system/join", gold: "Log in with your Academy account", risk: RISK_EN, ib: IB_EN, lang: "en" },
  { slug: "academy", path: "/academy", gold: JOIN, risk: RISK_LINE, ib: IB, shot: false },
  { slug: "start", path: "/start", gold: JOIN, risk: RISK_LINE, ib: IB, shot: false },
  { slug: "community", path: "/community", gold: JOIN, risk: RISK_LINE, ib: IB },
  { slug: "gold-starter", path: "/academy/gold-starter", gold: "Simulan ang Lesson 1", ib: IB, noShared: true },
  { slug: "resources", path: "/resources", gold: null, risk: RISK_LINE, ib: IB },
  { slug: "go", path: "/go/ig_bio", gold: "Start learning", risk: RISK_LINE, ib: IB, noJs: true, outline: JOIN },
  // Variant B (en-gold-starter-risk-fix.md §1): own risk sentence (RISK_LINE_EN) + Disclaimer carry both once.
  { slug: "en-gold-starter", path: "/en/academy/gold-starter", gold: "Start Day 1", lang: "en", noShared: true },
  // Follow-up PR (P2.6): compact /system, /courses, /account.
  { slug: "system", path: "/system", gold: JOIN, risk: RISK_LINE, ib: IB, lang: "fil" },
  { slug: "courses", path: "/courses", gold: null, risk: RISK_LINE },
  { slug: "courses-member", path: "/courses", scn: "member", gold: null, risk: RISK_LINE },
  { slug: "account", inlineOk: true, path: "/account", gold: null, risk: RISK_LINE },
  { slug: "account-member", inlineOk: true, path: "/account", scn: "member", gold: null, risk: RISK_LINE },
  { slug: "account-fresh", inlineOk: true, path: "/account", scn: "fresh", gold: null, risk: RISK_LINE },
  // Sprint 3 (explorer-linked-tiers-spec v1.1): Explorer home + /courses, one gold each.
  { slug: "explorer-home", path: "/training", scn: "explorer", gold: "Ituloy →", risk: RISK_LINE, noIb: true },
  { slug: "explorer-home-consented", path: "/training", scn: "fresh", gold: "Ituloy →", risk: RISK_LINE, noIb: true },
  { slug: "courses-explorer", path: "/courses", scn: "explorer", gold: null, risk: RISK_LINE, noIb: true },
  { slug: "courses-explorer-consented", path: "/courses", scn: "fresh", gold: null, risk: RISK_LINE, noIb: true },
];

try {
  for (const width of [360, 414]) {
    for (const pg of PAGES) {
      const L = `${width} ${pg.path}${pg.scn ? ` (${pg.scn})` : ""}`;
      const p = await open(pg.path, width, pg.scn, { noJs: pg.noJs });
      if (pg.inlineOk) await p.evaluate(() => { document.body.dataset.inlineOk = "1"; }); // WCAG 2.5.8 inline-link exception
      const r = await measure(p);
      check(r.sw <= width, `${L}: no horizontal scroll`, `scrollWidth=${r.sw}`);
      if (pg.gold) check(r.gold.length === 1 && r.gold[0].startsWith(pg.gold), `${L}: exactly one gold, "${pg.gold}"`, JSON.stringify(r.gold));
      else check(r.gold.length <= 1, `${L}: at most one gold`, JSON.stringify(r.gold));
      if (pg.slug !== "member-home") {
        check(cnt(r.text, RISK_RE) === 1 && cnt(r.text, EDU_RE) === 1, `${L}: "Max 1% risk per trade" x1 and "not financial advice" x1 (visible)`, `risk=${cnt(r.text, RISK_RE)} edu=${cnt(r.text, EDU_RE)}`);
        if (pg.noShared) check(!r.text.includes(RISK_LINE) && !r.text.includes(RISK_EN), `${L}: no extra shared short line (own risk text carries both)`);
        console.log(`INFO ${L}: hidden (closed expanders) risk=${cnt(r.hidden, RISK_RE)} edu=${cnt(r.hidden, EDU_RE)}`);
      }
      check(r.small.length === 0, `${L}: tap targets >= 44px`, JSON.stringify(r.small));
      if (pg.risk) check(r.text.split(pg.risk).length - 1 === 1, `${L}: risk line visible once`, r.text.slice(0, 200));
      if (pg.ib) check(r.text.includes(pg.ib), `${L}: IB line visible`);
      if (pg.outline) {
        const o = await p.evaluate((t) => [...document.querySelectorAll("main a")].filter((a) => a.textContent.trim() === t).map((a) => a.getAttribute("href")), pg.outline);
        check(o.length === 1 && o[0] === "/system/join", `${L}: outline "${pg.outline}" -> /system/join`, JSON.stringify(o));
        check(!r.text.includes("partner community"), `${L}: no Discord-first "Next step" button`);
      }
      if (pg.ibMuted) {
        const m = await p.evaluate((ib) => {
          const el = [...document.querySelectorAll("p")].find((e) => e.textContent.includes(ib));
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { size: parseFloat(cs.fontSize), color: cs.color, inCta: Boolean(el.closest("a, button")), inFooter: Boolean(el.closest('[data-testid="home-footer"]')), count: document.body.innerText.split(ib).length - 1 };
        }, pg.ib);
        check(m && m.size <= 12.5 && m.color !== "rgb(212, 160, 23)" && !m.inCta && m.inFooter && m.count === 1, `${L}: IB line once, small muted text in the footer (not a button/link)`, JSON.stringify(m));
      }
      if (pg.noIb) check(!r.text.includes(IB), `${L}: no IB line in members area`);
      if (pg.lang) check(r.lang === pg.lang, `${L}: lang="${pg.lang}" wrapper`, String(r.lang));
      if (pg.path.startsWith("/en/")) check(!/[^\w](ang|lang|mo|namin|kung|hindi|laging|muna)[^\w]/i.test(r.text), `${L}: no Taglish in main`, r.text.match(/.{0,30}[^\w](ang|lang|mo|namin|kung|hindi|laging|muna)[^\w].{0,30}/i)?.[0]);
      if (pg.path.endsWith("/accm")) {
        const a = await p.evaluate(() => {
          const d = document.querySelector('[data-testid="risk-details"]');
          return { closed: d && !d.open, inDetails: d?.textContent.includes("GFX Society provides trading education only"), boxes: [...document.querySelectorAll('fieldset input[type="checkbox"]')].filter((i) => i.getBoundingClientRect().height > 0).length };
        });
        check(a.closed && a.inDetails && !r.text.includes(LONG), `${L}: long risk text only inside the closed Risk warning expander`, JSON.stringify(a));
        check(a.boxes === 5, `${L}: self-check visible (5 boxes)`, String(a.boxes));
        check(!r.text.includes("Start small. Kung magte-trade ka"), `${L}: long "Start small" paragraph not visible`);
      }
      if (pg.slug === "member-home") {
        const s = await p.evaluate(() => {
          const c = document.querySelector('[data-testid="card-signals"]');
          const ids = ["card-continue", "card-courses", "card-signals", "card-account"].map((id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect());
          const cs = c ? getComputedStyle(c) : null;
          const bg = cs?.backgroundColor ?? "";
          return {
            tag: c?.tagName, href: c?.getAttribute("href"), target: c?.getAttribute("target"), rel: c?.getAttribute("rel"),
            text: c?.innerText.replace(/\s+/g, " ").trim(),
            gold: /rgb\(212, 160, 23\)/.test(bg) || Boolean(c?.className?.includes?.("bg-primary") || c?.className?.includes?.("border-primary")),
            minH: c ? parseFloat(cs.minHeight) || c.getBoundingClientRect().height : 0,
            order: ids.every((b, i) => b && (i === 0 || b.top > ids[i - 1].top)), fold: ids[3]?.bottom ?? 9999, vh: window.innerHeight,
          };
        });
        check(s.tag === "A" && s.href === "https://discord.gg/5HnHAhWjU" && s.target === "_blank" && /noopener/.test(s.rel || "") && /noreferrer/.test(s.rel || ""), `${L}: Signals card is the UU invite, new tab`, JSON.stringify(s));
        check(s.text === "Signals Live signals sa Universe Unlimited" && !s.gold, `${L}: Signals copy, secondary not gold, no Coming soon`, JSON.stringify(s));
        check(s.minH >= 44, `${L}: Signals card is at least 44px`, s.minH);
        check(s.order, `${L}: card order Continue, Courses, Signals, Account`);
        console.log(`INFO ${L}: 4th card bottom ${Math.round(s.fold)}px of ${s.vh}px viewport`);
        // Do not click through to discord.gg (no live Discord calls).
      }
      if (OUT && pg.shot !== false) {
        await p.screenshot({ path: `${OUT}/${width}-${pg.slug}-fold.png` }); // first screen, as a visitor sees it
        await p.screenshot({ path: `${OUT}/${width}-${pg.slug}.png`, fullPage: true }); // fixed bottom nav shows mid-page here
      }
      await p.close();
    }
  }

  // Audit (QA P1-1): every public page that shows the gold "Join the Trading System" or an IB line also shows the
  // shared risk line (RISK_LINE; /en pages RISK_LINE_EN_SHORT), visibly, in <main>, and (QA P2-1) the 1% sentence and the
  // education line exactly once each. Routes: QA's explicit list + sitemap. Offline the fake Supabase has no levels or
  // lessons, so DB-backed /academy/<level>[/<lesson>] pages are only covered on a real preview (QA's risk-audit).
  {
    const AUDIT = ["/", "/start", "/community", "/academy", "/academy/gold-starter", "/broker", "/accm", "/resources", "/system", "/system/join", "/go/ig_bio", "/go/fb_bio", "/go/tt_bio", "/go/fb261012_lotsize", "/go/ref_m0042", "/system/join/confirm", "/account", "/courses", "/courses/gold-reset", "/dashboard", "/diagnostic", "/learning", "/login", "/signup", "/en/academy/gold-starter", "/en/accm", "/en/broker", "/en/system/join"];
    const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const routes = [...new Set([...AUDIT, ...[...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)])];
    let audited = 0;
    const LEDE_PH = "Self-paced, Taglish.", LEDE_EN = "Self-paced. Lessons in Taglish for now.";
    const ledeSeen = [];
    // Legal documents (/privacy, /terms, /disclosure, /risk) quote the IB line inside legal text; they carry no Join CTA
    // and are the long-form disclosures themselves, so they are not page footers to audit.
    const LEGAL = new Set(["/privacy", "/terms", "/disclosure", "/risk"]);
    // Own risk text carries the 1% sentence + education line once (Design: /broker box; /academy/gold-starter Disclaimer).
    const SHARED_EXEMPT = new Set(["/broker", "/en/broker", "/academy/gold-starter", "/en/academy/gold-starter"]);
    for (const path of routes) {
      if (LEGAL.has(path)) continue;
      const p = await open(path, 360, null, { noJs: path.startsWith("/go/") });
      const r = await measure(p);
      await p.close();
      const en = path.startsWith("/en/");
      // Design PR71: "Self-paced, Taglish." on PH pages only; /en pages may only use the EN lede.
      if (r.text.includes(LEDE_PH) || r.text.includes(LEDE_EN)) ledeSeen.push(`${path}=${r.text.includes(LEDE_PH) ? "ph" : "en"}`);
      if (en) {
        const DEMO_FIRST = /demo first|demo-first|start on a demo|practi[cs]e on a demo|on your demo|demo account first/i;
        check(!DEMO_FIRST.test(r.text + " " + r.hidden), `audit 360 ${path}: no demo-first wording (visible or in closed expanders)`, (r.text + " " + r.hidden).match(/.{0,40}demo.{0,40}/i)?.[0]);
      }
      if (en) check(!r.text.includes(LEDE_PH), `audit 360 ${path}: no PH "Self-paced, Taglish." on /en`);
      else check(!r.text.includes(LEDE_EN), `audit 360 ${path}: no EN lede on a PH page`);
      const ib = r.text.includes(IB) || r.text.includes(IB_EN);
      const join = r.gold.some((g) => g.startsWith(JOIN));
      if (!ib && !join && !r.accmCta) continue;
      audited++;
      const why = [join && "gold Join", r.accmCta && "ACCM CTA", ib && "IB line"].filter(Boolean).join(" + ");
      const rc = cnt(r.text, RISK_RE), ec = cnt(r.text, EDU_RE);
      check(rc === 1 && ec === 1, `audit 360 ${path}: ${why} -> "Max 1% risk per trade" x1, "not financial advice" x1`, `risk=${rc} edu=${ec}`);
      if (!SHARED_EXEMPT.has(path)) check(r.text.includes(en ? RISK_EN : RISK_LINE), `audit 360 ${path}: shared risk line visible`, r.text.slice(-300));
      console.log(`INFO audit ${path}: visible risk=${rc} edu=${ec}; hidden risk=${cnt(r.hidden, RISK_RE)} edu=${cnt(r.hidden, EDU_RE)}`);
    }
    console.log(`INFO audit: ${audited} of ${routes.length} routes show gold Join or an IB line`);
    console.log(`INFO lede seen on: ${ledeSeen.join(", ") || "(none)"}`);
  }

  // ---- /en/academy/gold-starter Variant B: cents-first copy; no ACCM mention, so no IB line (Design amendment 15 Nov) ----
  for (const width of [360, 414]) {
    const p = await open("/en/academy/gold-starter", width);
    const x = await p.evaluate(() => {
      const d = [...document.querySelectorAll("main details")].find((e) => e.querySelector("summary")?.textContent.trim() === "Where should I trade?");
      if (!d) return null;
      d.open = true;
      const ib = d.querySelector('[data-testid="faq-ib-line"]');
      return { ib: ib?.textContent ?? null, answer: d.querySelector("p")?.textContent, accm: /ACCM/.test(document.querySelector("main").innerText) };
    });
    check(x && x.ib === null && x.accm === false, `${width} /en/academy/gold-starter: ACCM not named, no IB line`, JSON.stringify(x));
    check(x?.answer === "Lesson 3 explains how cents accounts work, if you want to try small real money you can afford to lose. A free MT5 demo is optional, only to learn the buttons. You'll learn how to check a broker's licence yourself.", `${width} /en/academy/gold-starter: Variant B FAQ answer`, x?.answer);
    const t = await p.evaluate(() => document.querySelector("main").innerText);
    check(t.includes("If you trade, start small with a cents account: only money you can afford to lose. Max 1% risk per trade, always with a stop loss.") && t.includes("Start small with a cents account: real money, but only small amounts you can afford to lose, always with a stop loss."), `${width} /en/academy/gold-starter: Variant B risk line + box item`);
    check(t.includes("Trading involves a real risk of loss. GoldFX Global is an education project of GFX Society. Education only, not financial advice. If you trade, start small (e.g. a cents account), max 1% risk per trade, always with a stop loss."), `${width} /en/academy/gold-starter: Disclaimer byte-intact`);
    if (OUT) await p.screenshot({ path: `${OUT}/${width}-en-gold-starter-faq-open.png`, fullPage: true });
    await p.close();
  }
  // ---- P3-13: /accm + /en/accm Discord step has id="discord" and opens on the #discord fragment ----
  for (const path of ["/accm", "/en/accm"]) {
    let p = await open(path, 360);
    await new Promise((r) => setTimeout(r, 300));
    let x = await p.evaluate(() => { const d = document.getElementById("discord"); return { tag: d?.tagName, open: d?.open, testid: d?.dataset.testid, ids: document.querySelectorAll("#discord").length, focus: document.activeElement?.tagName, y: Math.round(scrollY) }; });
    check(x.tag === "DETAILS" && !x.open && x.testid === "help" && x.ids === 1, `360 ${path}: one id="discord" on the Discord step (closed without the fragment)`, JSON.stringify(x));
    check(x.focus === "BODY" && x.y === 0, `360 ${path}: normal load never moves focus or scroll`, JSON.stringify(x));
    // Reached via #discord by hash change: opens and focuses the step's summary.
    await p.evaluate(() => { location.hash = "discord"; });
    await p.waitForFunction(() => document.activeElement === document.querySelector("#discord > summary"), { timeout: 5000 }).catch(() => {});
    x = await p.evaluate(() => ({ open: document.getElementById("discord")?.open, focusIsSummary: document.activeElement === document.querySelector("#discord > summary") }));
    check(x.open && x.focusIsSummary, `360 ${path}: hashchange to #discord opens the step and focuses its summary`, JSON.stringify(x));
    await p.close();
    p = await open(`${path}#discord`, 360);
    await p.waitForFunction(() => document.getElementById("discord")?.open === true, { timeout: 5000 }).catch(() => {});
    x = await p.evaluate(() => { const d = document.getElementById("discord"); return { open: d?.open, text: d?.innerText ?? "", focusIsSummary: document.activeElement === d?.querySelector("summary") }; });
    check(x.open && (x.text.includes("Universe Unlimited Discord →") || x.text.includes("coming soon")), `360 ${path}#discord: Discord step opens; UU invite label`, JSON.stringify(x));
    check(x.focusIsSummary, `360 ${path}#discord: keyboard focus on the step's summary`, JSON.stringify(x));
    // Native details, no trap: Tab moves on to the invite link inside, Enter on the summary still toggles.
    await p.keyboard.press("Tab");
    x = await p.evaluate(() => ({ moved: document.activeElement !== document.querySelector("#discord > summary") && document.activeElement !== document.body, tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 40) }));
    check(x.moved, `360 ${path}#discord: Tab moves on from the summary (no focus trap)`, JSON.stringify(x));
    await p.close();
  }
  // ---- Follow-up PR checks ----
  const MEMBERS_ONLY = "Members-only ang Trading System.";
  for (const width of [360, 414]) {
    // P2.6 /system: rows in a closed expander, Join first.
    let p = await open("/system", width);
    let x = await p.evaluate(() => { const d = document.querySelector('[data-testid="system-rows"]'); return { closed: d && !d.open, summary: d?.querySelector("summary")?.textContent.trim(), h2: document.querySelectorAll("main h2").length }; });
    check(x.closed && x.summary?.startsWith("Ano ang kasama?"), `${width} /system: 3 rows inside closed "Ano ang kasama?"`, JSON.stringify(x));
    await p.close();
    // P2.6 /courses: notes under closed "Learn more"; no who-it's-for/included list on the cards.
    p = await open("/courses", width, "member");
    x = await p.evaluate(() => { const d = document.querySelector('[data-testid="courses-learn-more"]'); return { closed: d && !d.open, text: document.querySelector("main").innerText }; });
    check(x.closed && !x.text.includes("Para sa dating traders na gustong bumalik nang may disiplina.") && x.text.includes("Self-paced, Taglish."), `${width} /courses: PH lede, Learn more closed, cards compact`, JSON.stringify({ closed: x.closed }));
    await p.close();
    // P2.6 /account (logged in): delete copy + form only after opening "Delete my account".
    for (const scn of ["member", "fresh"]) {
      p = await open("/account", width, scn);
      x = await p.evaluate(() => { const d = document.querySelector('[data-testid="delete-account"]'); return { closed: d && !d.open, visible: document.querySelector("main").innerText.includes("Hindi na ito maibabalik") }; });
      check(x.closed && !x.visible, `${width} /account (${scn}): Delete copy inside closed details`, JSON.stringify(x));
      await p.evaluate(() => { document.querySelector('[data-testid="delete-account"]').open = true; });
      const vis = await p.evaluate(() => document.querySelector("main").innerText.includes("Hindi na ito maibabalik"));
      check(vis, `${width} /account (${scn}): opening shows the unchanged delete copy`);
      if (OUT && scn === "member") await p.screenshot({ path: `${OUT}/${width}-account-member-delete-open.png`, fullPage: true });
      await p.close();
    }
    // /broker link: muted, not gold, right href, 44px.
    for (const [path, href] of [["/resources", "/broker"], ["/accm", "/broker"], ["/en/accm", "/en/broker"]]) {
      p = await open(path, width);
      x = await p.$eval('[data-testid="broker-link"]', (a) => { const b = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { href: a.getAttribute("href"), text: a.textContent.trim(), bg: cs.backgroundColor, color: cs.color, h: b.height, w: b.width }; }).catch(() => null);
      check(x && x.href === href && x.text === "Choosing a broker →" && x.bg !== "rgb(212, 160, 23)" && x.color !== "rgb(212, 160, 23)" && x.h >= 43.5 && x.w > 0, `${width} ${path}: muted "Choosing a broker →" -> ${href}`, JSON.stringify(x));
      await p.close();
    }
    // P3-6: members-only hint before the join click.
    for (const path of ["/", "/start", "/community", "/academy/gold-starter"]) {
      p = await open(path, width);
      x = await p.evaluate((h, J) => {
        const hint = [...document.querySelectorAll("main p")].find((e) => e.textContent.trim() === h);
        const join = [...document.querySelectorAll("main a")].find((a) => a.textContent.trim().startsWith(J) && a.getAttribute("href") === "/system/join");
        return { hint: Boolean(hint && hint.getBoundingClientRect().height > 0), count: document.querySelector("main").innerText.split(h).length - 1,
          size: hint ? parseFloat(getComputedStyle(hint).fontSize) : 0, before: Boolean(hint && join && (hint.compareDocumentPosition(join) & Node.DOCUMENT_POSITION_FOLLOWING || (Math.abs(hint.getBoundingClientRect().top - join.getBoundingClientRect().bottom) <= 100 && hint.getBoundingClientRect().bottom <= window.innerHeight))) };
      }, MEMBERS_ONLY, JOIN);
      check(x.hint && x.count === 1 && x.size <= 12.5 && x.before, `${width} ${path}: one small "${MEMBERS_ONLY}" at the Join link (before it, or in the Home CTA group on the first screen)`, JSON.stringify(x));
      await p.close();
    }
    // Gold-starter: Design-approved next-step copy, then Join the Trading System first, ACCM steps second, one gold.
    p = await open("/academy/gold-starter", width);
    x = await p.evaluate(() => { const s = document.querySelector('[data-testid="gold-starter-next"]'); const links = [...s.querySelectorAll("a")].map((a) => [a.textContent.trim(), a.getAttribute("href"), getComputedStyle(a).backgroundColor]); return { links, discord: /discord|partner community/i.test(s.innerText), copy: s.querySelector('[data-testid="gold-starter-next-copy"]')?.innerText.trim(), old: /Para sa later/.test(s.innerText) }; });
    check(x.copy === "Kapag ready ka na, puwede kang mag-join sa Trading System. Sa ngayon, focus muna sa Starter Kit at Lesson 1." && !x.old, `${width} /academy/gold-starter: Design-approved next-step copy`, JSON.stringify({ copy: x.copy, old: x.old }));
    check(x.links[0]?.[0] === JOIN && x.links[0][1] === "/system/join" && x.links[0][2] !== "rgb(212, 160, 23)" && x.links[1]?.[0].startsWith("Tingnan ang steps") && !x.discord, `${width} /academy/gold-starter: Join first, steps second, no Discord`, JSON.stringify(x));
    if (OUT) await (await p.$('[data-testid="gold-starter-next"]')).screenshot({ path: `${OUT}/${width}-gold-starter-para-sa-later.png` });
    await p.close();
  }
  // QA P3-8: next_step_click (location "go") fires on the /go Join link; no PII in props. The 1.5 s redirect timer is
  // neutralised and the navigation cancelled so the queued Vercel Analytics call (window.vaq) can be read.
  {
    const p = await ctx.newPage();
    await p.evaluateOnNewDocument(() => {
      const st = window.setTimeout;
      window.setTimeout = (fn, ms, ...a) => (ms === 1500 ? 0 : st(fn, ms, ...a));
      document.addEventListener("click", (e) => { if (e.target.closest?.('a[href="/system/join"]')) e.preventDefault(); }, true);
    });
    await p.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto(`${BASE}/go/ig_bio?utm_source=instagram&utm_medium=bio&email=me%40example.test`, { waitUntil: "networkidle0" });
    const a = await p.evaluateHandle((J) => [...document.querySelectorAll("main a")].find((x) => x.textContent.trim() === J), JOIN);
    await a.asElement().click();
    await new Promise((r) => setTimeout(r, 300));
    const ev = await p.evaluate(() => (window.vaq ?? []).filter((q) => q[0] === "event").map((q) => q[1]));
    const nsc = ev.filter((e) => e.name === "next_step_click");
    check(nsc.length === 1 && nsc[0].data?.location === "go", '/go Join click: next_step_click {location: "go"} queued', JSON.stringify(ev));
    check(nsc.length === 1 && !/@|example\.test|\d{7,}/.test(JSON.stringify(nsc[0].data)), "/go next_step_click props carry no PII", JSON.stringify(nsc[0]?.data));
    check(p.url().includes("/go/ig_bio"), "/go: test stayed on the page (redirect neutralised)", p.url());
    await p.close();
  }
  // /en/system/join logged in: no_match -> Having trouble? -> J4 EN caption; same actions as PH.
  for (const width of [360, 414]) {
    const p = await open("/en/system/join", width, "fresh");
    let r = await measure(p);
    check(r.gold.length === 1 && r.gold[0] === "Link your ACCM account", `${width} /en/system/join logged in: one gold "Link your ACCM account"`, JSON.stringify(r.gold));
    const btn = await p.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Link your ACCM account"));
    await btn.asElement().evaluate((e) => e.scrollIntoView({ block: "center" }));
    await btn.asElement().click();
    await p.waitForFunction(() => document.body.innerText.includes("We couldn't verify your membership yet."), { timeout: 15000 });
    const j4 = await p.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Already with ACCM under a different IB?"));
    check(Boolean(j4.asElement()), `${width} /en/system/join no_match: "Having trouble?" help with the EN J4 link`);
    await j4.asElement().evaluate((e) => e.scrollIntoView({ block: "center" }));
    await j4.asElement().click();
    await p.waitForSelector("#j4-transfer-help");
    r = await measure(p);
    check(r.text.includes("Template from the GFX team. Copy or open it as is."), `${width} /en/system/join J4: EN caption`);
    check(!/[^\w](ang|lang|mo|namin|kung|hindi|laging|muna)[^\w]/i.test(r.text), `${width} /en/system/join no_match: no Taglish`, r.text.match(/.{0,30}[^\w](ang|lang|mo|namin|kung|hindi|laging|muna)[^\w].{0,30}/i)?.[0]);
    check(r.gold.length === 1, `${width} /en/system/join no_match: still one gold`, JSON.stringify(r.gold));
    if (OUT) await p.screenshot({ path: `${OUT}/${width}-en-system-join-no-match-j4.png`, fullPage: true });
    await p.close();
  }
  // ---- Sprint 3 tiers: Explorer vs Linked (explorer-linked-tiers-spec v1.1 §2-§3) ----
  for (const width of [360, 414]) {
    const home = async (scn) => {
      const p = await open("/training", width, scn);
      const x = await p.evaluate(() => {
        const q = (id) => document.querySelector(`[data-testid="${id}"]`);
        const gold = [...document.querySelectorAll("main a")].filter((a) => getComputedStyle(a).backgroundColor === "rgb(212, 160, 23)").map((a) => [a.textContent.trim(), a.getAttribute("href")]);
        return { url: location.pathname, badge: q("member-badge")?.textContent.trim(), outline: q("home-link-outline") ? [q("home-link-outline").textContent.trim(), q("home-link-outline").getAttribute("href")] : null,
          linked: q("linked-status")?.textContent.trim() ?? null, text: document.querySelector("main").innerText, gold };
      });
      if (OUT) await p.screenshot({ path: `${OUT}/${width}-tiers-home-${scn}.png`, fullPage: true });
      await p.close();
      return x;
    };
    let x = await home("explorer");
    check(x.url === "/training" && x.badge === "Explorer", `${width} /training (explorer): Explorer home, badge "Explorer"`, JSON.stringify({ url: x.url, badge: x.badge }));
    check(x.gold.length === 1 && x.gold[0][1] === "/system/join?next=%2Fcourses%2Fgold-reset", `${width} /training (explorer, no consent): one gold -> consent, then Gold Reset`, JSON.stringify(x.gold));
    check(x.outline?.[0] === "I-link ang ACCM account mo →" && x.outline[1] === "/system/join", `${width} /training (explorer): outline "I-link ang ACCM account mo →"`, JSON.stringify(x.outline));
    check(x.text.includes("Libre ang Academy at Gold Reset.") && x.linked === null, `${width} /training (explorer): Explorer lead, no Linked status`);
    x = await home("fresh");
    check(x.gold.length === 1 && x.gold[0][1] === "/courses/gold-reset/lesson-2", `${width} /training (consented explorer): one gold -> next Gold Reset lesson`, JSON.stringify(x.gold));
    check(x.outline?.[1] === "/system/join", `${width} /training (consented explorer): outline Link stays`, JSON.stringify(x.outline));
    x = await home("member");
    check(x.badge === "Linked" && x.outline === null && x.linked === "Naka-link na ang ACCM account mo.", `${width} /training (member): badge "Linked", status line, no Link button`, JSON.stringify({ badge: x.badge, outline: x.outline, linked: x.linked }));
    check(!/Active member|VIP|PDE|profit|income|win.?rate|demo first/i.test(x.text), `${width} /training (member): no old badge / banned words`);
    // /courses as an Explorer: Gold Reset "Libre"; paid courses show Link (outline), never Buy, never gold.
    for (const scn of ["explorer", "fresh"]) {
      const p = await open("/courses", width, scn);
      const c = await p.evaluate(() => ({
        text: document.querySelector("main").innerText,
        links: [...document.querySelectorAll("main a")].map((a) => [a.textContent.trim(), a.getAttribute("href"), getComputedStyle(a).backgroundColor]),
      }));
      check(c.text.includes("Libre") && !/FREE para sa verified members/i.test(c.text), `${width} /courses (${scn}): Gold Reset "Libre", no "FREE para sa verified members"`);
      const paidLink = c.links.filter((l) => /I-link ang ACCM account mo/.test(l[0]));
      check(paidLink.length >= 1 && paidLink.every((l) => l[2] !== "rgb(212, 160, 23)" && l[1].startsWith("/system/join")), `${width} /courses (${scn}): paid courses -> outline Link`, JSON.stringify(paidLink));
      check(!/\bBilhin\b|\bBuy\b/.test(c.text), `${width} /courses (${scn}): no Buy for Explorers`);
      if (OUT) await p.screenshot({ path: `${OUT}/${width}-tiers-courses-${scn}.png`, fullPage: true });
      await p.close();
    }
    // Amendment v1.2 (1): logged out -> main's "Members-only" copy + sign-in path, 0 ACCM mentions, no IB line.
    for (const path of ["/courses", "/courses/gold-strategy-basics", "/courses/gold-advanced-setups"]) {
      const p = await open(path, width);
      const c = await p.evaluate(() => ({
        text: document.body.innerText, html: document.documentElement.outerHTML,
        gold: [...document.querySelectorAll("main a, main button")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(212, 160, 23)").map((e) => e.textContent.trim()),
        verify: [...document.querySelectorAll("main a")].filter((a) => a.textContent.trim() === "Verify membership →").map((a) => a.getAttribute("href")),
      }));
      const n = (c.text.match(/ACCM/g) ?? []).length;
      check(n === 0 && !c.html.includes("I-link ang ACCM") && !c.text.includes("Partner broker ng GFX ang ACCM."), `${width} ${path} (logged out): 0 ACCM mentions, no Link copy, no IB line`, `ACCM x${n}`);
      const want = path === "/courses" ? "Members-only ang courses. I-verify muna ang member email mo." : "Members-only ito. I-verify ang member email mo.";
      check(c.text.includes(want) && c.verify.length >= 1 && c.verify.every((h) => h === "/system/join"), `${width} ${path} (logged out): main's Members-only copy + Verify membership -> /system/join`, JSON.stringify(c.verify));
      check(c.gold.length <= 1, `${width} ${path} (logged out): at most one gold button`, JSON.stringify(c.gold));
      if (OUT) await p.screenshot({ path: `${OUT}/${width}-tiers-loggedout${path.replace(/\//g, "-")}.png`, fullPage: true });
      await p.close();
    }
    // Signed-in Explorer on a paid course page: the Link copy (outline), no Members-only copy.
    for (const path of ["/courses/gold-strategy-basics", "/courses/gold-advanced-setups"]) {
      const p = await open(path, width, "explorer");
      const c = await p.evaluate(() => ({ text: document.querySelector("main").innerText,
        link: [...document.querySelectorAll("main a")].filter((a) => /I-link ang ACCM account mo/.test(a.textContent)).map((a) => [a.getAttribute("href"), getComputedStyle(a).backgroundColor]) }));
      check(c.text.includes("Available 'pag naka-link na ang ACCM account mo.") && c.link.length === 1 && c.link[0][1] !== "rgb(212, 160, 23)" && !c.text.includes("Members-only ito."),
        `${width} ${path} (explorer): Link copy (outline), no Members-only copy`, JSON.stringify(c.link));
      await p.close();
    }
  }
  {
    // Route gate (proxy): consented Explorer opens Gold Reset; paid courses stay Linked-only; no consent -> consent first.
    const go = async (path, scn) => { const p = await open(path, 360, scn); const u = new URL(p.url()); await p.close(); return u.pathname + u.search; };
    check(!(await go("/courses/gold-reset/lesson-1", "fresh")).startsWith("/system/join"), "consented Explorer: Gold Reset lesson not sent to the join door");
    check((await go("/courses/gold-strategy-basics/lesson-1", "fresh")) === "/system/join?next=%2Fcourses%2Fgold-strategy-basics%2Flesson-1", "consented Explorer: Strategy Basics lesson -> join (Linked-only)");
    check((await go("/courses/gold-advanced-setups/lesson-1", "fresh")) === "/system/join?next=%2Fcourses%2Fgold-advanced-setups%2Flesson-1", "consented Explorer: Advanced Setups lesson -> join (Linked-only)");
    check((await go("/courses/gold-reset/lesson-1", "explorer")) === "/system/join?next=%2Fcourses%2Fgold-reset%2Flesson-1", "Explorer without consent: Gold Reset lesson -> consent first");
    // Join door with next=Gold Reset: the consent submit reads "Ituloy ang Gold Reset" (one gold).
    const p = await open("/system/join?next=%2Fcourses%2Fgold-reset", 360, "explorer");
    const r = await measure(p);
    check(r.gold.length === 1 && r.gold[0] === "Ituloy ang Gold Reset", "/system/join?next=Gold Reset (explorer): one gold \"Ituloy ang Gold Reset\"", JSON.stringify(r.gold));
    await p.close();
  }
  // Language switch both ways keeps the query string.
  const p = await open("/system/join?next=%2Fcourses%2Fgold-reset", 360);
  const en = await p.$eval('nav[aria-label="Language"] a[hreflang="en"]', (a) => a.getAttribute("href"));
  check(en === "/en/system/join?next=%2Fcourses%2Fgold-reset", "language switch PH -> EN keeps next", en);
  const login = await p.$eval('a[href^="/login"]', (a) => a.getAttribute("href"));
  check(login === "/login?next=%2Fsystem%2Fjoin%3Fnext%3D%252Fcourses%252Fgold-reset", "PH login returns to /system/join", login);
  await p.close();
  const q = await open("/en/system/join", 360);
  const enLogin = await q.$eval('a[href^="/login"]', (a) => a.getAttribute("href"));
  check(enLogin === "/login?next=%2Fen%2Fsystem%2Fjoin", "EN login returns to /en/system/join", enLogin);
  const hl = await q.$$eval('link[rel="alternate"][hreflang]', (l) => l.map((x) => `${x.hreflang}=${new URL(x.href).pathname}`).sort());
  check(JSON.stringify(hl) === JSON.stringify(["en=/en/system/join", "fil-PH=/system/join", "x-default=/system/join"]), "hreflang pairs on /en/system/join", JSON.stringify(hl));
  await q.close();
  // P2.7: /signup "Risk warning" link is a 44px target (prod: 24px).
  const su = await open("/signup", 360);
  const rh = await su.$eval('main a[href="/risk"]', (a) => a.getBoundingClientRect().height);
  check(rh >= 43.5, "/signup Risk warning link >= 44px", String(rh));
  await su.close();
} catch (e) {
  check(false, "unexpected", e.message);
} finally {
  await browser.close();
  mock.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
