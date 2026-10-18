import { checkAdmin } from "./admin";
import { attachmentsFromModal, checkAttachmentMeta, isDiscordCdnUrl, sniffImageType } from "./attachments";
import { APPROVE_DM, approvalCardText, cardDeleteAlert, dmFallback, logLine, MSG, needsInfoDm, REASONS, rejectDm, statusText } from "./copy";
import type { Db } from "./db";
import { type Discord, DiscordCode, DiscordError } from "./discord";
import {
  approvalCard,
  CID,
  decisionButtons,
  deferEphemeral,
  deferUpdate,
  ephemeral,
  infoModal,
  modalValue,
  NO_MENTIONS,
  parseDecisionId,
  rejectModal,
  uploadModal,
} from "./payloads";
import { type Attachment, type Config, type Interaction, InteractionType, type LogFlag, type ReasonCode, type RequestRow, type WaitCtx, EPHEMERAL } from "./types";

export interface Deps {
  cfg: Config;
  discord: Discord;
  db: Db;
  /** fetch used for downloading the attachment from Discord's CDN. */
  fetchImpl: typeof fetch;
  now: () => Date;
}

export const LIMITS = {
  maxPerDay: 5,
  cooldownAfterRejectMs: 10 * 60 * 1000,
  pendingExpiryMs: 7 * 24 * 60 * 60 * 1000,
  /** Decision-log retention (decided default): 12 months. */
  retentionMonths: 12,
  // Per hourly cron run, sized to stay under the Workers Free limit of 50 subrequests:
  // expiry ≤ 1 + 4×5 = 21 (decide, card delete, mirror, alert, finalize),
  // card retry ≤ 1 + 4×3 = 13 (delete, alert, patch), purge ≤ 1 + 12 + 1 = 14. Total ≤ 48.
  expireBatch: 4,
  cardRetryBatch: 4,
  purgeBatch: 12,
} as const;

const log = (msg: string, e?: unknown) => console.error(`[vip-bot] ${msg}${e instanceof Error ? `: ${e.message}` : ""}`);

const isVip = (i: Interaction, cfg: Config) => Boolean(i.member?.roles?.includes(cfg.vipRoleId));

/** Synchronous router. Returns the initial interaction response (must be within 3 s); slow work goes to ctx.waitUntil. */
export function handleInteraction(i: Interaction, deps: Deps, ctx: WaitCtx): unknown {
  const { cfg } = deps;
  if (i.type === InteractionType.PING) return { type: 1 };
  if (i.guild_id !== cfg.guildId || !i.member?.user?.id) return ephemeral(MSG.guildOnly);

  if (i.type === InteractionType.APPLICATION_COMMAND) {
    if (i.data?.name === "verify-deposit") return startVerification(i, cfg);
    if (i.data?.name === "verify-status") {
      ctx.waitUntil(runStatus(i, deps));
      return deferEphemeral();
    }
    return ephemeral(MSG.error);
  }

  if (i.type === InteractionType.MESSAGE_COMPONENT) {
    const cid = i.data?.custom_id;
    if (cid === CID.start) return startVerification(i, cfg);
    const d = parseDecisionId(cid);
    if (!d || d.action === "rejectModal" || d.action === "infoModal") return ephemeral(MSG.error);
    const admin = checkAdmin(i, cfg);
    if (!admin.ok) return ephemeral(admin.reason === "wrong_channel" ? MSG.notInApprovals : MSG.notAdmin);
    if (d.action === "reject") return rejectModal(d.requestId);
    if (d.action === "info") return infoModal(d.requestId);
    ctx.waitUntil(runApprove(i, d.requestId, admin.adminId, deps));
    return deferUpdate();
  }

  if (i.type === InteractionType.MODAL_SUBMIT) {
    const cid = i.data?.custom_id;
    if (cid === CID.submitModal) return submitScreenshot(i, deps, ctx);
    const d = parseDecisionId(cid);
    if (d?.action === "rejectModal") {
      const admin = checkAdmin(i, cfg);
      if (!admin.ok) return ephemeral(admin.reason === "wrong_channel" ? MSG.notInApprovals : MSG.notAdmin);
      const rawReason = modalValue(i.data?.components as never, CID.reason);
      const code = (Array.isArray(rawReason) ? rawReason[0] : rawReason) as ReasonCode | undefined;
      const reason: ReasonCode = code && code in REASONS ? code : "other";
      const note = modalValue(i.data?.components as never, CID.note);
      ctx.waitUntil(runReject(i, d.requestId, admin.adminId, reason, typeof note === "string" ? note : undefined, deps));
      return deferUpdate();
    }
    if (d?.action === "infoModal") {
      const admin = checkAdmin(i, cfg);
      if (!admin.ok) return ephemeral(admin.reason === "wrong_channel" ? MSG.notInApprovals : MSG.notAdmin);
      const note = modalValue(i.data?.components as never, CID.note);
      ctx.waitUntil(runNeedsInfo(i, d.requestId, admin.adminId, typeof note === "string" ? note : "", deps));
      return deferUpdate();
    }
    return ephemeral(MSG.error);
  }
  return ephemeral(MSG.error);
}

function startVerification(i: Interaction, cfg: Config) {
  if (i.channel_id !== cfg.verifyChannelId) return ephemeral(MSG.wrongChannel(cfg.verifyChannelId));
  if (isVip(i, cfg)) return ephemeral(MSG.alreadyVip);
  return uploadModal();
}

function submitScreenshot(i: Interaction, deps: Deps, ctx: WaitCtx) {
  const { cfg } = deps;
  if (isVip(i, cfg)) return ephemeral(MSG.alreadyVip);
  const maxBytes = Math.min(cfg.maxUploadBytes, i.attachment_size_limit ?? Number.POSITIVE_INFINITY);
  const maxMb = Math.floor(maxBytes / (1024 * 1024));
  const atts = attachmentsFromModal(i.data?.components as never, i.data?.resolved?.attachments, CID.upload);
  const check = checkAttachmentMeta(atts, maxBytes);
  if (!check.ok) return ephemeral(check.reason === "missing" ? MSG.noFile : MSG.badFile(maxMb));
  const att = atts[0]!;
  if (!isDiscordCdnUrl(att.url)) return ephemeral(MSG.error);
  ctx.waitUntil(processSubmission(i, att, maxBytes, maxMb, deps));
  return deferEphemeral();
}

/** Abuse limits: one pending per member, 10-min cooldown after a rejection, max 5 per 24 h. */
export function rateDecision(
  recent: Pick<RequestRow, "status" | "created_at" | "decided_at">[],
  now: Date,
): "ok" | "pending" | "cooldown" | "daily_cap" {
  if (recent.some((r) => r.status === "pending")) return "pending";
  if (recent.length >= LIMITS.maxPerDay) return "daily_cap";
  const lastReject = recent.find((r) => r.status === "rejected" && r.decided_at);
  if (lastReject && now.getTime() - Date.parse(lastReject.decided_at!) < LIMITS.cooldownAfterRejectMs) return "cooldown";
  return "ok";
}

export async function processSubmission(i: Interaction, att: Attachment, maxBytes: number, maxMb: number, deps: Deps): Promise<void> {
  const { cfg, db, discord } = deps;
  const memberId = i.member!.user!.id;
  const requestId = i.id;
  const reply = (content: string) => discord.editOriginal(i.token, { content, allowed_mentions: NO_MENTIONS }).catch((e) => log("edit ack failed", e));
  try {
    const since = new Date(deps.now().getTime() - 24 * 60 * 60 * 1000).toISOString();
    const rate = rateDecision(await db.recentForMember(cfg.guildId, memberId, since), deps.now());
    if (rate !== "ok") {
      await reply(rate === "pending" ? MSG.pending : rate === "cooldown" ? MSG.cooldown : MSG.dailyCap);
      return;
    }
    const created = await db.createPending(requestId, cfg.guildId, memberId);
    if (!created.ok) {
      if (created.reason === "duplicate_pending") await reply(MSG.pending);
      return; // duplicate delivery of the same interaction: already handled
    }

    let postedId: string | null = null;
    try {
      const res = await deps.fetchImpl(att.url);
      if (!res.ok) throw new Error(`cdn ${res.status}`);
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > maxBytes) throw new BadFile();
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) throw new BadFile();
      const realType = sniffImageType(bytes);
      if (!realType) throw new BadFile();
      const ext = realType === "image/png" ? "png" : realType === "image/jpeg" ? "jpg" : "webp";
      const createdUnix = Math.floor(deps.now().getTime() / 1000);
      const card = approvalCard(requestId, memberId, createdUnix, ext);
      const msg = await discord.createMessageWithFile(cfg.approvalsChannelId, card.payload, new Blob([bytes], { type: realType }), card.filename);
      postedId = msg.id;
      await db.setApprovalMessage(requestId, msg.id);
    } catch (e) {
      // "Re-upload fails → the request is not created."
      if (postedId) await discord.deleteOwnMessage(cfg.approvalsChannelId, postedId).catch((err) => log("cleanup card failed", err));
      await db.deletePending(requestId).catch((err) => log("cleanup row failed", err));
      await reply(e instanceof BadFile ? MSG.badFile(maxMb) : MSG.error);
      if (!(e instanceof BadFile)) log("submission failed", e);
      return;
    }
    await reply(MSG.received);
  } catch (e) {
    log("submission failed", e);
    await reply(MSG.error);
  }
}

class BadFile extends Error {}

async function runStatus(i: Interaction, deps: Deps): Promise<void> {
  try {
    const row = await deps.db.latestForMember(deps.cfg.guildId, i.member!.user!.id);
    const content = row ? statusText(row.status, row.reason_code) : MSG.statusNone;
    await deps.discord.editOriginal(i.token, { content, allowed_mentions: NO_MENTIONS });
  } catch (e) {
    log("status failed", e);
    await deps.discord.editOriginal(i.token, { content: MSG.error }).catch(() => undefined);
  }
}

const adminNotice = (deps: Deps, i: Interaction, content: string) =>
  deps.discord.followup(i.token, { content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS }).catch((e) => log("followup failed", e));

/** Shared pre-checks before the atomic decision. Returns the row only if this admin may decide it. */
async function precheck(i: Interaction, requestId: string, adminId: string, deps: Deps): Promise<RequestRow | null> {
  const row = await deps.db.get(requestId);
  if (!row) {
    await adminNotice(deps, i, MSG.notFound);
    return null;
  }
  if (row.member_id === adminId) {
    await adminNotice(deps, i, MSG.selfDecision);
    return null;
  }
  if (row.status !== "pending") {
    await adminNotice(deps, i, MSG.alreadyDecided(row.admin_id));
    return null;
  }
  return row;
}

async function lockCard(deps: Deps, row: RequestRow, messageId: string | null) {
  if (!messageId) return;
  const content = `${approvalCardText(row.request_id, row.member_id, Math.floor(Date.parse(row.created_at) / 1000))}\n${MSG.processing}`;
  await deps.discord
    .editMessage(deps.cfg.approvalsChannelId, messageId, { content, allowed_mentions: NO_MENTIONS, components: decisionButtons(row.request_id, true) })
    .catch((e) => log("lock card failed", e));
}

async function notifyMember(deps: Deps, memberId: string, content: string, flags: LogFlag[]) {
  const ok = await deps.discord.dm(memberId, content);
  if (!ok) {
    flags.push("dm_failed");
    await deps.discord
      .createMessage(deps.cfg.verifyChannelId, { content: dmFallback(memberId), allowed_mentions: { parse: [], users: [memberId] } })
      .catch((e) => log("dm fallback failed", e));
  }
}

const cardUrl = (cfg: Config, messageId: string) => `https://discord.com/channels/${cfg.guildId}/${cfg.approvalsChannelId}/${messageId}`;

/** Deletes an approval card. True if deleted or already gone (404); false on any other error. */
async function tryDeleteCard(deps: Deps, messageId: string): Promise<boolean> {
  try {
    await deps.discord.deleteOwnMessage(deps.cfg.approvalsChannelId, messageId); // 404 counts as success
    return true;
  } catch (e) {
    log("delete card failed", e);
    return false;
  }
}

/** One-time #vip-log alert so admins delete a stuck card by hand. Returns the alert time, or null if posting failed. */
async function postCardAlert(deps: Deps, requestId: string, messageId: string): Promise<string | null> {
  try {
    await deps.discord.createMessage(deps.cfg.logChannelId, { content: cardDeleteAlert(requestId, cardUrl(deps.cfg, messageId)), allowed_mentions: NO_MENTIONS });
    return deps.now().toISOString();
  } catch (e) {
    log("card alert failed", e);
    return null;
  }
}

async function closeOut(deps: Deps, row: RequestRow, messageId: string | null, flags: LogFlag[]) {
  const { discord, db, cfg } = deps;
  const cardGone = messageId ? await tryDeleteCard(deps, messageId) : true;
  const mirror = await discord
    .createMessage(cfg.logChannelId, {
      content: logLine({
        requestId: row.request_id,
        memberId: row.member_id,
        adminId: row.admin_id,
        decision: row.status,
        decidedAt: row.decided_at ?? deps.now().toISOString(),
        reason: row.reason_code,
        flags,
      }),
      allowed_mentions: NO_MENTIONS,
    })
    .catch((e) => {
      log("log mirror failed", e);
      return null;
    });
  // Card delete failed: keep its id for the hourly retry and alert admins once.
  const alertAt = !cardGone && messageId ? await postCardAlert(deps, row.request_id, messageId) : null;
  // Store the mirror's id so the 12-month purge can delete it too.
  await db
    .finalize(row.request_id, flags, mirror?.id ?? null, cardGone ? null : messageId, alertAt)
    .catch((e) => log("finalize failed", e));
}

export async function runApprove(i: Interaction, requestId: string, adminId: string, deps: Deps): Promise<void> {
  const { cfg, db, discord } = deps;
  try {
    const pre = await precheck(i, requestId, adminId, deps);
    if (!pre) return;
    const result = await db.decide(requestId, "approved", adminId, deps.now().toISOString());
    if (!result.won) {
      await adminNotice(deps, i, MSG.alreadyDecided(result.row?.admin_id ?? null));
      return;
    }
    const row = result.row;
    const messageId = row.approval_message_id ?? i.message?.id ?? null;
    await lockCard(deps, row, messageId);

    const flags: LogFlag[] = [];
    let memberLeft = false;
    try {
      const m = await discord.getMember(cfg.guildId, row.member_id);
      if (m.roles.includes(cfg.vipRoleId)) flags.push("already_vip");
    } catch (e) {
      if (e instanceof DiscordError && (e.code === DiscordCode.UNKNOWN_MEMBER || e.status === 404)) memberLeft = true;
      else throw e;
    }
    if (memberLeft) flags.push("member_left");

    if (!memberLeft && !flags.includes("already_vip")) {
      try {
        await discord.addRole(cfg.guildId, row.member_id, cfg.vipRoleId);
      } catch (e) {
        if (e instanceof DiscordError && (e.code === DiscordCode.MISSING_PERMISSIONS || e.status === 403)) {
          // Role hierarchy / permission problem: undo the decision so it can be retried after the fix.
          await db.revertToPending(requestId, adminId).catch((err) => log("revert failed", err));
          if (messageId)
            await discord
              .editMessage(cfg.approvalsChannelId, messageId, {
                content: approvalCardText(row.request_id, row.member_id, Math.floor(Date.parse(row.created_at) / 1000)),
                allowed_mentions: NO_MENTIONS,
                components: decisionButtons(row.request_id, false),
              })
              .catch((err) => log("unlock card failed", err));
          await discord.createMessage(cfg.approvalsChannelId, { content: MSG.hierarchy, allowed_mentions: NO_MENTIONS }).catch((err) => log("alert failed", err));
          return;
        }
        if (e instanceof DiscordError && (e.code === DiscordCode.UNKNOWN_MEMBER || e.status === 404)) {
          flags.push("member_left");
          memberLeft = true;
        } else throw e;
      }
    }
    if (!memberLeft) await notifyMember(deps, row.member_id, APPROVE_DM, flags);
    await closeOut(deps, row, messageId, flags);
  } catch (e) {
    log("approve failed", e);
    await adminNotice(deps, i, MSG.error);
  }
}

export async function runReject(
  i: Interaction,
  requestId: string,
  adminId: string,
  reason: ReasonCode,
  note: string | undefined,
  deps: Deps,
): Promise<void> {
  try {
    const pre = await precheck(i, requestId, adminId, deps);
    if (!pre) return;
    const result = await deps.db.decide(requestId, "rejected", adminId, deps.now().toISOString(), reason);
    if (!result.won) {
      await adminNotice(deps, i, MSG.alreadyDecided(result.row?.admin_id ?? null));
      return;
    }
    const row = result.row;
    const messageId = row.approval_message_id ?? i.message?.id ?? null;
    await lockCard(deps, row, messageId);
    const flags: LogFlag[] = [];
    await notifyMember(deps, row.member_id, rejectDm(reason, note), flags);
    await closeOut(deps, row, messageId, flags);
  } catch (e) {
    log("reject failed", e);
    await adminNotice(deps, i, MSG.error);
  }
}

/** "Need more info": closes this request as needs_info (member may resubmit right away, no cooldown), DMs the note. */
export async function runNeedsInfo(i: Interaction, requestId: string, adminId: string, note: string, deps: Deps): Promise<void> {
  try {
    const pre = await precheck(i, requestId, adminId, deps);
    if (!pre) return;
    const result = await deps.db.decide(requestId, "needs_info", adminId, deps.now().toISOString());
    if (!result.won) {
      await adminNotice(deps, i, MSG.alreadyDecided(result.row?.admin_id ?? null));
      return;
    }
    const row = result.row;
    const messageId = row.approval_message_id ?? i.message?.id ?? null;
    await lockCard(deps, row, messageId);
    const flags: LogFlag[] = [];
    await notifyMember(deps, row.member_id, needsInfoDm(note), flags);
    await closeOut(deps, row, messageId, flags);
  } catch (e) {
    log("needs-info failed", e);
    await adminNotice(deps, i, MSG.error);
  }
}

/** 12 months before `now` (calendar months, UTC). */
export function retentionCutoff(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - LIMITS.retentionMonths);
  return d;
}

/**
 * Cron: delete decision-log rows older than 12 months and their #vip-log mirror messages.
 * Uses single-message DELETE on the bot's OWN messages (works at any age; bulk delete only works for
 * messages < 14 days old, so it is not used). The row is deleted only after its #vip-log line is deleted or
 * already gone (404); on any other error the row is kept and retried next run. Rows with a leftover card are skipped.
 * Never touches roles: @VIP is permanent.
 */
export async function purgeOldLogs(deps: Deps): Promise<number> {
  const cutoff = retentionCutoff(deps.now()).toISOString();
  const rows = await deps.db.decidedBefore(cutoff, LIMITS.purgeBatch);
  const done: string[] = [];
  for (const r of rows) {
    if (r.log_message_id) {
      try {
        await deps.discord.deleteOwnMessage(deps.cfg.logChannelId, r.log_message_id);
      } catch (e) {
        if (e instanceof DiscordError && e.status === 429) {
          log("purge rate-limited; will retry next run", e);
          break;
        }
        log("purge: mirror delete failed; keeping row for next run", e);
        continue; // only delete the row once its #vip-log line is gone (deleted or 404)
      }
    }
    done.push(r.request_id);
  }
  await deps.db.deleteDecided(done);
  return done.length;
}

/** Cron: retry deleting approval cards (screenshots) left behind on decided rows; alert #vip-log once per card. */
export async function retryLeftoverCards(deps: Deps): Promise<number> {
  const rows = await deps.db.leftoverCards(LIMITS.cardRetryBatch);
  let deleted = 0;
  for (const r of rows) {
    if (!r.approval_message_id) continue;
    if (await tryDeleteCard(deps, r.approval_message_id)) {
      await deps.db.updateCard(r.request_id, { approval_message_id: null }).catch((e) => log("clear card failed", e));
      deleted++;
    } else if (!r.card_alert_at) {
      const at = await postCardAlert(deps, r.request_id, r.approval_message_id);
      if (at) await deps.db.updateCard(r.request_id, { card_alert_at: at }).catch((e) => log("mark alert failed", e));
    }
  }
  return deleted;
}

/** Hourly cron: expiry + leftover-card retry + retention purge. */
export async function maintenance(deps: Deps): Promise<{ expired: number; cards: number; purged: number }> {
  const expired = await expireStale(deps).catch((e) => {
    log("expiry failed", e);
    return 0;
  });
  const cards = await retryLeftoverCards(deps).catch((e) => {
    log("card retry failed", e);
    return 0;
  });
  const purged = await purgeOldLogs(deps).catch((e) => {
    log("purge failed", e);
    return 0;
  });
  return { expired, cards, purged };
}

/** Cron: expire pending requests older than 7 days and delete their cards (and so the screenshot). */
export async function expireStale(deps: Deps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - LIMITS.pendingExpiryMs).toISOString();
  const stale = await deps.db.stalePending(cutoff, LIMITS.expireBatch);
  let n = 0;
  for (const r of stale) {
    try {
      const res = await deps.db.decide(r.request_id, "expired", null, deps.now().toISOString());
      if (!res.won) continue;
      await closeOut(deps, res.row, res.row.approval_message_id, []);
      n++;
    } catch (e) {
      log("expire failed", e);
    }
  }
  return n;
}
