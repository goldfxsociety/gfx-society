// Status-code check against a running build (next start). Usage: node scripts/qa/http-404-check.mjs http://localhost:3957
const base = process.argv[2] ?? "http://localhost:3000";
const cases = [
  ["GET", "/courses/nope-xyz", 404], ["HEAD", "/courses/nope-xyz", 404],
  ["GET", "/courses/nope-xyz/pay", 404], ["HEAD", "/courses/nope-xyz/pay", 404],
  ["GET", "/courses/gold-strategy-basics", 200], ["HEAD", "/courses/gold-strategy-basics", 200],
  ["GET", "/courses", 200],
];
let fail = 0;
for (const [method, p, want] of cases) {
  const r = await fetch(base + p, { method, redirect: "manual" });
  const ok = r.status === want; if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", method, p, r.status, `(want ${want})`);
}
console.log(`\n${cases.length - fail} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
