import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/app";
import { CID } from "../src/payloads";
import type { Env } from "../src/types";
import { MAX_SIGNATURE_AGE_SECONDS, verifyDiscordRequest } from "../src/verify";
import { TestD1 } from "./d1";
import { FakeDiscord, IDS } from "./helpers";

const toHex = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("hex");

export async function keypair() {
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

  it("rejects tampered body, wrong key, missing headers, malformed signature and stale timestamp", async () => {
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

describe("HTTP endpoint → handleInteraction routing (real D1 schema)", () => {
  async function setup() {
    const { pub, sign } = await keypair();
    const d1 = new TestD1();
    d1.sqlite.exec(`INSERT INTO ib_lines (id, slug, display_name, discord_user_id, role_id, review_channel_id, is_seed) VALUES (1, 'coach-mike', 'Coach Mike', '${IDS.coach1}', '${IDS.lineCoachRole}', '${IDS.reviewCoach}', 1)`);
    const env: Env = {
      DB: d1.asD1(),
      DISCORD_APP_ID: IDS.app,
      GUILD_ID: IDS.guild,
      ADMIN_ROLE_IDS: IDS.adminRole,
      COACH_ROLE_ID: IDS.coachRole,
      UNVERIFIED_ROLE_ID: IDS.unverifiedRole,
      FREE_ROLE_ID: IDS.freeRole,
      VIP_ROLE_ID: IDS.vipRole,
      SUB_IB_ROLE_ID: IDS.subIbRole,
      VERIFY_CHANNEL_ID: IDS.verify,
      ADMIN_LOG_CHANNEL_ID: IDS.adminLog,
      REVIEW_CATEGORY_ID: "",
      COACH_MIKE_DISCORD_USER_IDS: `${IDS.coach1},${IDS.coach2}`,
      DISCORD_PUBLIC_KEY: pub,
      DISCORD_BOT_TOKEN: "test-token-not-real",
    };
    const fake = new FakeDiscord();
    const tasks: Promise<unknown>[] = [];
    const post = async (body: string, signed = true) => {
      const ts = String(Math.floor(Date.now() / 1000));
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Signature-Timestamp": ts, "X-Signature-Ed25519": signed ? await sign(ts, body) : "0".repeat(128) };
      return handleRequest(new Request("https://bot.example/interactions", { method: "POST", headers, body }), env, { waitUntil: (p) => tasks.push(p) }, fake.fetch);
    };
    return { env, post, fake, tasks };
  }
  const base = { id: "700000000000000001", application_id: IDS.app, token: "t", guild_id: IDS.guild, channel_id: IDS.verify, member: { user: { id: IDS.member }, roles: [] } };

  it("GET / is a health check; other paths 404", async () => {
    const { env } = await setup();
    expect((await handleRequest(new Request("https://bot.example/"), env, { waitUntil() {} })).status).toBe(200);
    expect((await handleRequest(new Request("https://bot.example/x", { method: "POST" }), env, { waitUntil() {} })).status).toBe(404);
  });

  it("401 on a bad signature, PONG on a signed PING, 400 on a foreign application id", async () => {
    const { post } = await setup();
    expect((await post('{"type":1}', false)).status).toBe(401);
    const pong = await post('{"type":1}');
    expect(await pong.json()).toEqual({ type: 1 });
    expect((await post(JSON.stringify({ ...base, type: 3, application_id: "999999999999999999", data: { custom_id: CID.client } }))).status).toBe(400);
  });

  it("routes the Client ako button to the modal (D1 dropdown) and the IB ako button to its modal", async () => {
    const { post } = await setup();
    const c = (await (await post(JSON.stringify({ ...base, type: 3, data: { custom_id: CID.client } }))).json()) as any;
    expect(c.type).toBe(9);
    expect(c.data.components[3].component.options[0].label).toBe("Coach Mike");
    const ib = (await (await post(JSON.stringify({ ...base, type: 3, data: { custom_id: CID.ib } }))).json()) as any;
    expect(ib.type).toBe(9);
    expect(ib.data.custom_id).toBe(CID.ibSubmit);
  });

  it("other guilds are refused; misconfig fails closed with 500 and never echoes secrets", async () => {
    const { post, env } = await setup();
    const r = (await (await post(JSON.stringify({ ...base, guild_id: "222222222222222222", type: 3, data: { custom_id: CID.client } }))).json()) as any;
    expect(r.data.flags).toBe(64);
    const bad = await handleRequest(new Request("https://bot.example/", { method: "POST", body: "{}" }), { ...env, COACH_MIKE_DISCORD_USER_IDS: "" }, { waitUntil() {} });
    expect(bad.status).toBe(500);
    expect(await bad.text()).not.toContain("test-token");
  });
});
