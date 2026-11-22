import { Db } from "../src/db";
import type { Deps } from "../src/deps";
import { Discord } from "../src/discord";
import { CID } from "../src/payloads";
import type { Config, Interaction } from "../src/types";
import { TestD1 } from "./d1";

/** All ids are fake 18-digit snowflakes. */
export const IDS = {
  app: "100000000000000001",
  guild: "200000000000000002",
  adminRole: "300000000000000001",
  coachRole: "300000000000000002",
  unverifiedRole: "300000000000000003",
  freeRole: "300000000000000004",
  vipRole: "300000000000000005",
  subIbRole: "300000000000000006",
  lineCoachRole: "300000000000000007",
  lineGfxRole: "300000000000000008",
  verify: "400000000000000001",
  adminLog: "400000000000000002",
  reviewCoach: "400000000000000003",
  reviewGfx: "400000000000000004",
  reviewCategory: "400000000000000005",
  coach1: "500000000000000001",
  coach2: "500000000000000002",
  ben: "500000000000000003",
  admin: "500000000000000004",
  member: "500000000000000005",
  member2: "500000000000000006",
  outsider: "500000000000000007",
};

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
export const CDN = (n: string | number) => `https://cdn.discordapp.com/ephemeral-attachments/1/2/shot-${n}.png?ex=1&is=1&hm=abc`;

export function config(over: Partial<Config> = {}): Config {
  return {
    appId: IDS.app,
    guildId: IDS.guild,
    adminRoleIds: [IDS.adminRole],
    coachRoleId: IDS.coachRole,
    unverifiedRoleId: IDS.unverifiedRole,
    freeRoleId: IDS.freeRole,
    vipRoleId: IDS.vipRole,
    subIbRoleId: IDS.subIbRole,
    verifyChannelId: IDS.verify,
    adminLogChannelId: IDS.adminLog,
    reviewCategoryId: IDS.reviewCategory,
    coachMikeUserIds: [IDS.coach1, IDS.coach2],
    maxUploadBytes: 8 * 1024 * 1024,
    publicKey: "00".repeat(32),
    botToken: "test-token-not-real",
    ...over,
  };
}

export interface Msg {
  id: string;
  channelId: string;
  content: string;
  components?: unknown;
  allowed_mentions?: { parse?: string[]; users?: string[] };
  file?: { filename: string; bytes: Uint8Array };
}

/** In-memory Discord REST + CDN. Records every call. */
export class FakeDiscord {
  calls: Array<{ method: string; path: string; body?: unknown }> = [];
  messages = new Map<string, Msg>();
  deleted: Msg[] = [];
  members = new Map<string, string[]>(); // userId -> roles
  dms = new Map<string, string[]>();
  dmClosed = new Set<string>();
  createdRoles: Array<{ id: string; name: string }> = [];
  createdChannels: Array<{ id: string; name: string; parent_id?: string | null; permission_overwrites: Array<{ id: string; type: number; allow: string; deny: string }> }> = [];
  deletedRoles: string[] = [];
  deletedChannels: string[] = [];
  failAddRole = false;
  failCreateChannel = false;
  failDeleteMessage = false;
  rateLimitAfter = Number.POSITIVE_INFINITY;
  private seq = 900000000000000000n;
  private dmChan = new Map<string, string>(); // channelId -> userId

  next(): string {
    this.seq += 1n;
    return this.seq.toString();
  }
  messagesIn(channelId: string) {
    return [...this.messages.values()].filter((m) => m.channelId === channelId);
  }
  get requestCount() {
    return this.calls.length;
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.hostname === "cdn.discordapp.com" || url.hostname === "media.discordapp.net") {
      this.calls.push({ method, path: `cdn:${url.pathname}` });
      return new Response(PNG, { status: 200, headers: { "content-type": "image/png", "content-length": String(PNG.byteLength) } });
    }
    const path = url.pathname.replace(/^\/api\/v10/, "");
    let body: unknown;
    let file: Msg["file"];
    if (init?.body instanceof FormData) {
      body = JSON.parse(String(init.body.get("payload_json")));
      const f = init.body.get("files[0]") as File;
      file = { filename: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
    } else if (typeof init?.body === "string") body = JSON.parse(init.body);
    this.calls.push({ method, path, body });
    if (this.calls.filter((c) => !c.path.startsWith("cdn:")).length > this.rateLimitAfter) return json({ retry_after: 1 }, 429);
    return this.route(method, path, body, file);
  };

  private route(method: string, path: string, body: any, file?: Msg["file"]): Response {
    let m: RegExpExecArray | null;
    if ((m = /^\/webhooks\/\d+\/[^/]+(\/messages\/@original)?$/.exec(path))) return json({ id: this.next() });
    if ((m = /^\/channels\/(\d+)\/messages$/.exec(path)) && method === "POST") {
      const id = this.next();
      const channelId = m[1]!;
      const dmUser = this.dmChan.get(channelId);
      if (dmUser) {
        this.dms.set(dmUser, [...(this.dms.get(dmUser) ?? []), body.content]);
        return json({ id });
      }
      this.messages.set(id, { id, channelId, content: body.content, components: body.components, allowed_mentions: body.allowed_mentions, file });
      return json({ id, attachments: file ? [{ id: this.next(), url: CDN(`card-${id}`), filename: file.filename }] : [] });
    }
    if ((m = /^\/channels\/(\d+)\/messages\/(\d+)$/.exec(path))) {
      const msg = this.messages.get(m[2]!);
      if (method === "GET") return msg ? json({ id: msg.id, attachments: msg.file ? [{ id: "1", url: CDN(`fresh-${msg.id}`) }] : [] }) : json({ code: 10008 }, 404);
      if (method === "DELETE") {
        if (this.failDeleteMessage) return json({ code: 50013 }, 403);
        if (!msg) return json({ code: 10008 }, 404);
        this.messages.delete(msg.id);
        this.deleted.push(msg);
        return new Response(null, { status: 204 });
      }
    }
    if ((m = /^\/guilds\/\d+\/members\/(\d+)$/.exec(path)) && method === "GET") {
      const roles = this.members.get(m[1]!);
      return roles ? json({ roles: [...roles] }) : json({ code: 10007 }, 404);
    }
    if ((m = /^\/guilds\/\d+\/members\/(\d+)\/roles\/(\d+)$/.exec(path))) {
      const roles = this.members.get(m[1]!);
      if (!roles) return json({ code: 10007 }, 404);
      if (method === "PUT") {
        if (this.failAddRole) return json({ code: 50013 }, 403);
        if (!roles.includes(m[2]!)) roles.push(m[2]!);
      } else this.members.set(m[1]!, roles.filter((r) => r !== m![2]));
      return new Response(null, { status: 204 });
    }
    if (/^\/guilds\/\d+\/roles$/.test(path) && method === "POST") {
      const r = { id: this.next(), name: body.name };
      this.createdRoles.push(r);
      return json(r);
    }
    if ((m = /^\/guilds\/\d+\/roles\/(\d+)$/.exec(path)) && method === "DELETE") {
      this.deletedRoles.push(m[1]!);
      return new Response(null, { status: 204 });
    }
    if (/^\/guilds\/\d+\/channels$/.test(path) && method === "POST") {
      if (this.failCreateChannel) return json({ code: 50013 }, 403);
      const c = { id: this.next(), ...body };
      this.createdChannels.push(c);
      return json(c);
    }
    if ((m = /^\/channels\/(\d+)$/.exec(path)) && method === "DELETE") {
      this.deletedChannels.push(m[1]!);
      return new Response(null, { status: 204 });
    }
    if (path === "/users/@me/channels" && method === "POST") {
      if (this.dmClosed.has(body.recipient_id)) return json({ code: 50007 }, 403);
      const id = this.next();
      this.dmChan.set(id, body.recipient_id);
      return json({ id });
    }
    return json({ message: `unhandled ${method} ${path}` }, 500);
  }
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

export class Ctx {
  tasks: Promise<unknown>[] = [];
  waitUntil(p: Promise<unknown>) {
    this.tasks.push(p);
  }
  async flush() {
    while (this.tasks.length) await this.tasks.shift();
  }
}

export interface World {
  d1: TestD1;
  db: Db;
  fake: FakeDiscord;
  deps: Deps;
  ctx: Ctx;
  clock: { now: Date };
  cfg: Config;
}

/** Seeds the two launch lines: Coach Mike (id 1, top) and GFX (id 2, under Coach Mike). */
export function world(start = "2026-11-22T06:00:00.000Z"): World {
  const d1 = new TestD1();
  d1.sqlite.exec(`
    INSERT INTO ib_lines (id, slug, display_name, discord_user_id, accm_ib_email, upline_line_id, role_id, review_channel_id, is_seed)
    VALUES (1, 'coach-mike', 'Coach Mike', '${IDS.coach1}', NULL, NULL, '${IDS.lineCoachRole}', '${IDS.reviewCoach}', 1),
           (2, 'gfx', 'Ben', '${IDS.ben}', 'goldfx.society@gmail.com', 1, '${IDS.lineGfxRole}', '${IDS.reviewGfx}', 1);
  `);
  const fake = new FakeDiscord();
  for (const id of [IDS.coach1, IDS.coach2]) fake.members.set(id, [IDS.coachRole]);
  fake.members.set(IDS.ben, [IDS.adminRole, IDS.subIbRole, IDS.freeRole]);
  fake.members.set(IDS.admin, [IDS.adminRole]);
  const cfg = config();
  const clock = { now: new Date(start) };
  const db = new Db(d1.asD1());
  const deps: Deps = { cfg, discord: new Discord(cfg.botToken, cfg.appId, fake.fetch), db, fetchImpl: fake.fetch, now: () => clock.now };
  return { d1, db, fake, deps, ctx: new Ctx(), clock, cfg };
}

let iseq = 700000000000000000n;
export const nextInteractionId = () => (++iseq).toString();

export function member(userId: string, roles: string[], nick = `Member ${userId.slice(-3)}`) {
  return { user: { id: userId, username: `user${userId.slice(-3)}`, global_name: null }, nick, roles };
}

export function button(customId: string, userId: string, roles: string[], channelId = IDS.verify, messageId?: string): Interaction {
  return {
    id: nextInteractionId(),
    application_id: IDS.app,
    type: 3,
    token: "tok",
    guild_id: IDS.guild,
    channel_id: channelId,
    member: member(userId, roles),
    data: { custom_id: customId, component_type: 2 },
    ...(messageId ? { message: { id: messageId, channel_id: channelId } } : {}),
  };
}

export function clientSubmit(userId: string, roles: string[], f: { accm: string; type: "free" | "vip"; line: string; nick?: string; customId?: string }): Interaction {
  const attId = nextInteractionId();
  return {
    id: nextInteractionId(),
    application_id: IDS.app,
    type: 5,
    token: "tok",
    guild_id: IDS.guild,
    channel_id: IDS.verify,
    member: member(userId, roles, f.nick),
    data: {
      custom_id: f.customId ?? CID.clientSubmit,
      components: [
        { type: 10, id: 1 },
        { type: 18, component: { type: 4, custom_id: CID.fAccm, value: f.accm } },
        { type: 18, component: { type: 3, custom_id: CID.fType, values: [f.type] } },
        { type: 18, component: { type: 3, custom_id: CID.fLine, values: [f.line] } },
        { type: 18, component: { type: 19, custom_id: CID.fShot, values: [attId] } },
      ],
      resolved: { attachments: { [attId]: { id: attId, filename: "my-statement.png", size: PNG.byteLength, url: CDN(attId), content_type: "image/png" } } },
    },
  };
}

export function ibSubmit(userId: string, roles: string[], f: { email: string; line: string; nick?: string }): Interaction {
  return {
    id: nextInteractionId(),
    application_id: IDS.app,
    type: 5,
    token: "tok",
    guild_id: IDS.guild,
    channel_id: IDS.verify,
    member: member(userId, roles, f.nick),
    data: {
      custom_id: CID.ibSubmit,
      components: [
        { type: 10, id: 1 },
        { type: 18, component: { type: 4, custom_id: CID.fEmail, value: f.email } },
        { type: 18, component: { type: 3, custom_id: CID.fLine, values: [f.line] } },
      ],
    },
  };
}

export function denySubmit(appId: string, userId: string, roles: string[], channelId: string, reason: string, note = "", messageId?: string): Interaction {
  return {
    id: nextInteractionId(),
    application_id: IDS.app,
    type: 5,
    token: "tok",
    guild_id: IDS.guild,
    channel_id: channelId,
    member: member(userId, roles),
    ...(messageId ? { message: { id: messageId, channel_id: channelId } } : {}),
    data: {
      custom_id: CID.denyModal + appId,
      components: [
        { type: 18, component: { type: 3, custom_id: CID.fReason, values: [reason] } },
        { type: 18, component: { type: 4, custom_id: CID.fNote, value: note } },
      ],
    },
  };
}
