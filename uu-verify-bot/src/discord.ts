/** Tiny Discord REST client (fetch only). Never logs tokens, webhook tokens, or payload bodies. */
import type { Meter } from "./meter";

const API = "https://discord.com/api/v10";

export class DiscordError extends Error {
  constructor(
    public status: number,
    public code: number | undefined,
    public route: string,
  ) {
    super(`Discord ${status}${code !== undefined ? `/${code}` : ""} on ${route}`);
  }
}

export const DiscordCode = {
  UNKNOWN_CHANNEL: 10003,
  UNKNOWN_MEMBER: 10007,
  UNKNOWN_MESSAGE: 10008,
  UNKNOWN_OVERWRITE: 10009,
  UNKNOWN_ROLE: 10011,
  UNKNOWN_USER: 10013,
  CANNOT_DM: 50007,
  MISSING_PERMISSIONS: 50013,
} as const;

export const Perm = {
  MANAGE_CHANNELS: 1n << 4n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  ADD_REACTIONS: 1n << 6n,
  STREAM: 1n << 9n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MANAGE_MESSAGES: 1n << 13n,
} as const;

export const bits = (...p: bigint[]) => p.reduce((a, b) => a | b, 0n).toString();

export interface Overwrite {
  id: string;
  /** 0 = role, 1 = member */
  type: 0 | 1;
  allow: string;
  deny: string;
}

export interface MessageAttachment {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
}

type Body = { json?: unknown; form?: FormData };

const scrub = (route: string) => route.replace(/\/webhooks\/\d+\/[^/]+/, "/webhooks/:app/:token");

export class Discord {
  /** Cron mode only: set after the first 429; later calls in this run fail fast with no fetch. */
  rateLimited = false;

  constructor(
    private token: string,
    private appId: string,
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private retry429 = true,
    public meter?: Meter,
  ) {}

  /** Cron client: no in-request 429 retry, metered against the tick budget. */
  forCron(meter: Meter): Discord {
    return new Discord(this.token, this.appId, this.fetchImpl, false, meter);
  }

  async request<T = unknown>(method: string, route: string, body?: Body, auth = true, attempt = 0): Promise<T> {
    if (this.rateLimited) throw new DiscordError(429, undefined, `${method} (skipped: rate-limited this run)`);
    this.meter?.spend(1);
    const headers: Record<string, string> = { "User-Agent": "DiscordBot (https://github.com/goldfxsociety/gfx-society, 0.1.0)" };
    if (auth) headers.Authorization = `Bot ${this.token}`;
    let payload: BodyInit | undefined;
    if (body?.json !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body.json);
    } else if (body?.form) payload = body.form;
    const res = await this.fetchImpl(API + route, { method, headers, body: payload });
    if (res.status === 429 && !this.retry429) {
      this.rateLimited = true;
      throw new DiscordError(429, undefined, `${method} ${scrub(route)}`);
    }
    if (res.status === 429 && attempt < 1) {
      const data = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const wait = Math.min(Number(data.retry_after ?? 1), 3);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return this.request<T>(method, route, body, auth, attempt + 1);
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { code?: number };
      throw new DiscordError(res.status, data.code, `${method} ${scrub(route)}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // Interaction responses (webhook token auth).
  editOriginal(token: string, json: unknown) {
    return this.request("PATCH", `/webhooks/${this.appId}/${token}/messages/@original`, { json }, false);
  }
  followup(token: string, json: unknown) {
    return this.request("POST", `/webhooks/${this.appId}/${token}`, { json }, false);
  }

  // Messages.
  createMessage(channelId: string, json: unknown) {
    return this.request<{ id: string }>("POST", `/channels/${channelId}/messages`, { json });
  }
  /** Newest first. Used by setup to find an existing verbatim risk line (no pin: Discord 50019 in voice chat). */
  listMessages(channelId: string, query?: { limit?: number; before?: string }) {
    const q = new URLSearchParams();
    if (query?.limit != null) q.set("limit", String(query.limit));
    if (query?.before) q.set("before", query.before);
    const qs = q.toString();
    return this.request<Array<{ id: string; content: string; author: { id: string } }>>(
      "GET",
      `/channels/${channelId}/messages${qs ? `?${qs}` : ""}`,
    );
  }
  createMessageWithFile(channelId: string, payload: unknown, file: Blob, filename: string) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    form.append("files[0]", file, filename);
    return this.request<{ id: string; attachments?: MessageAttachment[] }>("POST", `/channels/${channelId}/messages`, { form });
  }
  /** Fresh copy of a message (attachment URLs are re-signed). null if gone. */
  async getMessage(channelId: string, messageId: string) {
    try {
      return await this.request<{ id: string; attachments?: MessageAttachment[] }>("GET", `/channels/${channelId}/messages/${messageId}`);
    } catch (e) {
      if (e instanceof DiscordError && (e.status === 404 || e.code === DiscordCode.UNKNOWN_MESSAGE)) return null;
      throw e;
    }
  }
  /** Deletes the bot's OWN message (and so its attachment). 404 counts as done. */
  async deleteOwnMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.request("DELETE", `/channels/${channelId}/messages/${messageId}`);
    } catch (e) {
      if (e instanceof DiscordError && (e.code === DiscordCode.UNKNOWN_MESSAGE || e.status === 404)) return;
      throw e;
    }
  }

  // Members and roles.
  /** null if the user is not (or no longer) in the guild. */
  async getMember(guildId: string, userId: string): Promise<{ roles: string[] } | null> {
    try {
      return await this.request<{ roles: string[] }>("GET", `/guilds/${guildId}/members/${userId}`);
    } catch (e) {
      if (e instanceof DiscordError && (e.status === 404 || e.code === DiscordCode.UNKNOWN_MEMBER)) return null;
      throw e;
    }
  }
  addRole(guildId: string, userId: string, roleId: string) {
    return this.request("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  }
  /** Returns false if the member is gone (404). */
  async removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    try {
      await this.request("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
      return true;
    } catch (e) {
      if (e instanceof DiscordError && (e.status === 404 || e.code === DiscordCode.UNKNOWN_MEMBER)) return false;
      throw e;
    }
  }
  createRole(guildId: string, name: string) {
    return this.request<{ id: string }>("POST", `/guilds/${guildId}/roles`, { json: { name, permissions: "0", mentionable: false, hoist: false } });
  }
  async deleteRole(guildId: string, roleId: string): Promise<void> {
    await this.request("DELETE", `/guilds/${guildId}/roles/${roleId}`);
  }
  createChannel(guildId: string, json: { name: string; type: number; topic?: string; parent_id?: string | null; permission_overwrites?: Overwrite[] }) {
    return this.request<{ id: string }>("POST", `/guilds/${guildId}/channels`, { json });
  }
  async deleteChannel(channelId: string): Promise<void> {
    await this.request("DELETE", `/channels/${channelId}`);
  }

  /** Returns false if the user has DMs closed / can't be messaged. */
  async dm(userId: string, content: string): Promise<boolean> {
    try {
      const ch = await this.request<{ id: string }>("POST", "/users/@me/channels", { json: { recipient_id: userId } });
      await this.createMessage(ch.id, { content, allowed_mentions: { parse: [] } });
      return true;
    } catch (e) {
      if (e instanceof DiscordError && (e.code === DiscordCode.CANNOT_DM || e.code === DiscordCode.UNKNOWN_USER || e.status === 403)) return false;
      throw e;
    }
  }
}
