// 360px layout + flow check for /system/join (access journey v2), /accm, /broker. Fully offline:
// a local fake Supabase (auth/v1/user + rest/v1/rpc/*) on 127.0.0.1:54329 with fake users only.
// 1) NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build
// 2) npx next start -p 3071   3) node scripts/qa/join-360-e2e.mjs [--out /tmp/shots]   (needs puppeteer-core --no-save + Chrome)
import http from "node:http";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://127.0.0.1:3071";
// Live by default since the go-live PR (ACCM_CONFIRM_MAIL_LIVE = true). FLAG_OFF=1: run against a LOCAL build with the
// constant flipped back to false, i.e. the rollback state (never committed).
const FLAG_ON = process.env.FLAG_OFF !== "1";
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (ok, label, extra = "") => { if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", label, ok ? "" : extra); };

// ---- fake Supabase ----
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const SCN = {
  fresh: { confirmed: true, consent: false, request: null },
  consented: { confirmed: true, consent: true, request: null },
  waiting: { confirmed: true, consent: true, request: { status: "pending", created_at: "2026-11-10T17:00:00Z", ib_name: "Team Ana" } },
  unconfirmed: { confirmed: false, consent: false, request: null },
  // Different ACCM email still waiting for its confirmation click.
  awaiting: { confirmed: true, consent: true, request: { status: "awaiting_email_confirm", created_at: "2026-11-10T17:00:00Z", has_accm_email: true, accm_confirmed: false, ib_name: null } },
  // QA Q2: same request after the 7-day purge (raw email gone, hash kept, back to pending = Academy email only).
  purged: { confirmed: true, consent: true, request: { status: "pending", created_at: "2026-11-02T17:00:00Z", has_accm_email: true, accm_confirmed: false, ib_name: null } },
};
const rpcLog = [];
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
        email_confirmed_at: s.confirmed ? "2026-11-01T00:00:00Z" : null, app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" });
    }
    // Signup consent on file (keeps the unrelated re-consent banner away).
    if (req.url.startsWith("/rest/v1/consent_records")) { res.writeHead(200, { "content-type": "application/json", "content-range": "0-0/1" }); return res.end("[]"); }
    const m = req.url.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      rpcLog.push(m[1]);
      if (m[1] === "my_membership") return send(200, "none");
      if (m[1] === "my_join_state") return send(200, s ? { consent: s.consent, request: s.request } : null);
      if (m[1] === "record_member_consent") return send(200, "no_match");
      if (m[1] === "submit_access_request") return send(200, "pending");
      if (m[1] === "confirm_accm_email") return send(200, JSON.parse(body || "{}").p_token === "a".repeat(64) ? "confirmed" : "invalid");
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
await ctx.overridePermissions(BASE, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);

// Layout rules at 360px: no horizontal scroll, every visible tap target >= 44px tall (checkbox -> its label),
// at most one gold CTA in <main>, risk line once in <main>.
async function layout(page, label, { gold = 1, risk = 1 } = {}) {
  const r = await page.evaluate(() => {
    const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const main = document.querySelector("main") ?? document.body;
    const small = [];
    for (const el of main.querySelectorAll("a, button, input, select, textarea, summary")) {
      if (!vis(el) || el.type === "hidden") continue;
      const target = el.type === "checkbox" ? el.closest("label") ?? el : el;
      const h = target.getBoundingClientRect().height;
      if (h < 44 - 0.5) small.push(`${el.tagName}:${(el.textContent || el.name || el.type || "").trim().slice(0, 40)}:${Math.round(h)}`);
    }
    const gold = [...main.querySelectorAll("a, button")].filter((el) => vis(el) && /\bbg-primary\b/.test(el.className) && /text-primary-foreground/.test(el.className))
      .map((el) => el.textContent.trim());
    const text = main.innerText;
    return { sw: document.documentElement.scrollWidth, small, gold, risk: (text.match(/Max 1% risk per trade/g) ?? []).length };
  });
  check(r.sw <= 360, `${label}: no horizontal scroll at 360px`, `scrollWidth=${r.sw}`);
  check(r.small.length === 0, `${label}: tap targets >= 44px`, JSON.stringify(r.small));
  check(r.gold.length === gold, `${label}: ${gold} gold CTA`, JSON.stringify(r.gold));
  if (risk !== null) check(r.risk === risk, `${label}: risk line ${risk}x in main`, String(r.risk));
  if (OUT) await page.screenshot({ path: `${OUT}/${label.replace(/[^a-z0-9]+/gi, "-")}.png`, fullPage: true });
  return r;
}
const open = async (path, scn) => {
  const page = await ctx.newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.deleteCookie?.(...(await ctx.cookies?.() ?? []));
  if (scn) await ctx.setCookie(sessionCookie(scn)); else for (const c of (await ctx.cookies())) await ctx.deleteCookie(c);
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
};
const text = (page) => page.evaluate(() => (document.querySelector("main") ?? document.body).innerText);
const clickText = async (page, sel, t) => {
  const h = await page.evaluateHandle((sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(t)), sel, t);
  if (!h.asElement()) throw new Error("not found: " + t);
  await h.asElement().click();
};

try {
  // ---- logged out ----
  let p = await open("/system/join?next=%2Fcourses%2Fgold-reset%2Fl1");
  await layout(p, "join logged out");
  let tx = await text(p);
  check(tx.includes("Log in muna gamit ang Academy account mo.") && !tx.includes("Request access"), "logged out: login copy, no request form");
  check(!(await p.$('input[type="email"], input[name="accm_email"], input[name="ib_name"]')), "logged out: no email / request fields");
  const href = await p.$eval('a[href^="/login"]', (a) => a.getAttribute("href"));
  check(href === "/login?next=%2Fsystem%2Fjoin%3Fnext%3D%252Fcourses%252Fgold-reset%252Fl1", "logged out: login keeps the deep link", href);
  await p.close();

  for (const path of ["/accm", "/broker"]) {
    p = await open(path);
    const r = await layout(p, `${path} logged out`, { risk: null });
    check(r.gold[0]?.startsWith("Join the Trading System"), `${path}: the gold CTA is Join the Trading System`, JSON.stringify(r.gold));
    check((await p.$$eval('a[href="/system/join"]', (as) => as.length)) >= 1, `${path}: links to /system/join`);
    await p.close();
  }

  // ---- unconfirmed ----
  p = await open("/system/join", "unconfirmed");
  await layout(p, "join unconfirmed", { gold: 0 });
  tx = await text(p);
  check(tx.includes("I-confirm muna ang email ng Academy account mo.") && !tx.includes("Verify membership"), "unconfirmed: unverifiedEmail copy, no form");
  await p.close();

  // ---- fresh: consent -> no_match -> request -> J4 ----
  p = await open("/system/join", "fresh");
  await layout(p, "join verify (fresh)");
  check(!(await p.$eval('input[name="consent"]', (i) => i.checked)), "fresh: consent not pre-ticked");
  await p.click('input[name="consent"]');
  await clickText(p, "button", "Verify membership");
  await p.waitForFunction(() => document.body.innerText.includes("Hindi pa namin ma-verify"), { timeout: 15000 });
  await layout(p, "join no_match");
  tx = await text(p);
  check(tx.includes("Hindi pa naka-verify? I-request dito.") && tx.includes("Naka-register ka na sa ACCM pero sa ibang IB?") && tx.includes("Wala ka pang ACCM account?"), "no_match: request link + optional help links");
  check(!tx.includes("Request access"), "no_match: request form collapsed by default");
  await clickText(p, "button", "Hindi pa naka-verify?");
  await p.waitForSelector("#access-request-form");
  const r1 = await layout(p, "join request form open");
  check(r1.gold[0] === "I-submit ang request", "form open: the only gold CTA is I-submit ang request", JSON.stringify(r1.gold));
  check((await p.$eval('button[aria-controls="access-request-form"]', (b) => b.getAttribute("aria-expanded"))) === "true", "form toggle aria-expanded=true");
  const fz = await p.$eval('#ar-ib', (i) => [getComputedStyle(i).fontSize, i.getBoundingClientRect().height, Math.round(i.getBoundingClientRect().width), Math.round(i.parentElement.getBoundingClientRect().width)]);
  check(fz[0] === "16px" && fz[1] >= 44 && fz[2] === fz[3], "IB input: 16px, >= 44px tall, full width of the form", JSON.stringify(fz));
  if (FLAG_ON) check(Boolean(await p.$('input[name="accm_email"]')), "flag on: ACCM email field shown");
  else check(!(await p.$('input[name="accm_email"]')), "ACCM email field hidden while the confirmation mailer is not live");
  tx = await text(p);
  check(tx.includes("learner@example.test") && !(await p.$('input[value="learner@example.test"]')), "Academy email shown as read-only text, not an input");
  // J4
  await clickText(p, "button", "Naka-register ka na sa ACCM");
  await p.waitForSelector("#j4-transfer-help");
  await layout(p, "join J4 template open");
  const dd = await p.$$eval("#j4-transfer-help dd", (d) => d.map((x) => x.innerText));
  check(JSON.stringify(dd) === JSON.stringify(["csse@accmfx.com, roselle@accmfx.com", "For Transfer IB", "Hi, please transfer my account to IB goldfx.society@gmail.com\n\nThank you."]), "J4: To/Subject/Body exact", JSON.stringify(dd));
  const mt = await p.$eval('#j4-transfer-help a[href^="mailto:"]', (a) => a.getAttribute("href"));
  check(mt === "mailto:csse@accmfx.com,roselle@accmfx.com?subject=For%20Transfer%20IB&body=Hi%2C%20please%20transfer%20my%20account%20to%20IB%20goldfx.society%40gmail.com%0A%0AThank%20you.", "J4: mailto exact");
  await clickText(p, "#j4-transfer-help button", "Copy");
  await p.waitForFunction(() => [...document.querySelectorAll('[aria-live="polite"]')].some((e) => e.textContent.trim() === "Copied"), { timeout: 5000 });
  check(true, 'J4: aria-live announces "Copied"');
  // N9: a second Copy clears the live region first, then says "Copied" again (re-announced).
  await p.evaluate(() => { const el = document.querySelector('#j4-transfer-help [aria-live="polite"]'); window.__seq = []; new MutationObserver(() => window.__seq.push(el.textContent.trim())).observe(el, { childList: true, characterData: true, subtree: true }); });
  await clickText(p, "#j4-transfer-help button", "Copy");
  await p.waitForFunction(() => window.__seq.join("|").includes("|Copied") || (window.__seq[0] === "" && window.__seq.includes("Copied")), { timeout: 5000 }).catch(() => {});
  const seq = await p.evaluate(() => window.__seq);
  check(seq.indexOf("") > -1 && seq.lastIndexOf("Copied") > seq.indexOf(""), 'N9: second Copy is re-announced ("" then "Copied")', JSON.stringify(seq));
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  check(clip === "To: csse@accmfx.com, roselle@accmfx.com\nSubject: For Transfer IB\n\nHi, please transfer my account to IB goldfx.society@gmail.com\n\nThank you.", "J4: clipboard has the labelled template");
  // submit without consent -> error + focus
  await clickText(p, "#access-request-form button", "I-submit ang request");
  await p.waitForFunction(() => document.body.innerText.includes("I-tick muna ang consent box."), { timeout: 15000 });
  check(await p.evaluate(() => document.activeElement?.name === "request_consent" && document.activeElement.getAttribute("aria-describedby") === "ar-consent-err"), "consent error: focus moves to the checkbox, aria-describedby set");
  await p.type("#ar-ib", "Team Ana");
  await p.click('input[name="request_consent"]');
  await clickText(p, "#access-request-form button", "I-submit ang request");
  await p.waitForFunction(() => document.querySelector('[role="status"]')?.innerText.startsWith("Natanggap na ang request mo."), { timeout: 15000 });
  await layout(p, "join submitted pending", { gold: 0 });
  check(!(await p.$("#access-request-form")), "after submit: form replaced by status");
  await p.close();

  // ---- consent remembered ----
  p = await open("/system/join", "consented");
  check(await p.$eval('input[name="consent"]', (i) => i.checked && i.disabled), "returning: consent shown as already agreed (no re-tick)");
  await clickText(p, "button", "Verify membership");
  await p.waitForFunction(() => document.body.innerText.includes("Hindi pa namin ma-verify"), { timeout: 15000 });
  check(true, "returning: Verify works without ticking again");
  await p.close();

  // ---- active request (C) ----
  p = await open("/system/join", "waiting");
  await layout(p, "join active request", { gold: 0 });
  tx = await text(p);
  const nf = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const y = +nf.find((x) => x.type === "year").value, m = +nf.find((x) => x.type === "month").value;
  const want = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1, 12)));
  check(tx.includes(`May active request ka na, submitted Nov 11, 2026. Iche-check ito sa ${want}, at sa bawat monthly update hanggang ma-match.`), "C: active request copy with Manila dates", tx.slice(0, 300));
  check(tx.includes("I-update ang request") && !tx.includes("Verify membership"), "C: update link, no verify / gold");
  await clickText(p, "button", "I-update ang request");
  await p.waitForSelector("#access-request-form");
  check((await p.$eval("#ar-ib", (i) => i.value)) === "Team Ana", "update: same request prefilled");
  await p.close();

  // ---- confirm route never indexed (header + meta), both modes; /privacy version follows the flag ----
  {
    const r = await fetch(`${BASE}/system/join/confirm`, { redirect: "manual" });
    check(r.headers.get("x-robots-tag") === "noindex, nofollow", "confirm: X-Robots-Tag noindex, nofollow header", String(r.headers.get("x-robots-tag")));
    check(r.headers.get("referrer-policy") === "no-referrer", "confirm: Referrer-Policy no-referrer header", String(r.headers.get("referrer-policy")));
    p = await open("/system/join/confirm", null);
    const rb = await p.$eval('meta[name="robots"]', (m) => m.content).catch(() => "");
    check(/noindex/.test(rb) && /nofollow/.test(rb), "confirm: robots meta noindex, nofollow", rb);
    await p.close();
    p = await open("/privacy", null);
    const pv = await text(p);
    check(FLAG_ON ? pv.includes("Version: 1.5") && pv.includes("Different ACCM email") : pv.includes("Version: 1.4") && !pv.includes("Different ACCM email"),
      FLAG_ON ? "/privacy serves v1.5 (live)" : "/privacy serves v1.4 (rollback)");
    await p.close();
  }

  // ---- page titles: the layout template adds the site name once ----
  for (const [path, want] of [["/privacy", "Privacy Notice | GFX Society"], ["/terms", "Terms of Use | GFX Society"], ["/risk", "Risk Disclaimer | GFX Society"], ["/disclosure", "IB Disclosure | GFX Society"]]) {
    p = await open(path, null);
    const ti = await p.title();
    check(ti === want, `${path}: title has the site name once`, ti);
    await p.close();
  }

  // ---- QA Q2: awaiting vs. after the 7-day purge of an unconfirmed ACCM email ----
  p = await open("/system/join", "awaiting");
  tx = await text(p);
  check(tx.includes("Halos tapos na. I-click ang confirmation link") && !tx.includes("May active request ka na"), "awaiting: pending-confirmation copy", tx.slice(0, 300));
  await p.close();
  p = await open("/system/join", "purged");
  await layout(p, "join after Q2 purge", { gold: 0 });
  tx = await text(p);
  check(tx.includes(`May active request ka na, submitted Nov 3, 2026. Iche-check ito sa ${want}, at sa bawat monthly update hanggang ma-match.`) && !tx.includes("Halos tapos na"),
    "Q2 purged: normal active-request copy, no awaiting copy", tx.slice(0, 300));
  check(tx.includes("I-update ang request") && !tx.includes("Verify membership"), "Q2 purged: update link, no verify / gold");
  await clickText(p, "button", "I-update ang request");
  await p.waitForSelector("#access-request-form");
  if (FLAG_ON) check((await p.$eval('input[name="accm_email"]', (i) => i.value).catch(() => null)) === "", "Q2 purged + flag on: update form lets them re-enter the ACCM email (empty field)");
  else check(!(await p.$('input[name="accm_email"]')), "Q2 purged + flag off: update form, no ACCM field");
  await p.close();

  // ---- confirm landing (QA N1: GET never confirms; POST button for the signed-in requester; token in #fragment) ----
  const TOK = "a".repeat(64);
  const confirms = () => rpcLog.filter((x) => x === "confirm_accm_email").length;
  let before = confirms();
  if (!FLAG_ON) {
    for (const path of [`/system/join/confirm#token=${TOK}`, `/system/join/confirm?token=${TOK}`]) {
      p = await open(path, "consented");
      tx = await text(p);
      check(tx.includes("May error sa pag-check.") && !(await p.$('button[type="submit"]')) && confirms() === before, `flag off: ${path.includes("#") ? "#" : "?"}token -> neutral error, no button, no RPC`);
      await p.close();
    }
  } else {
    p = await open(`/system/join/confirm#token=${TOK}`, "consented");
    await p.waitForSelector('button[type="submit"]');
    await layout(p, "confirm signed-in button", { gold: 1 });
    check(confirms() === before, "flag on: GET render does not confirm (no RPC before the click)");
    check(!(await p.evaluate(() => location.hash)), "flag on: #token stripped from the address bar");
    check((await p.$eval('meta[name="referrer"]', (m) => m.content).catch(() => "")) === "no-referrer", "confirm: referrer meta no-referrer");
    await clickText(p, "button", "I-confirm ang ACCM email");
    await p.waitForFunction(() => document.body.innerText.includes("Na-confirm na ang ACCM email mo."), { timeout: 10000 }).catch(() => {});
    check((await text(p)).includes("Na-confirm na ang ACCM email mo.") && confirms() === before + 1, "flag on: POST button -> one RPC -> confirmed copy");
    check(await p.evaluate(() => sessionStorage.getItem("gfx_accm_confirm") === null), "flag on: token cleared from sessionStorage after confirm");
    await p.close();
    // logged out: login prompt, token kept in this tab only, no RPC
    before = confirms();
    p = await open(`/system/join/confirm#token=${TOK}`);
    await p.waitForSelector('a[href="/login?next=%2Fsystem%2Fjoin%2Fconfirm"]');
    await layout(p, "confirm logged out", { gold: 1 });
    check((await text(p)).includes("Mag-log in muna gamit ang Academy account na nag-request") && confirms() === before, "flag on: logged out -> login prompt, no RPC, token not in login URL");
    await p.close();
    // other account / bad token -> one neutral answer
    p = await open(`/system/join/confirm#token=${"b".repeat(64)}`, "consented");
    await p.waitForSelector('button[type="submit"]');
    await clickText(p, "button", "I-confirm ang ACCM email");
    await p.waitForFunction(() => document.body.innerText.includes("Hindi gumana ang link na ito."), { timeout: 10000 }).catch(() => {});
    check((await text(p)).includes("Hindi gumana ang link na ito."), "flag on: RPC 'invalid' -> neutral invalid copy");
    await p.close();
    p = await open(`/system/join/confirm`, "consented");
    await p.waitForFunction(() => document.body.innerText.includes("Hindi gumana ang link na ito."), { timeout: 10000 }).catch(() => {});
    check((await text(p)).includes("Hindi gumana ang link na ito.") && !(await p.$('button[type="submit"]')), "flag on: no token -> neutral invalid, no button");
    await p.close();
  }
} catch (e) {
  check(false, "unexpected", e.message);
} finally {
  await browser.close();
  mock.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
