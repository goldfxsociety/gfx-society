/** Tiny Discord REST client (fetch only). Never logs tokens, URLs with signatures, or payload bodies. */
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
  UNKNOWN_MEMBER: 10007,
  UNKNOWN_MESSAGE: 10008,
  UNKNOWN_USER: 10013,
  CANNOT_DM: 50007,
  MISSING_PERMISSIONS: 50013,
} as const;

type Body = { json?: unknown; form?: FormData };

export class Discord {
  /** Cron mode only: set after the first 429; every later call in this run fails fast with no fetch. */
  rateLimited = false;

  constructor(
    private token: string,
    private appId: string,
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    /** Interactions: one short in-request retry on 429. Cron: false (stop and leave the rest for the next run). */
    private retry429 = true,
  ) {}

  /** Client for the hourly cron: no in-request 429 retry, so the subrequest worst case stays fixed. */
  forCron(): Discord {
    return new Discord(this.token, this.appId, this.fetchImpl, false);
  }

  async request<T = unknown>(method: string, route: string, body?: Body, auth = true, attempt = 0): Promise<T> {
    if (this.rateLimited) throw new DiscordError(429, undefined, `${method} (skipped: rate-limited this run)`);
    const headers: Record<string, string> = { "User-Agent": "DiscordBot (https://gfx-society.vercel.app, 0.1.0)" };
    if (auth) headers.Authorization = `Bot ${this.token}`;
    let payload: BodyInit | undefined;
    if (body?.json !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body.json);
    } else if (body?.form) payload = body.form;
    const res = await this.fetchImpl(API + route, { method, headers, body: payload });
    if (res.status === 429 && !this.retry429) {
      this.rateLimited = true;
      throw new DiscordError(429, undefined, `${method} ${route}`);
    }
    if (res.status === 429 && attempt < 1) {
      const data = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const wait = Math.min(Number(data.retry_after ?? 1), 3);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return this.request<T>(method, route, body, auth, attempt + 1);
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { code?: number };
      throw new DiscordError(res.status, data.code, `${method} ${route.replace(/\/webhooks\/\d+\/[^/]+/, "/webhooks/:app/:token")}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // Interaction responses (webhook token auth, no bot token needed).
  editOriginal(token: string, json: unknown) {
    return this.request("PATCH", `/webhooks/${this.appId}/${token}/messages/@original`, { json }, false);
  }
  followup(token: string, json: unknown) {
    return this.request("POST", `/webhooks/${this.appId}/${token}`, { json }, false);
  }

  // Channel messages.
  createMessage(channelId: string, json: unknown) {
    return this.request<{ id: string }>("POST", `/channels/${channelId}/messages`, { json });
  }
  createMessageWithFile(channelId: string, payload: unknown, file: Blob, filename: string) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    form.append("files[0]", file, filename);
    return this.request<{ id: string }>("POST", `/channels/${channelId}/messages`, { form });
  }
  editMessage(channelId: string, messageId: string, json: unknown) {
    return this.request("PATCH", `/channels/${channelId}/messages/${messageId}`, { json });
  }
  /** Deletes the bot's OWN message (no Manage Messages needed). 404 Unknown Message counts as done. */
  async deleteOwnMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.request("DELETE", `/channels/${channelId}/messages/${messageId}`);
    } catch (e) {
      if (e instanceof DiscordError && (e.code === DiscordCode.UNKNOWN_MESSAGE || e.status === 404)) return;
      throw e;
    }
  }

  // Members and roles (no privileged intents needed for these REST calls).
  getMember(guildId: string, userId: string) {
    return this.request<{ roles: string[] }>("GET", `/guilds/${guildId}/members/${userId}`);
  }
  addRole(guildId: string, userId: string, roleId: string) {
    return this.request("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  }

  /** Returns false if the user has DMs closed / can't be messaged (50007). */
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
