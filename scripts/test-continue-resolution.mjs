// Continue / capstone resolution for the members learning dashboard.
// node --experimental-strip-types scripts/test-continue-resolution.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CONTINUE_ACTION_CLASS,
  CONTINUE_COPY,
  capstoneAvailability,
  continueHref,
  continueLabel,
  resolveContinue,
  showCurriculumCapstone,
  unfinishedLesson,
} from "../src/lib/training/continue.ts";

const CAPSTONE = "Lessons tapos na. Ituloy ang capstone.";
const REVIEW = "Course tapos na. Balikan ang lessons.";
const MISLEADING = ["Ituloy →", "Continue →", "Continue:", "Start →", "Review"];

function lesson(id, opts = {}) {
  return { id, slug: id, title: `Lesson ${id}`, completed: false, ...opts };
}

function label(action, done = 0) {
  return continueLabel(action, done, { start: "Start →", resume: "Continue →" });
}

function assertReview(action, firstId) {
  assert.equal(action.kind, "review");
  assert.equal(action.lesson.slug, firstId);
  assert.equal(label(action, 3), REVIEW);
  assert.equal(continueHref("gold-strategy-basics", action), `/courses/gold-strategy-basics/${firstId}`);
  for (const bad of MISLEADING) assert.equal(label(action, 3).includes(bad), false, bad);
}

const none = [lesson("l1"), lesson("l2"), lesson("l3")];
const partial = [lesson("l1", { completed: true }), lesson("l2"), lesson("l3", { completed: true })];
const done = [lesson("l1", { completed: true }), lesson("l2", { completed: true })];

// No activity: first unfinished lesson, labeled as a start. Not a finished-course fallback.
{
  const action = resolveContinue(none, { state: "unfinished" });
  assert.equal(action.kind, "lesson");
  assert.equal(action.lesson.slug, "l1");
  assert.equal(label(action, 0), "Start →");
  assert.equal(continueHref("gold-reset", action), "/courses/gold-reset/l1");
  assert.equal(showCurriculumCapstone(none.length, { state: "unfinished" }), true);
}

// Unfinished accessible lesson wins over an unfinished capstone.
{
  const action = resolveContinue(partial, { state: "unfinished" });
  assert.equal(action.kind, "lesson");
  assert.equal(action.lesson.slug, "l2");
  assert.equal(label(action, 2), "Continue →");
  assert.notEqual(continueHref("gold-strategy-basics", action), "/courses/gold-strategy-basics/capstone");
}

// Lessons complete, capstone applicable and unfinished.
{
  const cap = { state: "unfinished" };
  const action = resolveContinue(done, cap);
  assert.equal(action.kind, "capstone");
  assert.equal(label(action, done.length), CAPSTONE);
  assert.equal(CONTINUE_COPY.capstone, CAPSTONE);
  assert.equal(continueHref("gold-strategy-basics", action), "/courses/gold-strategy-basics/capstone");
  assert.equal(showCurriculumCapstone(done.length, cap), true);
  for (const bad of MISLEADING) assert.equal(label(action, done.length).includes(bad), false, bad);
}

// Capstone absent: explicit review, curriculum row hidden, no lesson-one continue label.
{
  const cap = { state: "absent" };
  const action = resolveContinue(done, cap);
  assertReview(action, "l1");
  assert.equal(showCurriculumCapstone(done.length, cap), false);
  assert.equal(unfinishedLesson(done), undefined);
}

// Unpublished capstone is not applicable.
{
  const cap = { state: "unpublished" };
  const action = resolveContinue(done, cap);
  assertReview(action, "l1");
  assert.equal(showCurriculumCapstone(done.length, cap), false);
  assert.notEqual(continueHref("gold-advanced-setups", action), "/courses/gold-advanced-setups/capstone");
}

// Capstone completed: explicit review, row still visible.
{
  const cap = { state: "completed" };
  const action = resolveContinue(done, cap);
  assertReview(action, "l1");
  assert.equal(showCurriculumCapstone(done.length, cap), true);
  assert.equal(CONTINUE_COPY.review, REVIEW);
}

// No lessons: no capstone CTA and no review restart.
{
  const action = resolveContinue([], { state: "unfinished" });
  assert.equal(action.kind, "empty");
  assert.equal(continueHref("gold-reset", action), null);
  assert.equal(label(action, 0), null);
  assert.equal(showCurriculumCapstone(0, { state: "unfinished" }), false);
  assert.equal(showCurriculumCapstone(0, { state: "completed" }), false);
}

// Visible DB row maps to unfinished/completed. A missing row is absent, never a continue fallback.
assert.deepEqual(capstoneAvailability({ exists: false, done: false }), { state: "absent" });
assert.deepEqual(capstoneAvailability({ exists: false, done: true }), { state: "absent" });
assert.deepEqual(capstoneAvailability({ exists: true, done: false }), { state: "unfinished" });
assert.deepEqual(capstoneAvailability({ exists: true, done: true }), { state: "completed" });

for (const token of ["min-h-11", "w-full", "max-w-full", "whitespace-normal", "break-words", "h-auto"]) {
  assert.equal(CONTINUE_ACTION_CLASS.includes(token), true, token);
}

const read = (path) => readFileSync(path, "utf8");
const coursesLib = read("src/lib/training/courses.ts");
assert.equal(coursesLib.includes("?? lessons[0]"), false);
assert.equal(coursesLib.includes("unfinishedLesson"), true);
assert.equal(coursesLib.includes("capstoneAvailability"), true);

const coursePage = read("src/app/courses/[slug]/page.tsx");
assert.equal(coursePage.includes("hasCapstone={false}"), false);
assert.equal(coursePage.includes("showCurriculumCapstone"), true);
assert.equal(coursePage.includes("whitespace-normal"), true);

for (const path of ["src/app/training/page.tsx", "src/app/courses/page.tsx", "src/app/courses/[slug]/page.tsx"]) {
  const text = read(path);
  assert.equal(text.includes("nextLesson"), false, path);
  assert.equal(text.includes(CAPSTONE) || text.includes("continueLabel"), true, path);
  assert.equal(/IB_DISCLOSURE|Partner broker|Introducing Broker/.test(text), false, path);
  assert.equal(text.includes("Max 1% risk per trade"), false, path);
  assert.equal(text.includes("Education lang, not financial advice"), false, path);
  assert.equal((text.match(/<MembersFooter/g) ?? []).length, 1, path);
}

const training = read("src/app/training/page.tsx");
assert.equal((training.match(/variant: "default"/g) ?? []).length, 2);
assert.equal(training.includes("current && lesson ?"), true);
assert.equal(training.includes("finished ?"), true);

const nav = read("src/components/members-home/members-nav.tsx");
assert.deepEqual(
  [...nav.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]),
  ["/training", "/courses", "/account"],
);

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
  assert.equal(text.includes(CAPSTONE), false, path);
  assert.equal(text.includes(REVIEW), false, path);
  assert.equal(text.includes("Ituloy ang capstone"), false, path);
}

console.log("ALL PASS continue resolution");
