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
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
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
    decision: "approved" | "rejected" | "needs_info" | "expired",
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

  /**
   * After the decision: record outcome flags and the #vip-log mirror id. `leftoverCardId` is the approval
   * card id if deleting it FAILED (kept so the cron retries), or null once it's gone.
   */
  finalize(
    requestId: string,
    flags: LogFlag[],
    logMessageId: string | null,
    leftoverCardId: string | null,
    cardAlertAt: string | null,
    cardTriedAt: string | null,
  ): Promise<unknown> {
    return this.call(
      "PATCH",
      `?request_id=eq.${requestId}`,
      { approval_message_id: leftoverCardId, flags, log_message_id: logMessageId, card_alert_at: cardAlertAt, card_tried_at: cardTriedAt },
      "return=minimal",
    );
  }

  /** Decided rows whose approval card (screenshot) still needs deleting. */
  /** Least-recently-tried first (never tried = first), so permanently failing cards can't starve newer ones. */
  leftoverCards(limit: number): Promise<Pick<RequestRow, "request_id" | "approval_message_id" | "card_alert_at">[]> {
    return this.call(
      "GET",
      `?select=request_id,approval_message_id,card_alert_at&status=neq.pending&approval_message_id=not.is.null&order=card_tried_at.asc.nullsfirst,decided_at.asc&limit=${limit}`,
    );
  }

  /** Card deleted (or already gone): clear the id. Optionally record that the one-time alert was posted. */
  updateCard(requestId: string, patch: { approval_message_id?: null; card_alert_at?: string; card_tried_at?: string }): Promise<unknown> {
    return this.call("PATCH", `?request_id=eq.${requestId}&status=neq.pending`, patch, "return=minimal");
  }

  /** Decided rows older than the retention cutoff (12 months), oldest first. */
  decidedBefore(cutoffIso: string, limit: number): Promise<Pick<RequestRow, "request_id" | "log_message_id">[]> {
    return this.call(
      "GET",
      `?select=request_id,log_message_id&status=neq.pending&approval_message_id=is.null&decided_at=lt.${encodeURIComponent(cutoffIso)}&order=decided_at.asc&limit=${limit}`,
    );
  }

  /** Hard-delete log rows (retention purge). Only rows that are no longer pending. */
  deleteDecided(requestIds: string[]): Promise<unknown> {
    if (requestIds.length === 0) return Promise.resolve();
    return this.call("DELETE", `?request_id=in.(${requestIds.join(",")})&status=neq.pending`, undefined, "return=minimal");
  }

  stalePending(olderThanIso: string, limit: number): Promise<RequestRow[]> {
    return this.call("GET", `?select=*&status=eq.pending&created_at=lt.${encodeURIComponent(olderThanIso)}&order=created_at.asc&limit=${limit}`);
  }
}
