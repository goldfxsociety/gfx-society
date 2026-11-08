// Members nav persistence and closed-sales vs empty-course copy.
// node --experimental-strip-types scripts/test-members-p2.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ME } from "../src/config/members-home.ts";
import { courseLockCopy, memberCourseState, showMembersNav } from "../src/lib/training/member-surface.ts";

const BUY = "🔒 Bilhin para mabuksan ang course na ito.";
const EMPTY = "🔒 Inaayos pa ang lessons nito.";
const read = (path) => readFileSync(path, "utf8");

assert.equal(ME.lockedUnpaid, BUY);
assert.equal(ME.lockedNoContent, EMPTY);
assert.equal(showMembersNav("active"), true);
assert.equal(showMembersNav("grace"), true);
assert.equal(showMembersNav("none"), false);

function lock(state) {
  const kind = courseLockCopy(state);
  if (kind === "buy_locked") return BUY;
  if (kind === "no_content") return EMPTY;
  return null;
}

// Closed paid course with published lessons: buy-locked, even though lesson rows are not loaded.
for (const count of [0, 23]) {
  const state = memberCourseState("active", "closed", count, 0);
  assert.equal(state, "sales_closed", String(count));
  assert.equal(lock(state), BUY);
  assert.notEqual(lock(state), EMPTY);
}

// Genuinely empty / not ready: preparing copy, not the buy-locked line.
{
  const state = memberCourseState("active", "coming_soon", 0, 0);
  assert.equal(state, "coming_soon");
  assert.equal(lock(state), EMPTY);
}
{
  const state = memberCourseState("active", "free", 0, 0);
  assert.equal(state, "coming_soon");
  assert.equal(lock(state), EMPTY);
}
{
  const state = memberCourseState("active", "free", 5, 0);
  assert.equal(state, "free_new");
  assert.equal(lock(state), null);
}

// Prereq lock and open sales stay on their existing states.
assert.equal(memberCourseState("active", "locked", 0, 0), "locked");
assert.equal(lock("locked"), null);
assert.equal(memberCourseState("active", "open", 0, 0), "not_owned");
assert.equal(lock("not_owned"), BUY);
assert.equal(memberCourseState("active", "approved", 23, 0), "owned");

// Nonmember and removed (membership none) do not get the member nav.
// A removed owner still resolves a bought course as owned; other courses stay verify.
assert.equal(memberCourseState("none", "closed", 23, 0), "verify");
assert.equal(memberCourseState("none", "approved", 23, 4), "owned");
assert.equal(showMembersNav("none"), false);

const coursesLib = read("src/lib/training/courses.ts");
assert.match(coursesLib, /pay\.state === "approved" \|\| pay\.state === "free"/);
assert.equal(coursesLib.includes("getLessons"), true);

const training = read("src/app/training/page.tsx");
assert.match(training, /case "sales_closed":/);
assert.match(training, /ME\.lockedUnpaid/);
assert.match(training, /ME\.lockedNoContent/);

for (const path of ["src/app/courses/page.tsx", "src/app/account/page.tsx"]) {
  const text = read(path);
  assert.match(text, /showMembersNav/, path);
  assert.match(text, /<MembersNav/, path);
  assert.match(text, /if \(!member\) return|if \(!showMembersNav\(membership\)\) return/, path);
}
assert.match(read("src/app/courses/page.tsx"), /active="courses"/);
assert.match(read("src/app/account/page.tsx"), /active="account"/);
assert.match(read("src/app/courses/page.tsx"), /case "sales_closed":/);
assert.match(read("src/app/courses/[slug]/page.tsx"), /v\.state === "sales_closed"/);
assert.match(read("src/app/courses/[slug]/page.tsx"), /ME\.lockedUnpaid/);
assert.equal(read("src/app/courses/[slug]/page.tsx").includes('v.state === "not_owned"'), true);
assert.match(read("src/app/courses/[slug]/page.tsx"), /Capstone \(self-check\)/);

const risk = read("src/config/training.ts");
assert.match(risk, /export const RISK_LINE = "Max 1% risk per trade\. Education lang, not financial advice\."/);
assert.equal(risk.includes("Education lang, not financial advice. Max 1% risk per trade."), false);

for (const path of [
  "src/app/training/page.tsx",
  "src/app/courses/page.tsx",
  "src/app/courses/[slug]/page.tsx",
  "src/app/account/page.tsx",
  "src/lib/training/member-surface.ts",
]) {
  const text = read(path);
  assert.equal(/IB_DISCLOSURE|Partner broker|Introducing Broker/.test(text), false, path);
  assert.equal((text.match(/<MembersFooter/g) ?? []).length <= 1, true, path);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}
for (const path of walk("src/app/en")) {
  const text = read(path);
  assert.equal(text.includes(BUY), false, path);
  assert.equal(text.includes(EMPTY), false, path);
  assert.equal(text.includes("Ituloy ang capstone"), false, path);
}

const nav = read("src/components/members-home/members-nav.tsx");
assert.deepEqual(
  [...nav.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]),
  ["/training", "/courses", "/account"],
);

console.log("ALL PASS members nav and closed-course copy");
