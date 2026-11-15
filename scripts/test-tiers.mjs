// Sprint 3 tier gating (explorer-linked-tiers-spec.md v1.1): Explorer opens Gold Reset; Explorer cannot open
// Strategy Basics or Advanced Setups; Linked opens all three. Pure logic + source guards, no network, no secrets.
// The DB side of the same rules (has_course_access / my_payment_info / RLS) is in scripts/qa/pglite-explorer-linked-tiers.mjs.
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-tiers.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const T = await import(path.join(root, "src/lib/members/tier.ts"));
const { memberCourseState, showMembersNav } = await import(path.join(root, "src/lib/training/member-surface.ts"));
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };

const GR = "gold-reset", SB = "gold-strategy-basics", AS = "gold-advanced-setups";
const explorer = { loggedIn: true, confirmed: true, membership: "none", consented: true };
const linked = (m = "active") => ({ loggedIn: true, confirmed: true, membership: m, consented: false });

await t("tierFrom: guest / explorer / linked", () => {
  assert.equal(T.tierFrom({ loggedIn: false, confirmed: false, membership: "none" }), "guest");
  assert.equal(T.tierFrom({ loggedIn: true, confirmed: false, membership: "none" }), "guest");
  assert.equal(T.tierFrom({ loggedIn: true, confirmed: true, membership: "none" }), "explorer");
  assert.equal(T.tierFrom({ loggedIn: true, confirmed: true, membership: "active" }), "linked");
  assert.equal(T.tierFrom({ loggedIn: true, confirmed: true, membership: "grace" }), "linked");
});
await t("Explorer can open Gold Reset (lessons + capstone) after join-v2 consent", () => {
  for (const sub of ["l1", "l7", "capstone"]) assert.equal(T.courseRouteAccess(explorer, GR, sub), "allow", sub);
});
await t("Explorer without consent: Gold Reset goes to the join door (consent first)", () => {
  assert.equal(T.courseRouteAccess({ ...explorer, consented: false }, GR, "l1"), "join");
});
await t("Explorer cannot open Strategy Basics or Advanced Setups (even with consent)", () => {
  for (const slug of [SB, AS]) for (const sub of ["l1", "capstone", "pay", "placement"]) assert.equal(T.courseRouteAccess(explorer, slug, sub), "join", `${slug}/${sub}`);
});
await t("Explorer never reaches Gold Reset /pay or /placement", () => {
  for (const sub of ["pay", "placement"]) assert.equal(T.courseRouteAccess(explorer, GR, sub), "join", sub);
});
await t("Linked (active + grace) can open all three", () => {
  for (const m of ["active", "grace"]) for (const slug of [GR, SB, AS]) assert.equal(T.courseRouteAccess(linked(m), slug, "l1"), "allow", `${m} ${slug}`);
});
await t("logged out -> login for every course", () => {
  for (const slug of [GR, SB, AS]) assert.equal(T.courseRouteAccess({ loggedIn: false, membership: "none", consented: false }, slug, "l1"), "login");
});
await t("/training: Explorer + Linked allowed; unconfirmed -> join; logged out -> login", () => {
  assert.equal(T.trainingRouteAccess({ loggedIn: true, confirmed: true, membership: "none" }), "allow");
  assert.equal(T.trainingRouteAccess({ loggedIn: true, confirmed: true, membership: "grace" }), "allow");
  assert.equal(T.trainingRouteAccess({ loggedIn: true, confirmed: false, membership: "none" }), "join");
  assert.equal(T.trainingRouteAccess({ loggedIn: false, confirmed: false, membership: "none" }), "login");
});
await t("isExplorerCourse: only Gold Reset", () => {
  assert.deepEqual([...T.EXPLORER_COURSES], [GR]);
  assert.equal(T.isExplorerCourse(GR), true);
  for (const s of [SB, AS, "", "gold-reset-2"]) assert.equal(T.isExplorerCourse(s), false, s);
});
await t("isGoldResetPath: course, lesson, capstone; never pay / placement / other courses / open redirects", () => {
  for (const p of ["/courses/gold-reset", "/courses/gold-reset/", "/courses/gold-reset/l1", "/courses/gold-reset/capstone", "/courses/gold-reset/l2?x=1"]) assert.equal(T.isGoldResetPath(p), true, p);
  for (const p of ["/courses/gold-reset/pay", "/courses/gold-reset/placement", "/courses/gold-strategy-basics/l1", "/courses/gold-reset/l1/x", "//evil.test/courses/gold-reset", "https://evil.test/courses/gold-reset", "", null, undefined]) assert.equal(T.isGoldResetPath(p), false, String(p));
});
await t("homeGold: exactly one gold; Explorer gets the outline Link unless the gold is Link", () => {
  assert.deepEqual(T.homeGold({ tier: "explorer", consented: false, action: "lesson" }), { gold: { kind: "consent" }, outlineLink: true });
  assert.deepEqual(T.homeGold({ tier: "explorer", consented: true, action: "lesson" }), { gold: { kind: "lesson" }, outlineLink: true });
  assert.deepEqual(T.homeGold({ tier: "explorer", consented: true, action: "capstone" }), { gold: { kind: "finished" }, outlineLink: true });
  assert.deepEqual(T.homeGold({ tier: "explorer", consented: true, action: "review" }), { gold: { kind: "link" }, outlineLink: false });
  assert.deepEqual(T.homeGold({ tier: "explorer", consented: true, action: "empty" }), { gold: { kind: "link" }, outlineLink: false });
  assert.deepEqual(T.homeGold({ tier: "linked", consented: true, action: "lesson" }), { gold: { kind: "lesson" }, outlineLink: false });
  assert.deepEqual(T.homeGold({ tier: "linked", consented: false, action: "review" }), { gold: { kind: "finished" }, outlineLink: false });
  assert.deepEqual(T.homeGold({ tier: "linked", consented: false, action: "empty" }), { gold: { kind: "none" }, outlineLink: false });
});
await t("memberCourseState: Explorer card states follow the DB (free only for consented Gold Reset)", () => {
  assert.equal(memberCourseState("none", "free", 7, 0), "free_new");
  assert.equal(memberCourseState("none", "free", 7, 3), "free_progress");
  for (const p of ["open", "closed", "locked", "pending", "rejected"]) assert.equal(memberCourseState("none", p, 7, 0), "verify", p);
  assert.equal(memberCourseState("none", "approved", 7, 0), "owned", "S8 delisted owner");
  assert.equal(memberCourseState("active", "open", 7, 0), "not_owned");
  assert.equal(showMembersNav("none", true), true); assert.equal(showMembersNav("none", false), false);
});
await t("source guards: proxy uses the tier rules; no User ID field; no 'FREE para sa verified members'; funding not gated", () => {
  const gate = read("src/lib/training/proxy-gate.ts");
  assert.match(gate, /my_join_state/);
  assert.match(gate, /email_confirmed_at/);
  const files = ["src/app/system/join/join-form.tsx", "src/app/system/join/actions.ts", "src/content/access-request.ts", "src/content/members-gate.ts", "src/config/training.ts", "src/config/members-home.ts"];
  for (const f of files) {
    const s = read(f);
    assert.ok(!/FREE para sa verified members/i.test(s), f);
    assert.ok(!/accm_?user_?id|userId|"User ID"/i.test(s), `${f}: email-only matching, no User ID`);
  }
  for (const f of ["src/lib/members/tier.ts", "src/lib/members/tier-server.ts", "src/lib/training/proxy-gate.ts"]) assert.ok(!/deposit|funded|balance/i.test(read(f).replace(/Funding is never part of the gate[^\n]*/g, "")), `${f}: no funding gate`);
});

console.log(`ALL PASS tiers (${n})`);
