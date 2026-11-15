// /resources partner line must render no matter what the resource rows say (post-launch fix 1).
// After 20261102220000 clears the WikiFX description, no row text mentions ACCM, but the card
// still links to ACCM's WikiFX page, so the disclosure has to stay.
import fs from "node:fs";
import assert from "node:assert/strict";
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); }; // awaits async tests (QA #57 P3)
const page = fs.readFileSync("src/app/resources/page.tsx", "utf8");
const mig = fs.readFileSync("supabase/migrations/20261102220000_resources_wikifx_copy.sql", "utf8");
await t("disclosure <p> renders IB_DISCLOSURE_TEXT", () => assert.match(page, /<p[^>]*>\{IB_DISCLOSURE_TEXT\}<\/p>/));
await t("disclosure is not behind a condition (no `&&` / ternary on that line)", () => {
  const line = page.split("\n").find((l) => l.includes("{IB_DISCLOSURE_TEXT}"));
  assert.ok(line && !/&&|\?/.test(line), line);
  assert.doesNotMatch(page, /mentionsAccm/);
});
await t("partner text is the approved line", async () => {
  await Promise.resolve();
  const cfg = fs.readFileSync("src/config/partners.ts", "utf8");
  assert.match(cfg, /IB_DISCLOSURE_TEXT = "Partner broker ng GFX ang ACCM\."/);
});
await t("after the WikiFX migration no row text mentions ACCM, so a text-driven line would have hidden", () => {
  assert.match(mig, /set description = null/);
  const after = { title: "WikiFX — Broker Checker", description: null };
  assert.equal(/ACCM/i.test(`${after.title} ${after.description ?? ""}`), false);
});
// PR70 (QA P2-1): the old local line duplicated RISK_LINE word for word, so the page now renders the shared constant once.
await t("standard line still present (shared RISK_LINE, rendered once)", () => {
  assert.match(page, /import \{ RISK_LINE \} from "@\/config\/training";/);
  assert.equal(page.match(/\{RISK_LINE\}/g)?.length, 1);
  assert.match(fs.readFileSync("src/config/training.ts", "utf8"), /export const RISK_LINE = "Max 1% risk per trade\. Education lang, not financial advice\.";/);
  assert.ok(!/Max 1% risk per trade|not financial advice/.test(page.replace(/\{RISK_LINE\}/g, "")), "no second local copy");
});
console.log(`ALL PASS (${n})`);
