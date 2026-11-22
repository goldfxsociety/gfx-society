// 360px + 414px checks + screenshots for the lesson-end-buttons spec (en-gold-starter-risk-fix.md §2) and QA P3-10/P3-12.
// Fully offline: a local fake Supabase on 127.0.0.1:54329 serving a tiny fake Academy + course catalogue (fake ids,
// example.test user only). Lesson bodies are placeholders; real lesson content lives in the DB and is not read here.
// 1) NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build
// 2) npx next start -p 3093   3) BASE=http://127.0.0.1:3093 node scripts/qa/lesson-end-e2e.mjs [--out <dir>]
import http from "node:http";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://127.0.0.1:3093";
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (ok, label, extra = "") => { if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", label, ok ? "" : extra); };

const JOIN = "Join the Trading System";
const LATER_KEY = "gfx_reconsent_later_at"; // src/components/consent/reconsent-banner.tsx
const DISCORD = "Paano sumali sa Universe Unlimited Discord →"; // P3-13 lesson label (LESSON_DISCORD_LINK); /accm keeps "Universe Unlimited Discord →"
const IB = "Partner broker ng GFX ang ACCM.";
const RISK_RE = /Max 1% risk per trade/g;
const NFA_RE = /(?:not|hindi) financial advice/gi; // QA risk-audit counter (lesson-risk-dedupe spec)
const EDU_RE = /Education (?:lang|only),? (?:not|hindi) financial advice/gi; // QA's counter
const cnt = (t, re) => (t.replace(/\s+/g, " ").match(re) || []).length;

// ---- fake data ----
const LEVELS = [
  { id: "lv1", slug: "foundations", title: "Level 1: Foundations", order_index: 1, is_published: true },
  { id: "lv6", slug: "graduation", title: "Level 6: Real-Money Discipline", order_index: 6, is_published: true },
];
const lesson = (id, level_id, slug, title, order_index) => ({ id, level_id, slug, title, order_index, is_published: true,
  learning_objective: "Example objective.", content: "Example lesson body (placeholder).", key_takeaways: [], lesson_type: "reading",
  interactive_config: null, passing_score: null, prerequisite_lesson_id: null, estimated_minutes: 5 });
const LESSONS = [
  lesson("a1", "lv1", "what-is-the-financial-market", "What is the financial market?", 1),
  lesson("a2", "lv1", "what-is-a-spread", "What is a spread?", 2),
  lesson("a3", "lv6", "real-money-and-your-emotions", "Real money and your emotions", 1),
  lesson("a4", "lv6", "opening-your-accm-account", "Opening your ACCM account", 2),
];
const mod = (course_id, sort, slug, title) => ({ course_id, sort, slug, title, learning_goal: null });
const TL = [
  { id: "t1", slug: "reset-basics", title: "Reset basics", sort: 1, training_modules: mod("c-gold-reset", 1, "m1", "Reset") },
  { id: "t2", slug: "reset-checklist", title: "Reset checklist", sort: 2, training_modules: mod("c-gold-reset", 1, "m1", "Reset") },
  { id: "t3", slug: "structure-retest-entries", title: "Structure retest entries", sort: 1, training_modules: mod("c-gsb", 1, "m1", "Structure") },
  { id: "t4", slug: "journaling-weekly-review", title: "Journaling weekly review", sort: 1, training_modules: mod("c-gsb", 2, "m2", "Review") },
];
const DONE = new Set(["t1", "t3"]);
const PAY = { "gold-reset": { state: "free", course_id: "c-gold-reset", price_php: 0 }, "gold-strategy-basics": { state: "approved", course_id: "c-gsb", price_php: 0 } };
const CAP_DISCLAIMER = "Education lang, not financial advice. Compute your own lot size. Max 1% risk per trade."; // seed text

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const eqs = (url) => { const q = new URL(url, "http://x").searchParams; const o = {}; for (const [k, v] of q) if (v.startsWith("eq.")) o[k] = v.slice(3); return o; };
const filt = (rows, f) => rows.filter((r) => Object.entries(f).every(([k, v]) => {
  if (k === "training_modules.course_id") return r.training_modules?.course_id === v;
  return k in r ? String(r[k]) === v : true;
}));
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const tok = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    let scn = null;
    try { scn = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()).scn; } catch { /* anon */ }
    const one = /pgrst\.object/.test(req.headers.accept ?? "");
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    const rows = (list) => (one ? (list[0] ? send(200, list[0]) : send(406, { code: "PGRST116", message: "no rows" })) : send(200, list));
    const path = req.url.split("?")[0];
    if (path.startsWith("/auth/v1/user")) {
      if (!scn) return send(401, { code: 401, msg: "no" });
      return send(200, { id: "11111111-1111-1111-1111-111111111111", aud: "authenticated", role: "authenticated", email: "learner@example.test",
        email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" });
    }
    if (path === "/rest/v1/consent_records") { res.writeHead(200, { "content-type": "application/json", "content-range": "0-0/1" }); return res.end("[]"); }
    if (req.method !== "GET" && path.startsWith("/rest/v1/") && !path.startsWith("/rest/v1/rpc/")) return send(201, []);
    if (path === "/rest/v1/levels") return rows(filt(LEVELS, eqs(req.url)));
    if (path === "/rest/v1/lessons") return rows(filt(LESSONS, eqs(req.url)));
    if (path === "/rest/v1/lesson_progress") return rows([]);
    if (path === "/rest/v1/training_lessons") {
      const f = eqs(req.url);
      const list = filt(TL, f).map((l) => ({ ...l, tldr: null, body_md: "Example training body (placeholder).", takeaway: null, practice_task: null }));
      return rows(scn ? list : []);
    }
    if (path === "/rest/v1/training_progress") {
      const ids = [...TL.filter((l) => DONE.has(l.id))];
      const f = eqs(req.url);
      if (f.lesson_id) return rows(DONE.has(f.lesson_id) ? [{ practice_done: true, completed_at: "2026-11-09T00:00:00Z" }] : []);
      return send(200, ids.map((l) => ({ lesson_id: l.id, completed_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z", quiz_score: 90 })));
    }
    if (path === "/rest/v1/training_capstones") return rows([{ course_id: "c-gsb", title: "Gold Strategy Basics Capstone", rubric: ["Example item 1", "Example item 2"], disclaimer: CAP_DISCLAIMER }]);
    if (path === "/rest/v1/capstone_progress") return rows([]);
    if (/^\/rest\/v1\/(profiles|member_status)/.test(path)) return rows([]);
    const m = path.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      if (m[1] === "my_membership") return send(200, scn ? "active" : "none");
      if (m[1] === "is_admin") return send(200, false);
      if (m[1] === "my_payment_info") return send(200, scn ? (PAY[JSON.parse(body || "{}").p_course_slug] ?? { state: "not_found" }) : { state: "not_found" });
      if (m[1] === "get_lesson_quiz") return send(200, null);
      if (m[1] === "my_join_state") return send(200, scn ? { consent: true, request: null } : null);
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
const open = async (path, width, scn, { intercept = false } = {}) => {
  for (const c of await ctx.cookies()) await ctx.deleteCookie(c);
  if (scn) await ctx.setCookie(sessionCookie(scn));
  const page = await ctx.newPage();
  // Fake member: pre-choose "Later" on the re-consent banner so screenshots show the lesson end (banner not under test).
  await page.evaluateOnNewDocument((k) => { try { localStorage.setItem(k, String(Date.now())); } catch { /* none */ } }, LATER_KEY);
  // Cancel in-page navigation so a click's queued analytics call (window.vaq) can be read.
  if (intercept) await page.evaluateOnNewDocument(() => document.addEventListener("click", (e) => { if (e.target.closest?.("main a")) e.preventDefault(); }, true));
  await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
};
const measure = (page) => page.evaluate(() => {
  const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const main = document.querySelector("main") ?? document.body;
  const gold = [...main.querySelectorAll("a, button, [role=button]")].filter(vis).filter((el) => getComputedStyle(el).backgroundColor === "rgb(212, 160, 23)")
    .map((el) => ({ text: el.innerText.replace(/\s+/g, " ").trim(), href: el.getAttribute("href") }));
  return { sw: document.documentElement.scrollWidth, gold, text: main.innerText, status: document.title };
});

const ACADEMY = [
  { slug: "lesson1", path: "/academy/foundations/what-is-the-financial-market", gold: "Next lesson → What is a spread?", href: "/academy/foundations/what-is-a-spread" },
  { slug: "level-end", path: "/academy/foundations/what-is-a-spread", gold: "Next lesson → Real money and your emotions", href: "/academy/graduation/real-money-and-your-emotions" },
  { slug: "mid", path: "/academy/graduation/real-money-and-your-emotions", gold: "Next lesson → Opening your ACCM account", href: "/academy/graduation/opening-your-accm-account" },
  { slug: "graduation-last", path: "/academy/graduation/opening-your-accm-account", gold: JOIN, href: "/system/join", last: true },
];
const COURSES = [
  { slug: "gold-reset-mid", path: "/courses/gold-reset/reset-basics", gold: "Next lesson → Reset checklist", href: "/courses/gold-reset/reset-checklist" },
  { slug: "gold-reset-last", path: "/courses/gold-reset/reset-checklist", gold: JOIN, href: "/system/join", back: "Back to Gold Reset" },
  { slug: "gsb-module-end", path: "/courses/gold-strategy-basics/structure-retest-entries", gold: "Next lesson → Journaling weekly review", href: "/courses/gold-strategy-basics/journaling-weekly-review" },
  { slug: "gsb-last", path: "/courses/gold-strategy-basics/journaling-weekly-review", gold: "Next lesson → Capstone", href: "/courses/gold-strategy-basics/capstone" },
  { slug: "gsb-capstone", path: "/courses/gold-strategy-basics/capstone", gold: JOIN, href: "/system/join", capstone: true },
];

try {
  for (const width of [360, 414]) {
    for (const pg of ACADEMY) {
      const L = `${width} ${pg.path}`;
      const p = await open(pg.path, width);
      const r = await measure(p);
      check(r.sw <= width, `${L}: no horizontal scroll`, `scrollWidth=${r.sw}`);
      check(r.gold.length === 1 && r.gold[0].text === pg.gold && r.gold[0].href === pg.href, `${L}: one gold "${pg.gold}" -> ${pg.href}`, JSON.stringify(r.gold));
      check(!/Start Level|Next module|partner community|Next step: guided training/.test(r.text), `${L}: no old labels / Discord-first copy`, r.text.match(/.{0,40}(Start Level|Next module|partner community).{0,40}/)?.[0]);
      const help = await p.evaluate((D) => { const d = document.querySelector('[data-testid="lesson-help"]'); const a = d && [...d.querySelectorAll("a")].find((x) => x.textContent.trim() === D);
        return { closed: d && !d.open, summary: d?.querySelector("summary")?.textContent.replace("▸", "").trim(), href: a?.getAttribute("href"), muted: a && getComputedStyle(a).backgroundColor !== "rgb(212, 160, 23)", ib: d?.textContent.includes("Partner broker ng GFX ang ACCM."), count: document.querySelectorAll('[data-testid="lesson-help"]').length, cards: document.querySelectorAll("[data-reminder]").length }; }, DISCORD);
      check(help.count === 1 && help.closed && help.summary === "May problema?" && help.href === "/accm#discord" && help.muted && help.ib && help.cards === 0, `${L}: Discord only as muted "${DISCORD}" in closed "May problema?" (+ IB line)`, JSON.stringify(help));
      // lesson-risk-dedupe: QA's counters, exactly one each from the footer (placeholder DB body adds none).
      const rc = cnt(r.text, RISK_RE), ec = cnt(r.text, NFA_RE);
      check(rc === 1 && ec === 1, `${L}: QA once-rule: "Max 1% risk per trade" x1, "(not|hindi) financial advice" x1 (visible; placeholder body)`, `risk=${rc} nfa=${ec}`);
      if (pg.last) {
        check(r.text.includes("Members-only ang Trading System.") && r.text.includes(IB), `${L}: members-only hint + IB line in the Academy-complete box`);
        check(!/sumali sa\s+Discord community namin/.test(r.text), `${L}: Discord sentence removed from the end box`);
      }
      if (OUT) { await p.screenshot({ path: `${OUT}/${width}-${pg.slug}.png`, fullPage: true }); await p.evaluate(() => { document.querySelector('[data-testid="lesson-help"]').open = true; }); await (await p.$("nav[aria-label='Lesson navigation']")).evaluate((e) => e.scrollIntoView()); await p.screenshot({ path: `${OUT}/${width}-${pg.slug}-end.png` }); }
      await p.close();
    }
    for (const pg of COURSES) {
      const L = `${width} ${pg.path} (member)`;
      const p = await open(pg.path, width, "member");
      const r = await measure(p);
      check(!/\/login|\/system\/join$/.test(p.url()), `${L}: renders (not redirected)`, p.url());
      check(r.sw <= width, `${L}: no horizontal scroll`, `scrollWidth=${r.sw}`);
      check(r.gold.length === 1 && r.gold[0].text === pg.gold && r.gold[0].href === pg.href, `${L}: one gold "${pg.gold}" -> ${pg.href}`, JSON.stringify(r.gold));
      check(!/Next module →|Go to capstone/.test(r.text), `${L}: no "Next module →" / "Go to capstone"`);
      check(cnt(r.text, RISK_RE) === 1 && cnt(r.text, EDU_RE) === 1, `${L}: risk x1, NFA x1`, `risk=${cnt(r.text, RISK_RE)} edu=${cnt(r.text, EDU_RE)}`);
      check(!r.text.includes(IB), `${L}: no IB line in the members area`);
      if (pg.back) {
        const b = await p.evaluate((t) => { const a = [...document.querySelectorAll("main a")].find((x) => x.textContent.trim() === t); return a && { href: a.getAttribute("href"), bg: getComputedStyle(a).backgroundColor }; }, pg.back);
        check(b && b.href === "/courses/gold-reset" && b.bg !== "rgb(212, 160, 23)", `${L}: "${pg.back}" is a muted link`, JSON.stringify(b));
      }
      if (pg.capstone) check(r.text.includes(CAP_DISCLAIMER), `${L}: capstone content disclaimer carries the risk + NFA line`);
      if (OUT) await p.screenshot({ path: `${OUT}/${width}-${pg.slug}.png`, fullPage: true });
      await p.close();
    }
  }
  // lesson-risk-dedupe: level indexes use the same footer -> one of each, never zero.
  for (const width of [360, 414]) {
    for (const path of ["/academy/foundations", "/academy/graduation"]) {
      const p = await open(path, width);
      const r = await measure(p);
      check(cnt(r.text, RISK_RE) === 1 && cnt(r.text, NFA_RE) === 1, `${width} ${path}: QA once-rule on the level index`, `risk=${cnt(r.text, RISK_RE)} nfa=${cnt(r.text, NFA_RE)}`);
      if (OUT) await p.screenshot({ path: `${OUT}/${width}-level-${path.split("/").pop()}.png`, fullPage: true });
      await p.close();
    }
  }
  // P3-13: the lesson help link lands on the open Discord step on /accm (real navigation, no interception).
  for (const width of [360, 414]) {
    const p = await open("/academy/foundations/what-is-a-spread", width);
    await p.evaluate(() => { document.querySelector('[data-testid="lesson-help"]').open = true; });
    await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.evaluate((D) => [...document.querySelectorAll('[data-testid="lesson-help"] a')].find((a) => a.textContent.trim() === D).click(), DISCORD)]);
    await p.waitForFunction(() => document.getElementById("discord")?.open === true, { timeout: 5000 }).catch(() => {});
    const x = await p.evaluate(() => { const d = document.getElementById("discord"); const b = d?.getBoundingClientRect(); return { url: location.pathname + location.hash, tag: d?.tagName, open: d?.open, inView: b ? b.top < innerHeight && b.bottom > 0 : false, invite: d?.innerText.includes("Universe Unlimited Discord →") || d?.innerText.includes("Discord: coming soon."), focusIsSummary: document.activeElement === d?.querySelector("summary") }; });
    check(x.url === "/accm#discord" && x.tag === "DETAILS" && x.open && x.inView && x.invite, `${width} lesson help -> /accm#discord: Discord step open and in view`, JSON.stringify(x));
    check(x.focusIsSummary, `${width} lesson help -> /accm#discord: keyboard focus on the step's summary`, JSON.stringify(x));
    if (OUT) await p.screenshot({ path: `${OUT}/${width}-accm-discord-landing.png` });
    await p.close();
  }
  // Analytics labels: academy_complete on the last-lesson Join; QA P3-10 distinct gold-starter labels; lesson_help on Discord.
  // Click by text inside the page (fresh lookup each time; element handles go stale across re-renders).
  const clickText = (p, scope, t) => p.evaluate((s, t) => { const a = [...document.querySelectorAll(`${s} a`)].find((x) => x.textContent.trim().startsWith(t)); a?.click(); return Boolean(a); }, scope, t);
  const events = async (p) => p.evaluate(() => (window.vaq ?? []).filter((q) => q[0] === "event" && q[1].name === "next_step_click").map((q) => q[1].data));
  {
    const p = await open("/academy/graduation/opening-your-accm-account", 360, null, { intercept: true });
    check(await clickText(p, "main nav", JOIN), "last lesson: Join link found");
    await p.evaluate(() => { document.querySelector('[data-testid="lesson-help"]').open = true; });
    check(await clickText(p, '[data-testid="lesson-help"]', DISCORD), "last lesson: Discord link found");
    await new Promise((r) => setTimeout(r, 300));
    const ev = await events(p);
    check(JSON.stringify(ev.map((e) => e.location)) === '["academy_complete","lesson_help"]', "last lesson: Join -> academy_complete, Discord -> lesson_help", JSON.stringify(ev));
    await p.close();
  }
  {
    const p = await open("/academy/gold-starter?utm_source=instagram&email=me%40example.test", 360, null, { intercept: true });
    const sec = '[data-testid="gold-starter-next"]';
    check(await clickText(p, sec, JOIN), "gold-starter: Join link found");
    check(await clickText(p, sec, "Tingnan ang steps"), "gold-starter: steps link found");
    await new Promise((r) => setTimeout(r, 300));
    const ev = await events(p);
    check(JSON.stringify(ev.map((e) => e.location)) === '["gold_starter_join","gold_starter_steps"]', "P3-10: gold-starter Join -> gold_starter_join, steps -> gold_starter_steps", JSON.stringify(ev));
    check(ev.every((e) => !/@|example\.test|\d{7,}/.test(JSON.stringify(e))), "P3-10: next_step_click props carry no PII", JSON.stringify(ev));
    await p.close();
  }
  // QA P3-12: the collapsed delete section is still a heading for screen readers.
  for (const width of [360, 414]) {
    const p = await open("/account", width, "member");
    const x = await p.evaluate(() => { const d = document.querySelector('[data-testid="delete-account"]'); const h = d?.querySelector("summary h2"); return { closed: d && !d.open, h2: h?.textContent.trim(), sumH: d?.querySelector("summary").getBoundingClientRect().height }; });
    const ax = await p.accessibility.snapshot({ interestingOnly: false });
    const flat = []; (function walk(n) { if (!n) return; flat.push(n); (n.children ?? []).forEach(walk); })(ax);
    const heading = flat.some((n) => n.role === "heading" && n.name === "Delete my account");
    check(x.closed && x.h2 === "Delete my account" && x.sumH >= 43.5 && heading, `${width} /account: closed "Delete my account" exposes an h2 heading (a11y tree)`, JSON.stringify({ ...x, heading }));
    if (OUT) await p.screenshot({ path: `${OUT}/${width}-account-member.png`, fullPage: true });
    await p.close();
  }
} catch (e) {
  check(false, "unexpected", e.stack);
} finally {
  await browser.close();
  mock.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
