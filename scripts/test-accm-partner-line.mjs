// Every rendered link to /accm or an ACCM URL must have the partner line in the same section/card (QA prod P2, 2 Nov).
// Run against a running build, logged out: BASE=http://localhost:3058 node scripts/test-accm-partner-line.mjs
// "Same section" = walking up from the <a> through its ancestors, the line appears inside an ancestor no higher than
// the nearest enclosing <section>/<article>/<li>/<aside>/<footer>/<header> (or, with none of those, within MAX_DIVS div
// levels). Only if the HTML can't be parsed into a tree around the link does it fall back to a WINDOW-char check.
// STRIP_LINE=1 removes the line from every page first (negative check: must then fail).
import assert from "node:assert/strict";
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const LINE = "Partner broker ng GFX ang ACCM.";
const WINDOW = 1500;
const MAX_DIVS = 3;
const ACCM_HREF = /^(?:\/accm(?:[/?#]|$)|https?:\/\/(?:[\w-]+\.)*accm\.[a-z]+(?:[/?#]|$))/i;
const EXTRA = ["/", "/start", "/community", "/academy", "/academy/gold-starter", "/broker", "/accm", "/resources", "/system", "/system/join", "/go/ig_bio", "/go/fb_bio", "/go/tt_bio", "/en/academy/gold-starter"];
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const BOUNDARY = new Set(["section", "article", "li", "aside", "footer", "header"]);

// Minimal tag-stack parser: returns, for every element, [tag, start, end) offsets and its parent index.
export function parse(html) {
  const els = []; const stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = stack.findLastIndex((k) => els[k].tag === tag);
      if (i < 0) continue;
      for (const k of stack.splice(i)) els[k].end = m.index + m[0].length;
    } else {
      els.push({ tag, start: m.index, end: html.length, parent: stack.at(-1) ?? -1 });
      if (!VOID.has(tag) && !m[3]) stack.push(els.length - 1);
    }
  }
  return els;
}

export function hasLineInSection(html, els, aStart) {
  const a = els.findIndex((e) => e.start === aStart && e.tag === "a");
  if (a < 0) return html.slice(Math.max(0, aStart - WINDOW), aStart + WINDOW).includes(LINE); // fallback
  let divs = 0;
  for (let k = els[a].parent; k >= 0; k = els[k].parent) {
    const e = els[k];
    if (e.tag === "body" || e.tag === "main" || e.tag === "html") return false;
    if (html.slice(e.start, e.end).includes(LINE)) return true;
    if (BOUNDARY.has(e.tag)) return false;
    if (e.tag === "div" && ++divs >= MAX_DIVS && !els.some((x, i) => i !== k && BOUNDARY.has(x.tag) && x.start < e.start && x.end >= e.end)) return false;
  }
  return false;
}

function selfTest() {
  const ok = `<main><section><p>x</p><div><a href="/accm">Go</a></div><p>${LINE}</p></section></main>`;
  const neighbour = `<main><section><div><a href="/accm">Go</a></div></section><section><p>${LINE}</p></section></main>`;
  const run = (h) => hasLineInSection(h, parse(h), h.indexOf("<a "));
  assert.equal(run(ok), true, "self-test: line in same section must pass");
  assert.equal(run(neighbour), false, "self-test: line in neighbouring section must fail");
}
selfTest();

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const fromSitemap = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const pages = [...new Set([...EXTRA, ...fromSitemap])];
let links = 0, n = 0; const bad = [];
for (const p of pages) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  if (r.status !== 200) continue;
  let html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, (s) => " ".repeat(s.length));
  if (process.env.STRIP_LINE) html = html.split(LINE).join(" ".repeat(LINE.length));
  n++;
  const els = parse(html);
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!ACCM_HREF.test(href)) continue;
    links++;
    if (!hasLineInSection(html, els, m.index)) bad.push(`${p} -> ${href.slice(0, 60)}`);
  }
}
console.log(`pages=${n} accm_links=${links}`);
assert.ok(n >= 10 && links >= 5, "crawl found too little; is the server up?");
assert.deepEqual(bad, [], `ACCM links without the partner line in the same section:\n${bad.join("\n")}`);
console.log("ALL PASS");
