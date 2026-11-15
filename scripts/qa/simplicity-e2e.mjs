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

// ---- fake Supabase (fake ids / example.test only) ----
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const SCN = { member: { member: true }, fresh: { member: false } };
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
    if (req.url.startsWith("/rest/v1/training_lessons")) return send(200, s?.member ? LESSONS : []);
    if (req.url.startsWith("/rest/v1/training_progress")) return send(200, s?.member ? [{ lesson_id: "l1", completed_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z", quiz_score: null }] : []);
    if (/^\/rest\/v1\/(profiles|member_status|training_capstones|capstone_progress)/.test(req.url)) return send(200, []);
    const m = req.url.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      if (m[1] === "my_membership") return send(200, s?.member ? "active" : "none");
      if (m[1] === "my_payment_info") {
        const slug = JSON.parse(body || "{}").p_course_slug;
        return send(200, s?.member && slug === "gold-reset" ? { state: "free", course_id: "c-gold-reset", price_php: 0 } : { state: "not_found" });
      }
      if (m[1] === "my_join_state") return send(200, s ? { consent: true, request: null } : null);
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
const open = async (path, width, scn) => {
  for (const c of await ctx.cookies()) await ctx.deleteCookie(c);
  if (scn) await ctx.setCookie(sessionCookie(scn));
  const page = await ctx.newPage();
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
      if (h < 43.5) small.push(`${el.tagName}:${(el.textContent || el.type || "").trim().slice(0, 30)}:${Math.round(h)}`);
    }
    return { sw: document.documentElement.scrollWidth, vw: window.innerWidth, gold, small, text: main.innerText, lang: main.querySelector("[lang]")?.getAttribute("lang") ?? null };
  });
}

const PAGES = [
  { slug: "home", path: "/", gold: JOIN, risk: RISK_LINE, ib: IB, ibMuted: true },
  { slug: "member-home", path: "/training", scn: "member", gold: "Ituloy →", risk: RISK_LINE, noIb: true },
  { slug: "accm", path: "/accm", gold: JOIN, risk: RISK_LINE, ib: IB, lang: "fil" },
  { slug: "en-accm", path: "/en/accm", gold: JOIN, risk: RISK_EN, ib: IB_EN, lang: "en" },
  { slug: "broker", path: "/broker", gold: JOIN, ib: IB, lang: "fil" },
  { slug: "en-broker", path: "/en/broker", gold: JOIN, ib: IB_EN, lang: "en" },
  { slug: "system-join", path: "/system/join", gold: "Log in with your Academy account", risk: RISK_LINE, ib: IB, lang: "fil" },
  { slug: "en-system-join", path: "/en/system/join", gold: "Log in with your Academy account", risk: RISK_EN, ib: IB_EN, lang: "en" },
  { slug: "academy", path: "/academy", gold: JOIN, shot: false },
  { slug: "start", path: "/start", gold: JOIN, shot: false },
  { slug: "community", path: "/community", gold: JOIN, shot: false },
];

try {
  for (const width of [360, 414]) {
    for (const pg of PAGES) {
      const L = `${width} ${pg.path}`;
      const p = await open(pg.path, width, pg.scn);
      const r = await measure(p);
      check(r.sw <= width, `${L}: no horizontal scroll`, `scrollWidth=${r.sw}`);
      check(r.gold.length === 1 && r.gold[0].startsWith(pg.gold), `${L}: exactly one gold, "${pg.gold}"`, JSON.stringify(r.gold));
      check(r.small.length === 0, `${L}: tap targets >= 44px`, JSON.stringify(r.small));
      if (pg.risk) check(r.text.split(pg.risk).length - 1 === 1, `${L}: risk line visible once`, r.text.slice(0, 200));
      if (pg.ib) check(r.text.includes(pg.ib), `${L}: IB line visible`);
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
          const focusables = [...document.querySelectorAll("a[href], button, input, [tabindex]")];
          return {
            disabled: c?.getAttribute("aria-disabled"), tag: c?.tagName, inLink: Boolean(c?.closest("a, button")), hasLink: Boolean(c?.querySelector("a, button, [tabindex]")),
            focusable: focusables.some((f) => c?.contains(f)), text: c?.innerText.replace(/\s+/g, " ").trim(),
            order: ids.every((b, i) => b && (i === 0 || b.top > ids[i - 1].top)), fold: ids[3]?.bottom ?? 9999, vh: window.innerHeight,
          };
        });
        check(s.disabled === "true" && s.tag === "DIV" && !s.inLink && !s.hasLink && !s.focusable, `${L}: Signals card not a link/button, aria-disabled, not focusable`, JSON.stringify(s));
        check(s.text === "Signals Coming soon. Coming soon", `${L}: Signals copy only "Coming soon" (no dates/claims)`, s.text);
        check(s.order, `${L}: card order Continue, Courses, Signals, Account`);
        console.log(`INFO ${L}: 4th card bottom ${Math.round(s.fold)}px of ${s.vh}px viewport`);
        await p.click('[data-testid="card-signals"]').catch(() => {});
        check(p.url().endsWith("/training"), `${L}: clicking Signals goes nowhere`, p.url());
      }
      if (OUT && pg.shot !== false) {
        await p.screenshot({ path: `${OUT}/${width}-${pg.slug}-fold.png` }); // first screen, as a visitor sees it
        await p.screenshot({ path: `${OUT}/${width}-${pg.slug}.png`, fullPage: true }); // fixed bottom nav shows mid-page here
      }
      await p.close();
    }
  }

  // /en/system/join logged in: no_match -> Having trouble? -> J4 EN caption; same actions as PH.
  for (const width of [360, 414]) {
    const p = await open("/en/system/join", width, "fresh");
    let r = await measure(p);
    check(r.gold.length === 1 && r.gold[0] === "Verify membership", `${width} /en/system/join logged in: one gold "Verify membership"`, JSON.stringify(r.gold));
    const btn = await p.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Verify membership"));
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
