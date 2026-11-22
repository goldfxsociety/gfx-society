/**
 * Cron Trigger (every 5 min). One shared budget per tick (Discord + CDN + D1 ≤ 45, Workers Free cap is 50).
 * Order: 1st-of-month VIP reset → 7-day reminder → leftover card cleanup → 48h escalation.
 * Monthly jobs are idempotent per Asia/Manila 'YYYY-MM' in cron_runs and resume across ticks (phase + cursor).
 */
import { cardContext, extFor, LineCache, postCard } from "./cards";
import { SPEC_REMINDER, SPEC_RESET_DAY } from "./copy";
import { parseFlags } from "./db";
import { type Deps, cdnFetch, HOURS_48, log } from "./deps";
import { DiscordError } from "./discord";
import { BudgetExceeded, CRON_BUDGET, Meter } from "./meter";
import { NO_MENTIONS } from "./payloads";
import { deleteTrackedCard } from "./review";
import { sniffImageType } from "./attachments";
import { manila, monthStartUtc, periodKey, RESET_CATCHUP_DAYS, reverifyWindowStartUtc, upcomingReset } from "./time";
import type { Application, IbLine } from "./types";

export interface CronSummary {
  reset: number;
  resetDms: number;
  reminders: number;
  cards: number;
  escalated: number;
  topAlerts: number;
  used: number;
}

/** Worst-case units per item (kept in sync with the code paths below). */
export const COST = {
  resetRole: 3, // DELETE role + UPDATE member + INSERT log
  resetDm: 3, // open DM + send + UPDATE log
  reminder: 3, // open DM + send + UPDATE cursor
  card: 3, // DELETE message + UPDATE review_cards + maybe UPDATE applications
  escalation: 12, // lines(3) + member(1) + GET msg + CDN + POST card + UPDATE + DELETE old + log + admin-log
  batchQuery: 1,
  finish: 4,
} as const;

const is429 = (e: unknown) => e instanceof DiscordError && e.status === 429;
const stop = (e: unknown) => e instanceof BudgetExceeded || is429(e);

async function adminLog(deps: Deps, content: string) {
  await deps.discord.createMessage(deps.cfg.adminLogChannelId, { content, allowed_mentions: NO_MENTIONS }).catch((e) => {
    if (stop(e)) throw e;
    log("admin-log failed", e);
  });
}

export async function runCron(input: Deps, budget = CRON_BUDGET): Promise<CronSummary> {
  const meter = new Meter(budget);
  const deps: Deps = { ...input, discord: input.discord.forCron(meter), db: input.db.withMeter(meter) };
  const s: CronSummary = { reset: 0, resetDms: 0, reminders: 0, cards: 0, escalated: 0, topAlerts: 0, used: 0 };
  const step = async (name: string, fn: () => Promise<void>) => {
    if (deps.discord.rateLimited || !meter.has(2)) return;
    try {
      await fn();
    } catch (e) {
      if (!stop(e)) log(`cron ${name} failed`, e);
    }
  };
  await step("reset", () => vipReset(deps, meter, s));
  await step("reminder", () => vipReminder(deps, meter, s));
  await step("cards", () => cleanupCards(deps, meter, s));
  await step("escalation", () => escalate(deps, meter, s));
  s.used = meter.used;
  return s;
}

/** 1st of the month (Asia/Manila): VIP → FREE. Keeps FREE and Sub-IB. Includes IBs who are VIP. */
export async function vipReset(deps: Deps, meter: Meter, s: CronSummary): Promise<void> {
  const { db, discord, cfg } = deps;
  const now = deps.now();
  const t = manila(now);
  const key = periodKey(t.y, t.m);
  if (now < monthStartUtc(t.y, t.m)) return;
  let run = await db.getRun("vip_reset", key);
  if (run && run.status !== "running") return;
  if (!run) {
    if (t.day > RESET_CATCHUP_DAYS) return; // never start mid-month (e.g. first deploy on the 22nd)
    await db.startRun("vip_reset", key, now.toISOString());
    run = await db.getRun("vip_reset", key);
    if (!run) return;
    await adminLog(deps, `[VIP RESET ${key}] started (Asia/Manila). Only VIP is removed; FREE and Sub-IB stay.`);
  }
  // VIPs approved on/after the reminder date (7 days before the 1st) reverified for this month: not reset.
  const cutoff = reverifyWindowStartUtc(t.y, t.m).toISOString();
  let phase = run.phase === "start" ? "roles" : run.phase;
  let cursor = run.cursor;

  while (phase === "roles") {
    if (!meter.has(COST.batchQuery + COST.resetRole + 1)) return;
    const n = Math.min(10, Math.floor((meter.left() - 2) / COST.resetRole));
    const batch = await db.vipBefore(cutoff, cursor, n);
    if (batch.length === 0) {
      phase = "dms";
      await db.updateRun("vip_reset", key, { phase, cursor: null }, now.toISOString());
      break;
    }
    let processed = 0;
    let failed = 0;
    for (const m of batch) {
      if (!meter.has(COST.resetRole + 1)) break;
      try {
        const present = await discord.removeRole(cfg.guildId, m.discord_user_id, cfg.vipRoleId);
        await db.resetMember(m.discord_user_id, key, now.toISOString(), !present);
        processed++;
        s.reset++;
      } catch (e) {
        if (stop(e)) {
          await db.updateRun("vip_reset", key, { cursor, addProcessed: processed, addFailed: failed }, now.toISOString()).catch(() => undefined);
          throw e;
        }
        log("reset member failed", e);
        failed++;
      }
      cursor = m.discord_user_id;
    }
    await db.updateRun("vip_reset", key, { cursor, addProcessed: processed, addFailed: failed }, now.toISOString());
  }

  while (phase === "dms") {
    if (!meter.has(COST.batchQuery + COST.finish)) return;
    const n = Math.min(10, Math.floor((meter.left() - 1) / COST.resetDm));
    const rows = n > 0 ? await db.resetDmsPending(key, n) : [];
    if (rows.length === 0) {
      if (!meter.has(COST.finish)) return;
      const c = await db.countResetLogs(key);
      await adminLog(deps, `[VIP RESET ${key}] done: ${c.total} VIP → FREE · DMs sent ${c.sent}, closed ${c.failed}, left server ${c.skipped}. FREE and Sub-IB kept.`);
      await db.finishRun("vip_reset", key, now.toISOString());
      return;
    }
    for (const r of rows) {
      if (!meter.has(COST.resetDm)) return;
      const ok = await discord.dm(r.target_discord_id, SPEC_RESET_DAY);
      await db.setDmStatus(r.id, ok ? "sent" : "failed");
      s.resetDms++;
    }
  }
}

/** 7 days before the 1st (Asia/Manila): DM current VIPs (incl. VIP IBs) the reminder. Keyed by the reset month. */
export async function vipReminder(deps: Deps, meter: Meter, s: CronSummary): Promise<void> {
  const { db, discord } = deps;
  const now = deps.now();
  const up = upcomingReset(now);
  if (now < up.windowStart) return;
  let run = await db.getRun("vip_reminder", up.key);
  if (run && run.status !== "running") return;
  if (!run) {
    await db.startRun("vip_reminder", up.key, now.toISOString());
    run = await db.getRun("vip_reminder", up.key);
    if (!run) return;
  }
  const cutoff = up.windowStart.toISOString();
  let cursor = run.cursor;
  for (;;) {
    if (!meter.has(COST.batchQuery + COST.reminder)) return;
    const n = Math.min(10, Math.floor((meter.left() - 1) / COST.reminder));
    const batch = await db.vipBefore(cutoff, cursor, n);
    if (batch.length === 0) {
      if (!meter.has(3)) return;
      const r = await db.getRun("vip_reminder", up.key);
      await adminLog(deps, `[VIP REMINDER ${up.key}] sent to ${r?.processed ?? 0} VIP member(s), ${r?.failed ?? 0} with DMs closed.`);
      await db.finishRun("vip_reminder", up.key, now.toISOString());
      return;
    }
    for (const m of batch) {
      if (!meter.has(COST.reminder)) return;
      const ok = await discord.dm(m.discord_user_id, SPEC_REMINDER);
      cursor = m.discord_user_id;
      await db.updateRun("vip_reminder", up.key, { cursor, addProcessed: ok ? 1 : 0, addFailed: ok ? 0 : 1 }, now.toISOString());
      s.reminders++;
    }
  }
}

/** Retry deleting leftover review cards (screenshots), including ones from a failed post-hop delete. */
export async function cleanupCards(deps: Deps, meter: Meter, s: CronSummary): Promise<void> {
  if (!meter.has(COST.batchQuery + COST.card)) return;
  const rows = await deps.db.cardsToClean(Math.min(5, Math.floor((meter.left() - 1) / COST.card)));
  for (const r of rows) {
    if (!meter.has(COST.card + 1)) return;
    const ok = await deleteTrackedCard(deps, { applicationId: r.application_id, channelId: r.channel_id, messageId: r.message_id });
    if (!ok) continue;
    s.cards++;
    if ((await deps.db.openCardCount(r.application_id)) === 0) await deps.db.markCardDeleted(r.application_id, deps.now().toISOString());
  }
}

/** Walk up from a line to the first active upline with a review channel. null = already at the top (Coach Mike). */
async function nextReviewer(cache: LineCache, line: IbLine): Promise<IbLine | null> {
  let cur: IbLine | null = line;
  for (let hops = 0; hops < 20 && cur; hops++) {
    const up: IbLine | null = await cache.get(cur.upline_line_id);
    if (!up) return null;
    if (up.active && up.review_channel_id) return up;
    cur = up;
  }
  return null;
}

/** 48h rule: move undecided applications up the upline chain, stopping at Coach Mike (alert admins once). */
export async function escalate(deps: Deps, meter: Meter, s: CronSummary): Promise<void> {
  const { db, discord } = deps;
  if (!meter.has(COST.batchQuery + COST.escalation)) return;
  const due = await db.dueEscalations(deps.now().toISOString(), Math.min(5, Math.floor((meter.left() - 1) / COST.escalation)) || 1);
  const cache = new LineCache(db);
  for (const app of due) {
    if (!meter.has(COST.escalation)) return;
    const current = await cache.get(app.current_reviewer_line_id);
    const up = current ? await nextReviewer(cache, current) : null;
    const nowIso = deps.now().toISOString();
    if (!current || !up) {
      // Already at Coach Mike (top of the tree): stop escalating and alert admins once.
      await db.stopEscalation(app, "top_alerted");
      await db.log({ applicationId: app.id, action: "escalation_top_alert", targetId: app.applicant_discord_id, lineId: current?.id ?? null }, nowIso);
      await adminLog(deps, `[ESCALATION] app ${app.id} · ${app.type.toUpperCase()} · <@${app.applicant_discord_id}> is still pending at ${current?.display_name ?? "?"} (top of tree) after 48h. Admin follow-up needed.`);
      s.topAlerts++;
      continue;
    }
    await moveUp(deps, app, current, up, cache);
    s.escalated++;
  }
}

async function moveUp(deps: Deps, app: Application, from: IbLine, to: IbLine, cache: LineCache): Promise<void> {
  const { db, discord } = deps;
  const flags = parseFlags(app.flags);
  // Keep the screenshot until the final decision: re-upload the bytes from the old card into the new one.
  let image: { bytes: Uint8Array; type: string; ext: string } | null = null;
  if (app.type !== "ib" && app.review_channel_id && app.review_message_id) {
    const old = await discord.getMessage(app.review_channel_id, app.review_message_id);
    const url = old?.attachments?.[0]?.url;
    if (url) {
      const res = await cdnFetch(deps, url);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const type = sniffImageType(bytes);
        if (type) image = { bytes, type, ext: extFor(type) };
      }
    }
    if (!image && !flags.includes("screenshot_missing")) flags.push("screenshot_missing");
  }
  const nowIso = deps.now().toISOString();
  const next: Application = {
    ...app,
    current_reviewer_line_id: to.id,
    escalation_hops: app.escalation_hops + 1,
    escalate_after_at: new Date(deps.now().getTime() + HOURS_48).toISOString(),
    flags: flags.join(","),
  };
  const ctx = await cardContext(deps, next, cache);
  const posted = await postCard(deps, to.review_channel_id!, next, ctx, image);
  // Track the new card immediately so a failed cleanup still retries it if the hop loses the race with a decision.
  await db.recordCard(app.id, to.review_channel_id!, posted.id, nowIso);
  const moved = await db.moveCard({
    id: app.id,
    reviewerLineId: to.id,
    channelId: to.review_channel_id!,
    messageId: posted.id,
    screenshotUrl: posted.screenshotUrl,
    hops: next.escalation_hops,
    escalateAfterAt: next.escalate_after_at,
    flags,
  });
  if (!moved) {
    // Decided meanwhile: remove the new card again. Cron retries it if this delete fails.
    await deleteTrackedCard(deps, { applicationId: app.id, channelId: to.review_channel_id!, messageId: posted.id });
    return;
  }
  if (app.review_channel_id && app.review_message_id) {
    try {
      await discord.deleteOwnMessage(app.review_channel_id, app.review_message_id);
      await db.markReviewCardDeleted(app.review_channel_id, app.review_message_id, nowIso);
    } catch (e) {
      if (stop(e)) throw e;
      log("delete old card failed", e);
      await db.log({ applicationId: app.id, action: "card_delete_failed" }, nowIso).catch(() => undefined);
    }
  }
  await db.log({ applicationId: app.id, action: "escalated", targetId: app.applicant_discord_id, lineId: to.id, detail: `from line ${from.id} to ${to.id}` }, nowIso);
  await adminLog(deps, `[ESCALATED 48h] app ${app.id} · ${app.type.toUpperCase()} · <@${app.applicant_discord_id}> · ${from.display_name} → ${to.display_name}`);
}
