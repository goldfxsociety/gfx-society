#!/usr/bin/env node
// Fails if Tagalog/Taglish strings render on /en routes (visible text + aria-label, alt, title, placeholder, meta content).
// Usage: BASE_URL=http://localhost:3000 npm run check:en-tl   (needs a running server: npm run build && npm start)
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Every static page under src/app/en (dynamic [segments] skipped).
function enRoutes(dir = "src/app/en") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...enRoutes(p));
    else if (/^page\.(t|j)sx?$/.test(name)) {
      const rel = relative("src/app", dir).split(sep).filter((s) => !/^\(.*\)$/.test(s));
      if (!rel.some((s) => s.startsWith("["))) out.push("/" + rel.join("/"));
    }
  }
  return out;
}

// Common Tagalog markers (whole-word, case-insensitive) + exact TL UI strings found on /en.
const WORDS = ["ang","ng","mga","sa","ka","mo","ito","kung","hindi","para","lang","muna","pwede","puwede","buksan","simulan","tingnan","basahin","kaya","natin","ninyo","ako","ikaw","at","na","po","namin","kami","ninyo","dito","iyan","bawat","libre","isulat","alamin","laging","walang","bago"];
const PHRASES = ["Buksan ang lesson", "Simulan sa Step 1", "Tingnan ang steps", "para sa Filipino traders", "laging may stop loss"];
// Intentional / proper nouns. Removed from text before matching.
const ALLOW = ["Lesson in Taglish for now", "(the sign-up pages are in Taglish for now)", "Tagalog / Taglish", "Taglish", "Tagalog",
  // English phrases containing a marker word
  "at risk"];

const ent = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ent[e] ?? m);

function extract(html) {
  const parts = [];
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? "";
  const t = head.match(/<title>([\s\S]*?)<\/title>/i); if (t) parts.push(["<title>", t[1]]);
  for (const m of head.matchAll(/<meta\s[^>]*content="([^"]*)"[^>]*>/gi)) parts.push(["meta " + (m[0].match(/(?:name|property)="([^"]*)"/)?.[1] ?? ""), m[1]]);
  const body = (html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  for (const m of body.matchAll(/\s(aria-label|alt|title|placeholder)="([^"]*)"/gi)) parts.push([m[1], m[2]]);
  parts.push(["text", body.replace(/<[^>]+>/g, " ")]);
  return parts.map(([w, s]) => [w, decode(s).replace(/\s+/g, " ")]);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = new RegExp(`(?<![\\p{L}])(${[...PHRASES.map(esc), ...WORDS].join("|")})(?![\\p{L}])`, "giu");

let fail = 0;
for (const route of enRoutes()) {
  const res = await fetch(BASE + route);
  if (res.status !== 200) { console.error(`FAIL ${route}: HTTP ${res.status}`); fail++; continue; }
  const hits = [];
  for (const [where, raw] of extract(await res.text())) {
    let s = raw; for (const a of ALLOW) s = s.split(a).join(" ");
    for (const m of s.matchAll(re)) hits.push(`${where}: "${m[1]}" … ${s.slice(Math.max(0, m.index - 30), m.index + 40).trim()}`);
  }
  if (hits.length) { fail++; console.error(`FAIL ${route}: ${hits.length} Tagalog hit(s)`); hits.forEach((h) => console.error("  " + h)); }
  else console.log(`PASS ${route}`);
}
process.exit(fail ? 1 : 0);
