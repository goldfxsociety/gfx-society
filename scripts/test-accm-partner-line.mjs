// Every rendered link to /accm or an ACCM URL must have the partner line nearby (QA prod P2, 2 Nov).
// Run against a running build, logged out: BASE=http://localhost:3058 node scripts/test-accm-partner-line.mjs
// "Nearby" = the partner line text appears in the HTML within WINDOW chars before or after the <a>.
import assert from "node:assert/strict";
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const LINE = "Partner broker ng GFX ang ACCM.";
const WINDOW = 1500;
const ACCM_HREF = /^(?:\/accm(?:[/?#]|$)|https?:\/\/(?:[\w-]+\.)*accm\.[a-z]+(?:[/?#]|$))/i;
const EXTRA = ["/", "/start", "/community", "/academy", "/academy/gold-starter", "/broker", "/accm", "/resources", "/system", "/system/join", "/go/ig_bio", "/go/fb_bio", "/go/tt_bio", "/en/academy/gold-starter"];
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const fromSitemap = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const pages = [...new Set([...EXTRA, ...fromSitemap])];
let links = 0, n = 0; const bad = [];
for (const p of pages) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  if (r.status !== 200) continue;
  const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, (s) => " ".repeat(s.length));
  n++;
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!ACCM_HREF.test(href)) continue;
    links++;
    const near = html.slice(Math.max(0, m.index - WINDOW), m.index + m[0].length + WINDOW);
    if (!near.includes(LINE)) bad.push(`${p} -> ${href.slice(0, 60)}`);
  }
}
console.log(`pages=${n} accm_links=${links}`);
assert.ok(n >= 10 && links >= 5, "crawl found too little; is the server up?");
assert.deepEqual(bad, [], `ACCM links without the partner line nearby:\n${bad.join("\n")}`);
console.log("ALL PASS");
