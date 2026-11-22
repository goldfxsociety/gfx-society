/** D1 data access. Every statement is metered (cron ticks stay under the Workers Free per-invocation limits). */
import type { Meter } from "./meter";
import type { AboveMin, AppFlag, Application, AppStatus, AppType, IbLine, MemberRow, Tier } from "./types";

export type LogAction =
  | "approved"
  | "denied"
  | "transferred"
  | "escalated"
  | "escalation_top_alert"
  | "line_created"
  | "vip_reset"
  | "vip_reminder"
  | "email_viewed"
  | "card_delete_failed"
  | "role_error"
  | "member_left";

export interface LogEntry {
  applicationId?: string | null;
  action: LogAction;
  actorId?: string | null;
  targetId?: string | null;
  lineId?: number | null;
  reasonCode?: string | null;
  /** Never an email, amount, or screenshot URL. */
  detail?: string | null;
  periodKey?: string | null;
  dmStatus?: "pending" | "sent" | "failed" | "skipped" | null;
}

export type CronJob = "vip_reminder" | "vip_reset";
export interface CronRun {
  job: CronJob;
  period_key: string;
  status: "running" | "done" | "skipped";
  phase: string;
  cursor: string | null;
  processed: number;
  failed: number;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface PostedCard {
  application_id: string;
  channel_id: string;
  message_id: string;
}

export interface NewApplication {
  id: string;
  applicantId: string;
  applicantName: string;
  type: AppType;
  accmUserId: string | null;
  accmIbEmail: string | null;
  targetLineId: number | null;
  reviewerLineId: number | null;
  reviewChannelId: string | null;
  status: AppStatus;
  flags: AppFlag[];
  createdAt: string;
  escalateAfterAt: string | null;
  decisionReason?: string | null;
  decidedAt?: string | null;
}

const isUnique = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/i.test(e.message);

export const parseFlags = (s: string | null | undefined): AppFlag[] => (s ? (s.split(",").filter(Boolean) as AppFlag[]) : []);
export const joinFlags = (f: AppFlag[]) => [...new Set(f)].join(",");

export class Db {
  constructor(
    private d1: D1Database,
    public meter?: Meter,
  ) {}

  withMeter(meter: Meter): Db {
    return new Db(this.d1, meter);
  }

  private stmt(sql: string, ...args: unknown[]): D1PreparedStatement {
    this.meter?.spend(1);
    const s = this.d1.prepare(sql);
    return args.length ? s.bind(...args.map((a) => (a === undefined ? null : a))) : s;
  }
  private async first<T>(sql: string, ...args: unknown[]): Promise<T | null> {
    return (await this.stmt(sql, ...args).first<T>()) ?? null;
  }
  private async all<T>(sql: string, ...args: unknown[]): Promise<T[]> {
    return (await this.stmt(sql, ...args).all<T>()).results ?? [];
  }
  private async run(sql: string, ...args: unknown[]): Promise<number> {
    const r = await this.stmt(sql, ...args).run();
    return r.meta?.changes ?? 0;
  }

  // ── IB lines ─────────────────────────────────────────────────────────────
  activeLines(): Promise<IbLine[]> {
    return this.all<IbLine>("SELECT * FROM ib_lines WHERE active = 1 ORDER BY display_name COLLATE NOCASE, id");
  }
  getLine(id: number): Promise<IbLine | null> {
    return this.first<IbLine>("SELECT * FROM ib_lines WHERE id = ?", id);
  }
  activeLineByUser(userId: string): Promise<IbLine | null> {
    return this.first<IbLine>("SELECT * FROM ib_lines WHERE discord_user_id = ? AND active = 1", userId);
  }
  async slugTaken(slug: string): Promise<boolean> {
    return Boolean(await this.first("SELECT 1 AS x FROM ib_lines WHERE slug = ?", slug));
  }
  /** Returns the new line id, or null if the email / slug / active-user uniqueness was violated. */
  async insertLine(l: { slug: string; displayName: string; userId: string; email: string; uplineId: number; roleId: string; channelId: string; createdAt: string }): Promise<number | null> {
    try {
      const row = await this.first<{ id: number }>(
        `INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id, role_id, review_channel_id, is_seed, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?) RETURNING id`,
        l.slug, l.displayName, l.userId, l.email, l.uplineId, l.roleId, l.channelId, l.createdAt,
      );
      return row?.id ?? null;
    } catch (e) {
      if (isUnique(e)) return null;
      throw e;
    }
  }

  /** Rollback only: remove a line created moments ago when its role assignment failed. */
  async deleteLine(id: number): Promise<void> {
    await this.run("DELETE FROM ib_lines WHERE id = ? AND is_seed = 0", id);
  }

  // ── Members ──────────────────────────────────────────────────────────────
  getMember(id: string): Promise<MemberRow | null> {
    return this.first<MemberRow>("SELECT * FROM members WHERE discord_user_id = ?", id);
  }
  /** Insert or update; only the provided fields change on update. */
  async upsertMember(id: string, now: string, f: Partial<Omit<MemberRow, "discord_user_id" | "created_at" | "updated_at">>): Promise<void> {
    const cols = Object.keys(f) as Array<keyof typeof f>;
    const insertCols = ["discord_user_id", ...cols, "created_at", "updated_at"];
    const placeholders = insertCols.map(() => "?").join(", ");
    const updates = [...cols.map((c) => `${c} = excluded.${c}`), "updated_at = excluded.updated_at"].join(", ");
    await this.run(
      `INSERT INTO members (${insertCols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (discord_user_id) DO UPDATE SET ${updates}`,
      id, ...cols.map((c) => f[c] as unknown), now, now,
    );
  }
  async accmUsedByOther(accm: string, userId: string): Promise<boolean> {
    return Boolean(
      await this.first(
        `SELECT 1 AS x FROM members WHERE accm_user_id = ?1 AND discord_user_id <> ?2
         UNION ALL SELECT 1 FROM applications WHERE accm_user_id = ?1 AND applicant_discord_id <> ?2 AND status IN ('pending', 'approved')
         LIMIT 1`,
        accm, userId,
      ),
    );
  }
  /** Duplicate IB email: an existing line, or another pending IB application. */
  async ibEmailTaken(email: string, excludeAppId: string | null): Promise<boolean> {
    return Boolean(
      await this.first(
        `SELECT 1 AS x FROM ib_lines WHERE accm_ib_email = ?1
         UNION ALL SELECT 1 FROM applications WHERE type = 'ib' AND accm_ib_email = ?1 AND status = 'pending' AND id <> ?2
         LIMIT 1`,
        email, excludeAppId ?? "",
      ),
    );
  }
  /** Most recent IB email this user ever submitted (admin-only use: returning-member note). */
  async previousIbEmail(userId: string): Promise<string | null> {
    const r = await this.first<{ e: string }>(
      `SELECT accm_ib_email AS e FROM ib_lines WHERE discord_user_id = ?1 AND accm_ib_email IS NOT NULL
       UNION ALL SELECT accm_ib_email FROM applications WHERE applicant_discord_id = ?1 AND type = 'ib' AND status = 'approved'
       LIMIT 1`,
      userId,
    );
    return r?.e ?? null;
  }

  // ── Applications ─────────────────────────────────────────────────────────
  getApp(id: string): Promise<Application | null> {
    return this.first<Application>("SELECT * FROM applications WHERE id = ?", id);
  }
  pendingFor(userId: string): Promise<Application | null> {
    return this.first<Application>("SELECT * FROM applications WHERE applicant_discord_id = ? AND status = 'pending'", userId);
  }
  latestFor(userId: string): Promise<Application | null> {
    return this.first<Application>("SELECT * FROM applications WHERE applicant_discord_id = ? ORDER BY created_at DESC, id DESC LIMIT 1", userId);
  }
  async countSince(userId: string, sinceIso: string): Promise<number> {
    const r = await this.first<{ n: number }>("SELECT count(*) AS n FROM applications WHERE applicant_discord_id = ? AND created_at >= ?", userId, sinceIso);
    return r?.n ?? 0;
  }
  async insertApp(a: NewApplication): Promise<"ok" | "dup_id" | "pending_exists"> {
    try {
      await this.run(
        `INSERT INTO applications (id, applicant_discord_id, applicant_display_name, type, accm_user_id, accm_ib_email, target_ib_line_id,
           current_reviewer_line_id, review_channel_id, status, flags, created_at, escalate_after_at, decision_reason, decided_at, screenshot_deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id, a.applicantId, a.applicantName, a.type, a.accmUserId, a.accmIbEmail, a.targetLineId, a.reviewerLineId, a.reviewChannelId,
        a.status, joinFlags(a.flags), a.createdAt, a.escalateAfterAt, a.decisionReason ?? null, a.decidedAt ?? null,
        a.status === "transferred" ? a.createdAt : null,
      );
      return "ok";
    } catch (e) {
      if (!isUnique(e)) throw e;
      return /applications\.id|PRIMARY/i.test((e as Error).message) ? "dup_id" : "pending_exists";
    }
  }
  async setCard(id: string, channelId: string, messageId: string, screenshotUrl: string | null, postedAt?: string): Promise<void> {
    await this.run("UPDATE applications SET review_channel_id = ?, review_message_id = ?, screenshot_url = ? WHERE id = ?", channelId, messageId, screenshotUrl, id);
    await this.recordCard(id, channelId, messageId, postedAt);
  }
  /** Remember every posted review card so leftover screenshots can be retried after a hop overwrites review_message_id. */
  async recordCard(applicationId: string, channelId: string, messageId: string, postedAt?: string): Promise<void> {
    await this.run(
      `INSERT INTO review_cards (application_id, channel_id, message_id, posted_at)
       VALUES (?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
       ON CONFLICT(channel_id, message_id) DO NOTHING`,
      applicationId, channelId, messageId, postedAt ?? null,
    );
  }
  async markReviewCardDeleted(channelId: string, messageId: string, nowIso: string): Promise<void> {
    await this.run(
      "UPDATE review_cards SET deleted_at = ? WHERE channel_id = ? AND message_id = ? AND deleted_at IS NULL",
      nowIso, channelId, messageId,
    );
  }
  openCards(applicationId: string): Promise<PostedCard[]> {
    return this.all<PostedCard>(
      "SELECT application_id, channel_id, message_id FROM review_cards WHERE application_id = ? AND deleted_at IS NULL ORDER BY id",
      applicationId,
    );
  }
  async openCardCount(applicationId: string): Promise<number> {
    const r = await this.first<{ n: number }>("SELECT count(*) AS n FROM review_cards WHERE application_id = ? AND deleted_at IS NULL", applicationId);
    return r?.n ?? 0;
  }
  async deleteApp(id: string): Promise<void> {
    await this.run("DELETE FROM applications WHERE id = ? AND status = 'pending'", id);
  }
  /** Atomic decision: only one reviewer can win. Returns the decided row, or null if it was no longer pending. */
  decide(id: string, status: Exclude<AppStatus, "pending">, actorId: string | null, nowIso: string, reason: string | null, aboveMin: AboveMin): Promise<Application | null> {
    return this.first<Application>(
      `UPDATE applications SET status = ?, decided_by_discord_id = ?, decided_at = ?, decision_reason = ?, vip_above_min = ?, escalate_after_at = NULL
       WHERE id = ? AND status = 'pending' RETURNING *`,
      status, actorId, nowIso, reason, aboveMin, id,
    );
  }
  /** Undo a won decision when the Discord side failed, so the reviewer can retry. */
  async undecide(id: string, escalateAfterAt: string | null): Promise<void> {
    await this.run(
      `UPDATE applications SET status = 'pending', decided_by_discord_id = NULL, decided_at = NULL, decision_reason = NULL, vip_above_min = NULL, escalate_after_at = ?
       WHERE id = ? AND status <> 'pending'`,
      escalateAfterAt, id,
    );
  }
  async addFlag(app: Application, flag: AppFlag): Promise<void> {
    await this.run("UPDATE applications SET flags = ? WHERE id = ?", joinFlags([...parseFlags(app.flags), flag]), app.id);
  }
  async markCardDeleted(id: string, nowIso: string): Promise<void> {
    await this.run("UPDATE applications SET screenshot_deleted_at = ?, screenshot_url = NULL WHERE id = ?", nowIso, id);
  }
  async moveCard(a: { id: string; reviewerLineId: number; channelId: string; messageId: string; screenshotUrl: string | null; hops: number; escalateAfterAt: string | null; flags: AppFlag[] }): Promise<boolean> {
    const n = await this.run(
      `UPDATE applications SET current_reviewer_line_id = ?, review_channel_id = ?, review_message_id = ?, screenshot_url = ?, escalation_hops = ?, escalate_after_at = ?, flags = ?
       WHERE id = ? AND status = 'pending'`,
      a.reviewerLineId, a.channelId, a.messageId, a.screenshotUrl, a.hops, a.escalateAfterAt, joinFlags(a.flags), a.id,
    );
    return n > 0;
  }
  async stopEscalation(app: Application, flag: AppFlag): Promise<void> {
    await this.run("UPDATE applications SET escalate_after_at = NULL, flags = ? WHERE id = ? AND status = 'pending'", joinFlags([...parseFlags(app.flags), flag]), app.id);
  }
  dueEscalations(nowIso: string, limit: number): Promise<Application[]> {
    return this.all<Application>(
      "SELECT * FROM applications WHERE status = 'pending' AND escalate_after_at IS NOT NULL AND escalate_after_at <= ? ORDER BY escalate_after_at, id LIMIT ?",
      nowIso, limit,
    );
  }
  /**
   * Posted review cards that should be deleted and retried by cron: every undeleted card that is
   * not the current card of a still-pending application (so a leftover after a 48h hop is included).
   */
  cardsToClean(limit: number): Promise<PostedCard[]> {
    return this.all<PostedCard>(
      `SELECT c.application_id, c.channel_id, c.message_id
       FROM review_cards c
       LEFT JOIN applications a ON a.id = c.application_id
       WHERE c.deleted_at IS NULL
         AND NOT (a.status = 'pending' AND a.review_channel_id = c.channel_id AND a.review_message_id = c.message_id)
       ORDER BY c.id
       LIMIT ?`,
      limit,
    );
  }

  // ── Logs ─────────────────────────────────────────────────────────────────
  async log(e: LogEntry, nowIso: string): Promise<void> {
    await this.run(
      `INSERT INTO decision_logs (application_id, action, actor_discord_id, target_discord_id, ib_line_id, reason_code, detail, period_key, dm_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e.applicationId ?? null, e.action, e.actorId ?? null, e.targetId ?? null, e.lineId ?? null, e.reasonCode ?? null,
      e.detail ? e.detail.slice(0, 400) : null, e.periodKey ?? null, e.dmStatus ?? null, nowIso,
    );
  }

  // ── Monthly jobs ─────────────────────────────────────────────────────────
  getRun(job: CronJob, key: string): Promise<CronRun | null> {
    return this.first<CronRun>("SELECT * FROM cron_runs WHERE job = ? AND period_key = ?", job, key);
  }
  async startRun(job: CronJob, key: string, nowIso: string, status: "running" | "skipped" = "running"): Promise<void> {
    await this.run(
      "INSERT INTO cron_runs (job, period_key, status, phase, started_at, updated_at, finished_at) VALUES (?, ?, ?, 'start', ?, ?, ?) ON CONFLICT (job, period_key) DO NOTHING",
      job, key, status, nowIso, nowIso, status === "skipped" ? nowIso : null,
    );
  }
  async updateRun(job: CronJob, key: string, f: { phase?: string; cursor?: string | null; addProcessed?: number; addFailed?: number }, nowIso: string): Promise<void> {
    await this.run(
      `UPDATE cron_runs SET phase = COALESCE(?, phase), cursor = CASE WHEN ? THEN ? ELSE cursor END,
         processed = processed + ?, failed = failed + ?, updated_at = ? WHERE job = ? AND period_key = ?`,
      f.phase ?? null, f.cursor !== undefined ? 1 : 0, f.cursor ?? null, f.addProcessed ?? 0, f.addFailed ?? 0, nowIso, job, key,
    );
  }
  async finishRun(job: CronJob, key: string, nowIso: string): Promise<void> {
    await this.run("UPDATE cron_runs SET status = 'done', phase = 'done', finished_at = ?, updated_at = ? WHERE job = ? AND period_key = ?", nowIso, nowIso, job, key);
  }
  /** VIP members due for reset/reminder: VIP verified before the reverify window. Cursor = last discord_user_id. */
  vipBefore(cutoffIso: string, cursor: string | null, limit: number): Promise<MemberRow[]> {
    return this.all<MemberRow>(
      `SELECT * FROM members WHERE tier = 'vip' AND (vip_verified_at IS NULL OR vip_verified_at < ?) AND discord_user_id > ?
       ORDER BY discord_user_id LIMIT ?`,
      cutoffIso, cursor ?? "", limit,
    );
  }
  /** Reset one member (DB side) and queue their reset DM. 2 statements, idempotent per month. */
  async resetMember(userId: string, key: string, nowIso: string, memberGone: boolean): Promise<void> {
    await this.run("UPDATE members SET tier = 'free', vip_above_min = NULL, updated_at = ? WHERE discord_user_id = ? AND tier = 'vip'", nowIso, userId);
    await this.run(
      `INSERT INTO decision_logs (action, target_discord_id, period_key, dm_status, detail, created_at) VALUES ('vip_reset', ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      userId, key, memberGone ? "skipped" : "pending", memberGone ? "member not in server" : null, nowIso,
    );
  }
  resetDmsPending(key: string, limit: number): Promise<Array<{ id: number; target_discord_id: string }>> {
    return this.all("SELECT id, target_discord_id FROM decision_logs WHERE action = 'vip_reset' AND period_key = ? AND dm_status = 'pending' ORDER BY id LIMIT ?", key, limit);
  }
  async setDmStatus(logId: number, status: "sent" | "failed"): Promise<void> {
    await this.run("UPDATE decision_logs SET dm_status = ? WHERE id = ?", status, logId);
  }
  async countResetLogs(key: string): Promise<{ total: number; sent: number; failed: number; skipped: number }> {
    const r = await this.first<{ total: number; sent: number; failed: number; skipped: number }>(
      `SELECT count(*) AS total, sum(dm_status = 'sent') AS sent, sum(dm_status = 'failed') AS failed, sum(dm_status = 'skipped') AS skipped
       FROM decision_logs WHERE action = 'vip_reset' AND period_key = ?`,
      key,
    );
    return { total: r?.total ?? 0, sent: r?.sent ?? 0, failed: r?.failed ?? 0, skipped: r?.skipped ?? 0 };
  }

  setTier(userId: string, tier: Tier, nowIso: string): Promise<number> {
    return this.run("UPDATE members SET tier = ?, updated_at = ? WHERE discord_user_id = ?", tier, nowIso, userId);
  }
}
