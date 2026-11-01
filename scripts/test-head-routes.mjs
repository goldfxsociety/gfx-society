// HEAD must behave exactly like GET on gated / 404 routes (QA #57 P2-2 + proxy-gate HEAD).
// Run against a local `next start`, logged out: BASE=http://localhost:3057 node scripts/test-head-routes.mjs
import assert from "node:assert/strict";
const BASE = process.env.BASE ?? "http://localhost:3000";
const CASES = [
  ["/training", 307, "/login?next=%2Ftraining"],
  ["/courses/gold-reset/placement", 307, "/login?next=%2Fcourses%2Fgold-reset%2Fplacement"],
  ["/courses/gold-reset/capstone", 307, "/login?next=%2Fcourses%2Fgold-reset%2Fcapstone"],
  ["/courses/gold-reset/pay", 307, "/login?next=%2Fcourses%2Fgold-reset%2Fpay"],
  ["/admin/payments", 404],
  ["/go/zz-unknown-code", 404],
  ["/courses/nope", 404],
];
let n = 0;
for (const [path, status, loc] of CASES)
  for (const method of ["GET", "HEAD"]) {
    const r = await fetch(BASE + path, { method, redirect: "manual" });
    assert.equal(r.status, status, `${method} ${path}`);
    if (loc) assert.equal(new URL(r.headers.get("location"), BASE).pathname + new URL(r.headers.get("location"), BASE).search, loc, `${method} ${path} location`);
    n++; console.log("PASS", method, path, r.status);
  }
console.log(`ALL PASS (${n})`);
