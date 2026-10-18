import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/app";
import type { Env } from "../src/types";
import { MAX_SIGNATURE_AGE_SECONDS, verifyDiscordRequest } from "../src/verify";
import { IDS } from "./helpers";

const toHex = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("hex");

async function keypair() {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = toHex((await crypto.subtle.exportKey("raw", kp.publicKey)) as ArrayBuffer);
  const sign = async (ts: string, body: string) => toHex(await crypto.subtle.sign({ name: "Ed25519" }, kp.privateKey, new TextEncoder().encode(ts + body)));
  return { pub, sign };
}

describe("verifyDiscordRequest (Ed25519, Web Crypto)", () => {
  it("accepts a valid signature over timestamp + raw body", async () => {
    const { pub, sign } = await keypair();
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"type":1}';
    expect(await verifyDiscordRequest(pub, await sign(ts, body), ts, body)).toBe(true);
  });

  it("rejects a tampered body, wrong key, missing headers, malformed signature and stale timestamp", async () => {
    const { pub, sign } = await keypair();
    const other = await keypair();
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"type":1}';
    const sig = await sign(ts, body);
    expect(await verifyDiscordRequest(pub, sig, ts, '{"type":2}')).toBe(false);
    expect(await verifyDiscordRequest(other.pub, sig, ts, body)).toBe(false);
    expect(await verifyDiscordRequest(pub, null, ts, body)).toBe(false);
    expect(await verifyDiscordRequest(pub, sig, null, body)).toBe(false);
    expect(await verifyDiscordRequest(pub, "zz" + sig.slice(2), ts, body)).toBe(false);
    const old = String(Number(ts) - MAX_SIGNATURE_AGE_SECONDS - 5);
    expect(await verifyDiscordRequest(pub, await sign(old, body), old, body)).toBe(false);
  });
});

describe("HTTP endpoint", () => {
  async function setup() {
    const { pub, sign } = await keypair();
    const env: Env = {
      DISCORD_APP_ID: IDS.app,
      GUILD_ID: IDS.guild,
      VIP_ROLE_ID: IDS.vip,
      ADMIN_ROLE_IDS: "",
      VERIFY_CHANNEL_ID: IDS.verify,
      APPROVALS_CHANNEL_ID: IDS.approvals,
      LOG_CHANNEL_ID: IDS.logs,
      SUPABASE_URL: "https://example.supabase.co",
      MAX_UPLOAD_BYTES: "8388608",
      DISCORD_PUBLIC_KEY: pub,
      DISCORD_BOT_TOKEN: "test-token-not-real",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_not_real",
    };
    const post = async (body: string, signed = true) => {
      const ts = String(Math.floor(Date.now() / 1000));
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Signature-Timestamp": ts };
      headers["X-Signature-Ed25519"] = signed ? await sign(ts, body) : "0".repeat(128);
      return handleRequest(new Request("https://bot.example.workers.dev/", { method: "POST", headers, body }), env, { waitUntil: () => undefined }, (() => {
        throw new Error("no network in tests");
      }) as unknown as typeof fetch);
    };
    return { post, env };
  }

  it("answers PING with PONG when signed", async () => {
    const { post } = await setup();
    const res = await post(JSON.stringify({ type: 1, id: "1", application_id: IDS.app, token: "t" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
  });

  it("returns 401 for Discord's deliberately invalid test request", async () => {
    const { post } = await setup();
    const res = await post(JSON.stringify({ type: 1 }), false);
    expect(res.status).toBe(401);
  });

  it("returns 500 (no secret details) when config is missing", async () => {
    const { env } = await setup();
    const res = await handleRequest(
      new Request("https://x/", { method: "POST", body: "{}" }),
      { ...env, DISCORD_BOT_TOKEN: "" },
      { waitUntil: () => undefined },
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/token|secret/i);
  });

  it("rejects oversized bodies with 413", async () => {
    const { post } = await setup();
    const res = await post("x".repeat(300 * 1024));
    expect(res.status).toBe(413);
  });
});
