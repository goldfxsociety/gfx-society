// /resources partner line must render no matter what the resource rows say (post-launch fix 1).
// After 20261102220000 clears the WikiFX description, no row text mentions ACCM, but the card
// still links to ACCM's WikiFX page, so the disclosure has to stay.
import fs from "node:fs";
import assert from "node:assert/strict";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("PASS", name); };
const page = fs.readFileSync("src/app/resources/page.tsx", "utf8");
const mig = fs.readFileSync("supabase/migrations/20261102220000_resources_wikifx_copy.sql", "utf8");
t("disclosure <p> renders IB_DISCLOSURE_TEXT", () => assert.match(page, /<p[^>]*>\{IB_DISCLOSURE_TEXT\}<\/p>/));
t("disclosure is not behind a condition (no `&&` / ternary on that line)", () => {
  const line = page.split("\n").find((l) => l.includes("{IB_DISCLOSURE_TEXT}"));
  assert.ok(line && !/&&|\?/.test(line), line);
  assert.doesNotMatch(page, /mentionsAccm/);
});
t("partner text is the approved line", async () => {
  const cfg = fs.readFileSync("src/config/partners.ts", "utf8");
  assert.match(cfg, /IB_DISCLOSURE_TEXT = "Partner broker ng GFX ang ACCM\."/);
});
t("after the WikiFX migration no row text mentions ACCM, so a text-driven line would have hidden", () => {
  assert.match(mig, /set description = null/);
  const after = { title: "WikiFX — Broker Checker", description: null };
  assert.equal(/ACCM/i.test(`${after.title} ${after.description ?? ""}`), false);
});
t("standard line still present", () => assert.match(page, /Education lang, not financial advice\. Max 1% risk per trade\./));
console.log(`ALL PASS (${n})`);
