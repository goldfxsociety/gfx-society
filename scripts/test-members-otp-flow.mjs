// Offline unit tests for src/lib/members/otp-flow.ts + otp-amr.ts (Node >= 22, type stripping).
// Run: node scripts/test-members-otp-flow.mjs
import assert from "node:assert/strict";
import { replyFloorMs, requestCode, verifyCode } from "../src/lib/members/otp-flow.ts";
import { sessionIsOtp } from "../src/lib/members/otp-amr.ts";
const LISTED = "member@example.test";
const mk = (o = {}) => {
  const log = [];
  const deferred = [];
  return { log, deferred, run: () => Promise.all(deferred.map((w) => w())), deps: {
    defer: (w) => deferred.push(w),
    minReplyMs: () => o.floor ?? 0,
    captchaRequired: o.captcha ?? false,
    codeAllowed: async (e, ip) => { log.push(["gate", e, ip]); return o.gate === undefined ? e === LISTED : o.gate; },
    recordSend: async (e, ip, ok) => { log.push(["record", e, ip, ok]); },
    sendOtp: async (e, tok) => { log.push(["token", tok]); if (o.sendMs) await new Promise((r) => setTimeout(r, o.sendMs)); if (o.sendThrows) throw new Error("smtp down"); if (o.authRejects) return false; log.push(["send", e]); return true; },
    verifyOtp: async (e, t) => { log.push(["verify", e, t]); return o.verify ?? (t === "123456" ? "ok" : "wrong"); },
    recordConsent: async () => { log.push(["consent"]); return o.consent === undefined ? "active" : o.consent; },
  } };
};
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
await t("no consent -> nothing called", async () => { const m = mk(); assert.equal(await requestCode(m.deps, LISTED, false, "1.1.1.1"), "consent_required"); assert.equal(m.log.length, 0); });
await t("bad email -> invalid", async () => { assert.equal(await requestCode(mk().deps, "nope", true, "x"), "invalid_email"); });
await t("listed (normalized) -> code sent after the reply (deferred), neutral 'sent'", async () => { const m = mk(); assert.equal(await requestCode(m.deps, "  Member@Example.TEST ", true, "1.1.1.1"), "sent"); assert.ok(!m.log.some((l) => l[0] === "send")); assert.equal(m.deferred.length, 1); await m.run(); assert.deepEqual(m.log.at(-2), ["send", LISTED]); });
await t("send failure never reaches the reply", async () => { const m = mk({ sendThrows: true }); assert.equal(await requestCode(m.deps, LISTED, true, "1"), "sent"); await assert.rejects(m.run()); });
await t("timing: listed (slow 800ms send) and unlisted replies take the same padded time", async () => {
  const time = async (email) => { const m = mk({ floor: 300, sendMs: 800 }); const s = performance.now(); await requestCode(m.deps, email, true, "1"); return performance.now() - s; };
  const L = [], U = [];
  for (let i = 0; i < 5; i++) { L.push(await time(LISTED)); U.push(await time("x@example.test")); }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`   listed avg ${avg(L).toFixed(1)}ms, unlisted avg ${avg(U).toFixed(1)}ms`);
  assert.ok(Math.min(...L, ...U) >= 295, "every reply is padded to the floor");
  assert.ok(Math.abs(avg(L) - avg(U)) < 25, "listed vs unlisted differ by < 25ms");
  assert.ok(Math.max(...L) < 600, "slow send is not awaited");
});
await t("padding applies to every outcome (no consent / invalid / error)", async () => {
  for (const [args, o] of [[[LISTED, false], {}], [["nope", true], {}], [[LISTED, true], { gate: null }]]) { const m = mk({ ...o, floor: 150 }); const s = performance.now(); await requestCode(m.deps, args[0], args[1], "1"); assert.ok(performance.now() - s >= 145); }
});
await t("replyFloorMs is ~1.2s with jitter", async () => { for (let i = 0; i < 50; i++) { const f = replyFloorMs(); assert.ok(f >= 1200 && f < 1500); } });
await t("unlisted -> NO send, same neutral 'sent'", async () => { const m = mk(); assert.equal(await requestCode(m.deps, "x@example.test", true, "1.1.1.1"), "sent"); assert.ok(!m.log.some((l) => l[0] === "send")); });
await t("gate unavailable -> error, never sends", async () => { const m = mk({ gate: null }); assert.equal(await requestCode(m.deps, LISTED, true, "1"), "error"); assert.ok(!m.log.some((l) => l[0] === "send")); });
await t("wrong code", async () => { const m = mk(); assert.equal(await verifyCode(m.deps, LISTED, "000000"), "wrong_code"); assert.ok(!m.log.some((l) => l[0] === "consent")); });
await t("expired code", async () => { assert.equal(await verifyCode(mk({ verify: "expired" }).deps, LISTED, "123456"), "expired_code"); });
await t("malformed code not sent to Auth", async () => { const m = mk(); assert.equal(await verifyCode(m.deps, LISTED, "12ab"), "wrong_code"); assert.equal(m.log.length, 0); });
await t("right code + listed -> active (spaces ok)", async () => { assert.equal(await verifyCode(mk().deps, LISTED, "123 456"), "active"); });
await t("right code but DB says not listed / not OTP -> not_verified", async () => { assert.equal(await verifyCode(mk({ consent: "none" }).deps, LISTED, "123456"), "not_verified"); });
await t("consent RPC error -> error", async () => { assert.equal(await verifyCode(mk({ consent: null }).deps, LISTED, "123456"), "error"); });
await t("amr: otp session passes", async () => { assert.equal(sessionIsOtp([{ method: "otp", timestamp: 1 }]), true); });
await t("amr: password session denied", async () => { assert.equal(sessionIsOtp([{ method: "password", timestamp: 1 }]), false); });
await t("amr: magiclink/missing/garbage denied", async () => { assert.equal(sessionIsOtp([{ method: "magiclink" }]), false); assert.equal(sessionIsOtp(undefined), false); assert.equal(sessionIsOtp("otp"), false); });
await t("captcha flag OFF: no token needed, none forwarded (flow as before)", async () => { const m = mk(); assert.equal(await requestCode(m.deps, LISTED, true, "1"), "sent"); await m.run(); assert.deepEqual(m.log.find((l) => l[0] === "token"), ["token", undefined]); assert.ok(m.log.some((l) => l[0] === "send")); });
await t("captcha flag ON + token: token forwarded to signInWithOtp", async () => { const m = mk({ captcha: true }); assert.equal(await requestCode(m.deps, LISTED, true, "1", "tok-123"), "sent"); await m.run(); assert.deepEqual(m.log.find((l) => l[0] === "token"), ["token", "tok-123"]); });
await t("captcha flag ON, no token: neutral 'sent', no gate call, no send, still padded", async () => { const m = mk({ captcha: true, floor: 150 }); const s0 = performance.now(); assert.equal(await requestCode(m.deps, LISTED, true, "1", ""), "sent"); assert.ok(performance.now() - s0 >= 145); assert.equal(m.log.length, 0); await m.run(); assert.deepEqual(m.log, [["record", LISTED, "1", false]], "only the per-IP reject bucket"); });
await t("captcha flag ON, unlisted + token: neutral 'sent', no send", async () => { const m = mk({ captcha: true }); assert.equal(await requestCode(m.deps, "x@example.test", true, "1", "tok"), "sent"); assert.equal(m.deferred.length, 0); assert.ok(!m.log.some((l) => l[0] === "record"), "unlisted uses no slot"); });
await t("P3: real send accepted by Supabase -> slot recorded as accepted (email + IP)", async () => { const m = mk({ captcha: true }); await requestCode(m.deps, LISTED, true, "1", "tok"); assert.ok(!m.log.some((l) => l[0] === "record"), "not counted before the send"); await m.run(); assert.deepEqual(m.log.at(-1), ["record", LISTED, "1", true]); });
await t("P3: junk token rejected by Supabase -> NOT an email slot (reject bucket only), same neutral padded reply", async () => { const m = mk({ captcha: true, authRejects: true, floor: 150 }); const s0 = performance.now(); assert.equal(await requestCode(m.deps, LISTED, true, "1", "junk"), "sent"); assert.ok(performance.now() - s0 >= 145); await m.run(); assert.deepEqual(m.log.at(-1), ["record", LISTED, "1", false]); assert.ok(!m.log.some((l) => l[0] === "send")); });
await t("P3: send throws -> recorded as rejected, error stays in the deferred task", async () => { const m = mk({ sendThrows: true }); await requestCode(m.deps, LISTED, true, "1"); await assert.rejects(m.run()); assert.deepEqual(m.log.at(-1), ["record", LISTED, "1", false]); });
await t("P3: all captcha outcomes give the same neutral 'sent' within the padded floor", async () => { for (const [o, tok] of [[{}, ""], [{ captcha: true }, ""], [{ captcha: true }, "ok"], [{ captcha: true, authRejects: true }, "junk"], [{ captcha: true }, "x".repeat(5000)]]) { const m = mk({ ...o, floor: 120 }); const s0 = performance.now(); assert.equal(await requestCode(m.deps, LISTED, true, "1", tok), "sent"); const d = performance.now() - s0; assert.ok(d >= 115 && d < 200, `padded ${d}`); } });
console.log(`ALL PASS (${n})`);
