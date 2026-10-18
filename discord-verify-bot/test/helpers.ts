import type { Deps } from "../src/handlers";
import { Db } from "../src/db";
import { Discord } from "../src/discord";
import type { Config, Interaction, RequestRow } from "../src/types";

export const IDS = {
  app: "100000000000000001",
  guild: "200000000000000002",
  vip: "300000000000000003",
  adminRole: "300000000000000004",
  verify: "400000000000000005",
  approvals: "400000000000000006",
  logs: "400000000000000007",
  member: "500000000000000008",
  admin: "500000000000000009",
  admin2: "500000000000000010",
  dmChannel: "600000000000000011",
};

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
export const CDN_URL = `https://cdn.discordapp.com/ephemeral-attachments/1/2/shot.png?ex=1&is=1&hm=abc`;

export function config(over: Partial<Config> = {}): Config {
  return {
    appId: IDS.app,
    guildId: IDS.guild,
    vipRoleId: IDS.vip,
    adminRoleIds: [IDS.adminRole],
    verifyChannelId: IDS.verify,
    approvalsChannelId: IDS.approvals,
    logChannelId: IDS.logs,
    supabaseUrl: "https://example.supabase.co",
    maxUploadBytes: 8 * 1024 * 1024,
    publicKey: "00".repeat(32),
    botToken: "test-token-not-real",
    supabaseKey: "sb_secret_test_not_real",
    ...over,
  };
}

/** In-memory stand-in for PostgREST on public.discord_vip_requests, incl. PK + one-pending-per-member unique index. */
export class FakeSupabase {
  rows: RequestRow[] = [];
  bodies: string[] = [];

  private filter(params: URLSearchParams): RequestRow[] {
    let out = [...this.rows];
    for (const [k, v] of params) {
      if (["select", "order", "limit"].includes(k)) continue;
      const [op, ...rest] = v.split(".");
      const val = rest.join(".");
      out = out.filter((r) => {
        const cell = (r as unknown as Record<string, unknown>)[k];
        if (op === "eq") return String(cell) === val;
        if (op === "neq") return String(cell) !== val;
        if (op === "is" && val === "null") return cell === null || cell === undefined;
        if (op === "not" && val === "is.null") return cell !== null && cell !== undefined;
        if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").includes(String(cell));
        if (cell === null || cell === undefined) return false;
        if (op === "gte") return String(cell) >= val;
        if (op === "lt") return String(cell) < val;
        return true;
      });
    }
    const order = params.get("order");
    if (order?.startsWith("created_at.desc")) out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (order?.startsWith("created_at.asc")) out.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (order?.startsWith("decided_at.asc")) out.sort((a, b) => String(a.decided_at).localeCompare(String(b.decided_at)));
    const limit = params.get("limit");
    return limit ? out.slice(0, Number(limit)) : out;
  }

  handle(method: string, url: URL, body: string | undefined, now: () => Date): Response {
    if (body) this.bodies.push(body);
    const params = url.searchParams;
    const ok = (data: unknown, status = 200) => new Response(data === undefined || status === 204 ? null : JSON.stringify(data), { status });
    if (method === "GET") return ok(this.filter(params));
    if (method === "POST") {
      const b = JSON.parse(body!) as Partial<RequestRow>;
      if (this.rows.some((r) => r.request_id === b.request_id)) return ok({ code: "23505" }, 409);
      if (this.rows.some((r) => r.guild_id === b.guild_id && r.member_id === b.member_id && r.status === "pending"))
        return ok({ code: "23505" }, 409);
      const row: RequestRow = {
        request_id: b.request_id!,
        guild_id: b.guild_id!,
        member_id: b.member_id!,
        status: "pending",
        admin_id: null,
        reason_code: null,
        flags: [],
        approval_message_id: null,
        log_message_id: null,
        card_alert_at: null,
        created_at: now().toISOString(),
        decided_at: null,
      };
      this.rows.push(row);
      return ok([row], 201);
    }
    if (method === "PATCH") {
      const patch = JSON.parse(body!) as Partial<RequestRow>;
      const hit = this.filter(params);
      hit.forEach((r) => Object.assign(r, patch));
      return ok(hit.map((r) => ({ ...r })));
    }
    if (method === "DELETE") {
      const hit = new Set(this.filter(params));
      this.rows = this.rows.filter((r) => !hit.has(r));
      return ok(undefined, 204);
    }
    return ok({}, 405);
  }
}

export interface DiscordCall {
  method: string;
  path: string;
  json?: unknown;
  form?: boolean;
  fileBytes?: number;
}

export class FakeDiscord {
  calls: DiscordCall[] = [];
  nextMessageId = 700000000000000000n;
  memberRoles: string[] | null = []; // null => member left (10007)
  dmClosed = false;
  roleHierarchyBroken = false;
  failUpload = false;
  /** Number of upcoming #vip-approvals message DELETEs that fail with 500. */
  cardDeleteFailures = 0;
  /** #vip-log message DELETEs fail with 403 while true. */
  logDeleteFails = false;

  async handle(method: string, url: URL, init?: RequestInit): Promise<Response> {
    const path = url.pathname.replace("/api/v10", "");
    const call: DiscordCall = { method, path };
    if (init?.body instanceof FormData) {
      call.form = true;
      const f = init.body.get("files[0]") as Blob | null;
      call.fileBytes = f ? f.size : 0;
      call.json = JSON.parse(String(init.body.get("payload_json")));
    } else if (typeof init?.body === "string") call.json = JSON.parse(init.body);
    this.calls.push(call);
    const res = (data: unknown, status = 200) => new Response(data === undefined ? null : JSON.stringify(data), { status });
    const err = (status: number, code: number) => res({ code, message: "x" }, status);

    if (/^\/guilds\/\d+\/members\/\d+$/.test(path) && method === "GET")
      return this.memberRoles === null ? err(404, 10007) : res({ roles: this.memberRoles });
    if (/^\/guilds\/\d+\/members\/\d+\/roles\/\d+$/.test(path) && method === "PUT") {
      if (this.roleHierarchyBroken) return err(403, 50013);
      if (this.memberRoles === null) return err(404, 10007);
      return res(undefined, 204);
    }
    if (path === "/users/@me/channels") return res({ id: IDS.dmChannel });
    if (path === `/channels/${IDS.dmChannel}/messages`) return this.dmClosed ? err(403, 50007) : res({ id: "1" });
    if (/^\/channels\/\d+\/messages$/.test(path) && method === "POST") {
      if (call.form && this.failUpload) return err(500, 0);
      return res({ id: String(this.nextMessageId++) });
    }
    if (/^\/channels\/\d+\/messages\/\d+$/.test(path)) {
      if (method === "DELETE" && path.startsWith(`/channels/${IDS.approvals}/`) && this.cardDeleteFailures > 0) {
        this.cardDeleteFailures--;
        return err(500, 0);
      }
      if (method === "DELETE" && path.startsWith(`/channels/${IDS.logs}/`) && this.logDeleteFails) return err(403, 50001);
      return method === "DELETE" ? res(undefined, 204) : res({ id: "x" });
    }
    if (path.startsWith("/webhooks/")) return res({ id: "w" });
    return err(404, 0);
  }

  find(method: string, re: RegExp) {
    return this.calls.filter((c) => c.method === method && re.test(c.path));
  }
}

export function harness(opts: { cfg?: Partial<Config>; cdnBytes?: Uint8Array; now?: Date } = {}) {
  const sb = new FakeSupabase();
  const dc = new FakeDiscord();
  let clock = opts.now ?? new Date("2026-10-18T04:00:00.000Z");
  const now = () => clock;
  const cdnFetches: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    if (url.hostname.endsWith("supabase.co")) return sb.handle(method, url, typeof init?.body === "string" ? init.body : undefined, now);
    if (url.hostname === "discord.com") return dc.handle(method, url, init);
    if (url.hostname === "cdn.discordapp.com") {
      cdnFetches.push(url.href);
      const bytes = opts.cdnBytes ?? PNG;
      return new Response(bytes, { status: 200, headers: { "content-length": String(bytes.byteLength) } });
    }
    return new Response("no", { status: 404 });
  }) as typeof fetch;
  const cfg = config(opts.cfg);
  const deps: Deps = { cfg, discord: new Discord(cfg.botToken, cfg.appId, fetchImpl), db: new Db(cfg.supabaseUrl, cfg.supabaseKey, fetchImpl), fetchImpl, now };
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  const flush = async () => {
    while (pending.length) await pending.shift();
  };
  return { sb, dc, deps, ctx, flush, cdnFetches, setNow: (d: Date) => (clock = d) };
}

let seq = 800000000000000000n;
export const nextId = () => String(seq++);

export function member(id: string, roles: string[] = [], permissions = "0") {
  return { user: { id }, roles, permissions };
}

export function uploadSubmit(memberId = IDS.member, over: Partial<Interaction> = {}, att: Partial<{ content_type: string; size: number; url: string }> = {}): Interaction {
  const attId = nextId();
  return {
    id: nextId(),
    application_id: IDS.app,
    type: 5,
    token: "tok-" + nextId(),
    guild_id: IDS.guild,
    channel_id: IDS.verify,
    member: member(memberId),
    attachment_size_limit: 10 * 1024 * 1024,
    data: {
      custom_id: "vip:submit",
      components: [{ type: 18, id: 1, component: { type: 19, id: 2, custom_id: "vip:file", values: [attId] } }],
      resolved: {
        attachments: {
          [attId]: { id: attId, filename: "Juan Dela Cruz deposit.png", size: PNG.byteLength, url: CDN_URL, content_type: "image/png", ephemeral: true, ...att },
        },
      },
    },
    ...over,
  };
}

/** Admin click. By default the clicker has the configured admin role and NO special permissions. */
export function button(customId: string, adminId = IDS.admin, perms = "0", over: Partial<Interaction> = {}, roles: string[] = [IDS.adminRole]): Interaction {
  return {
    id: nextId(),
    application_id: IDS.app,
    type: 3,
    token: "tok-" + nextId(),
    guild_id: IDS.guild,
    channel_id: IDS.approvals,
    member: member(adminId, roles, perms),
    message: { id: "700000000000000000" },
    data: { custom_id: customId, component_type: 2 },
    ...over,
  };
}

export function infoSubmit(requestId: string, note: string, adminId = IDS.admin): Interaction {
  return {
    ...button(`vip:infomodal:${requestId}`, adminId),
    type: 5,
    data: {
      custom_id: `vip:infomodal:${requestId}`,
      components: [{ type: 18, id: 1, component: { type: 4, id: 2, custom_id: "vip:note", value: note } }],
    },
  };
}

export function rejectSubmit(requestId: string, reason: string, note = "", adminId = IDS.admin): Interaction {
  return {
    ...button(`vip:rejectmodal:${requestId}`, adminId),
    type: 5,
    data: {
      custom_id: `vip:rejectmodal:${requestId}`,
      components: [
        { type: 18, id: 1, component: { type: 3, id: 2, custom_id: "vip:reason", values: [reason] } },
        { type: 18, id: 3, component: { type: 4, id: 4, custom_id: "vip:note", value: note } },
      ],
    },
  };
}
