/**
 * Supabase (PostgREST) access for public.discord_vip_requests, using the service-role key (Worker secret).
 * RLS is on with no anon/authenticated policies, so only the service role can read/write.
 * Stores ids, status, timestamps and a reason code only. Never images, URLs, names, amounts or admin notes.
 */
import type { LogFlag, ReasonCode, RequestRow } from "./types";

const TABLE = "discord_vip_requests";

export class DbError extends Error {
  constructor(
    public status: number,
    public pgCode?: string,
  ) {
    super(`Supabase ${status}${pgCode ? ` (${pgCode})` : ""}`);
  }
}

export type CreateResult = { ok: true; row: RequestRow } | { ok: false; reason: "duplicate_pending" | "duplicate_request" };
export type DecideResult = { won: true; row: RequestRow } | { won: false; row: RequestRow | null };

export class Db {
  constructor(
    private url: string,
    private key: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { apikey: this.key, "Content-Type": "application/json", ...extra };
    // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys use apikey only.
    if (this.key.startsWith("eyJ")) h.Authorization = `Bearer ${this.key}`;
    return h;
  }

  private async call<T>(method: string, query: string, body?: unknown, prefer?: string): Promise<T> {
    const res = await this.fetchImpl(`${this.url}/rest/v1/${TABLE}${query}`, {
      method,
      headers: this.headers(prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { code?: string };
      throw new DbError(res.status, err.code);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Requests by this member in the last `hours` (newest first). Used for cooldown / daily cap. */
  recentForMember(guildId: string, memberId: string, sinceIso: string): Promise<Pick<RequestRow, "status" | "created_at" | "decided_at">[]> {
    const q = `?select=status,created_at,decided_at&guild_id=eq.${guildId}&member_id=eq.${memberId}&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=20`;
    return this.call("GET", q);
  }

  async latestForMember(guildId: string, memberId: string): Promise<RequestRow | null> {
    const rows = await this.call<RequestRow[]>("GET", `?select=*&guild_id=eq.${guildId}&member_id=eq.${memberId}&order=created_at.desc&limit=1`);
    return rows[0] ?? null;
  }

  async get(requestId: string): Promise<RequestRow | null> {
    const rows = await this.call<RequestRow[]>("GET", `?select=*&request_id=eq.${requestId}&limit=1`);
    return rows[0] ?? null;
  }

  /**
   * Insert a pending request. The unique partial index (guild_id, member_id) WHERE status='pending'
   * makes "one pending per member" atomic even under concurrent submits; the PK makes request_id unique.
   */
  async createPending(requestId: string, guildId: string, memberId: string): Promise<CreateResult> {
    try {
      const rows = await this.call<RequestRow[]>(
        "POST",
        "",
        { request_id: requestId, guild_id: guildId, member_id: memberId, status: "pending" },
        "return=representation",
      );
      return { ok: true, row: rows[0]! };
    } catch (e) {
      if (e instanceof DbError && (e.status === 409 || e.pgCode === "23505")) {
        const existing = await this.get(requestId).catch(() => null);
        return { ok: false, reason: existing ? "duplicate_request" : "duplicate_pending" };
      }
      throw e;
    }
  }

  setApprovalMessage(requestId: string, messageId: string): Promise<unknown> {
    return this.call("PATCH", `?request_id=eq.${requestId}&status=eq.pending`, { approval_message_id: messageId }, "return=minimal");
  }

  /** Removes a pending row whose approval card could not be posted ("request is not created"). */
  deletePending(requestId: string): Promise<unknown> {
    return this.call("DELETE", `?request_id=eq.${requestId}&status=eq.pending`, undefined, "return=minimal");
  }

  /**
   * Atomic, idempotent decision: UPDATE … WHERE request_id=$1 AND status='pending' RETURNING *.
   * Exactly one caller can win; double-clicks and simultaneous admins get won=false.
   */
  async decide(
    requestId: string,
    decision: "approved" | "rejected" | "expired",
    adminId: string | null,
    decidedAtIso: string,
    reason: ReasonCode | null = null,
  ): Promise<DecideResult> {
    const rows = await this.call<RequestRow[]>(
      "PATCH",
      `?request_id=eq.${requestId}&status=eq.pending`,
      { status: decision, admin_id: adminId, decided_at: decidedAtIso, reason_code: decision === "rejected" ? reason : null },
      "return=representation",
    );
    if (rows.length === 1) return { won: true, row: rows[0]! };
    return { won: false, row: await this.get(requestId) };
  }

  /** Undo an approval that could not be applied (e.g. role hierarchy 50013), so an admin can retry. Only the winner calls this. */
  revertToPending(requestId: string, adminId: string): Promise<unknown> {
    return this.call(
      "PATCH",
      `?request_id=eq.${requestId}&status=eq.approved&admin_id=eq.${adminId}`,
      { status: "pending", admin_id: null, decided_at: null, reason_code: null },
      "return=minimal",
    );
  }

  /** After the card is deleted: drop the message id and record outcome flags. */
  finalize(requestId: string, flags: LogFlag[]): Promise<unknown> {
    return this.call("PATCH", `?request_id=eq.${requestId}`, { approval_message_id: null, flags }, "return=minimal");
  }

  stalePending(olderThanIso: string, limit: number): Promise<RequestRow[]> {
    return this.call("GET", `?select=*&status=eq.pending&created_at=lt.${encodeURIComponent(olderThanIso)}&order=created_at.asc&limit=${limit}`);
  }
}
