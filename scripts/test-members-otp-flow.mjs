// Offline unit tests for src/lib/members/otp-flow.ts + otp-amr.ts (Node >= 22, type stripping).
// Run: node scripts/test-members-otp-flow.mjs
import assert from "node:assert/strict";
import { requestCode, verifyCode } from "../src/lib/members/otp-flow.ts";
import { sessionIsOtp } from "../src/lib/members/otp-amr.ts";
const LISTED = "member@example.test";
const mk = (o = {}) => {
  const log = [];
  return { log, deps: {
    codeAllowed: async (e, ip) => { log.push(["gate", e, ip]); return o.gate === undefined ? e === LISTED : o.gate; },
    sendOtp: async (e) => { log.push(["send", e]); return true; },
    verifyOtp: async (e, t) => { log.push(["verify", e, t]); return o.verify ?? (t === "123456" ? "ok" : "wrong"); },
    recordConsent: async () => { log.push(["consent"]); return o.consent === undefined ? "active" : o.consent; },
  } };
};
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("PASS", name); };
await t("no consent -> nothing called", async () => { const m = mk(); assert.equal(await requestCode(m.deps, LISTED, false, "1.1.1.1"), "consent_required"); assert.equal(m.log.length, 0); });
await t("bad email -> invalid", async () => { assert.equal(await requestCode(mk().deps, "nope", true, "x"), "invalid_email"); });
await t("listed (normalized) -> code sent, neutral 'sent'", async () => { const m = mk(); assert.equal(await requestCode(m.deps, "  Member@Example.TEST ", true, "1.1.1.1"), "sent"); assert.deepEqual(m.log.at(-1), ["send", LISTED]); });
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
console.log(`ALL PASS (${n})`);
