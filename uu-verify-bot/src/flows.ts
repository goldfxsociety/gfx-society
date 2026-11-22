/** Member-side flows: open the Client ako / IB ako modals, validate submissions, post review cards. */
import { attachmentsFromModal, checkAttachmentMeta, isDiscordCdnUrl, sniffImageType } from "./attachments";
import { cardContext, extFor, LineCache, postCard } from "./cards";
import { MSG, SPEC_TRANSFER, TRANSFER_OPTION_VALUE } from "./copy";
import type { NewApplication } from "./db";
import { type Deps, cdnFetch, displayName, HOURS_48, LIMITS, log, tierFromRoles } from "./deps";
import {
  CID,
  clientModal,
  deferEphemeral,
  ephemeral,
  firstValue,
  ibModal,
  MAX_LINES_IN_SELECT,
  modalValue,
  NO_MENTIONS,
  SELECT_MAX,
} from "./payloads";
import { inReverifyWindow } from "./time";
import type { AppFlag, Attachment, Interaction, Tier, WaitCtx } from "./types";

export const ACCM_USER_ID = /^\d{6}$/;
export const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

function allowedTypes(tier: Tier, now: Date): Array<"free" | "vip"> | string {
  if (tier === "unverified") return ["free"]; // FREE before VIP
  if (tier === "free") return ["vip"];
  return inReverifyWindow(now) ? ["vip"] : MSG.alreadyVip; // VIP reverify only in the 7 days before the 1st
}

/** Client ako button (or /verify-client with a chosen IB). */
export async function openClient(i: Interaction, deps: Deps, fixedLineId: number | null = null): Promise<unknown> {
  const { cfg, db } = deps;
  if (i.channel_id !== cfg.verifyChannelId) return ephemeral(MSG.wrongChannel(cfg.verifyChannelId));
  const userId = i.member!.user!.id;
  if (await db.pendingFor(userId)) return ephemeral(MSG.pending);
  const tier = tierFromRoles(i.member?.roles, cfg);
  const allowed = allowedTypes(tier, deps.now());
  if (typeof allowed === "string") return ephemeral(allowed);
  const lines = await db.activeLines();
  if (!fixedLineId && lines.length > MAX_LINES_IN_SELECT) return ephemeral(MSG.tooManyLinesClient);
  if (fixedLineId && !lines.some((l) => l.id === fixedLineId)) return ephemeral(MSG.lineGone);
  const member = tier === "unverified" ? null : await db.getMember(userId);
  return clientModal({ allowed, lines, defaultLineId: member?.referring_ib_line_id ?? null, prefillAccm: member?.accm_user_id ?? null, fixedLineId });
}

/** IB ako button (or /verify-ib with a chosen upline). */
export async function openIb(i: Interaction, deps: Deps, fixedLineId: number | null = null): Promise<unknown> {
  const { cfg, db } = deps;
  if (i.channel_id !== cfg.verifyChannelId) return ephemeral(MSG.wrongChannel(cfg.verifyChannelId));
  const userId = i.member!.user!.id;
  if (await db.pendingFor(userId)) return ephemeral(MSG.pending);
  if (await db.activeLineByUser(userId)) return ephemeral(MSG.alreadyIb);
  const lines = await db.activeLines();
  if (!fixedLineId && lines.length > SELECT_MAX) return ephemeral(MSG.tooManyLinesIb);
  if (fixedLineId && !lines.some((l) => l.id === fixedLineId)) return ephemeral(MSG.lineGone);
  const tier = tierFromRoles(i.member?.roles, cfg);
  // Client to sub-IB (spec §6): their current referring IB is the upline, pre-selected.
  const member = tier === "unverified" ? null : await db.getMember(userId);
  return ibModal({ lines, defaultLineId: member?.referring_ib_line_id ?? null, fixedLineId });
}

const fixedFrom = (customId: string | undefined, base: string): number | null => {
  const m = new RegExp(`^${base}:(\\d{1,10})$`).exec(customId ?? "");
  return m ? Number(m[1]) : null;
};

/** Self-selected "Wala sa list": answer with the §10 Transfer route copy right away and record it. */
export function transferNow(i: Interaction, deps: Deps, ctx: WaitCtx, accm: string | null, type: "free" | "vip") {
  ctx.waitUntil(recordTransfer(i, deps, accm, type));
  return ephemeral(SPEC_TRANSFER);
}

async function recordTransfer(i: Interaction, deps: Deps, accm: string | null, type: "free" | "vip") {
  const nowIso = deps.now().toISOString();
  const userId = i.member!.user!.id;
  try {
    const valid = accm !== null && ACCM_USER_ID.test(accm);
    if (valid) {
      const res = await deps.db.insertApp({
        id: i.id,
        applicantId: userId,
        applicantName: displayName(i.member),
        type,
        accmUserId: accm,
        accmIbEmail: null,
        targetLineId: null,
        reviewerLineId: null,
        reviewChannelId: null,
        status: "transferred",
        flags: [],
        createdAt: nowIso,
        escalateAfterAt: null,
        decisionReason: "not_tree_self_selected",
        decidedAt: nowIso,
      });
      if (res !== "ok") return;
    }
    await deps.db.log({ applicationId: valid ? i.id : null, action: "transferred", targetId: userId, reasonCode: "not_tree_self_selected" }, nowIso);
    await deps.discord
      .createMessage(deps.cfg.adminLogChannelId, {
        content: `[TRANSFER ROUTE (self-selected)] app ${i.id} · ${type.toUpperCase()} · <@${userId}> · picked "Wala sa list"`,
        allowed_mentions: NO_MENTIONS,
      })
      .catch((e) => log("admin-log failed", e));
  } catch (e) {
    log("record transfer failed", e);
  }
}

export function submitClient(i: Interaction, deps: Deps, ctx: WaitCtx): unknown {
  const { cfg } = deps;
  const comps = i.data?.components;
  const accm = String(firstValue(modalValue(comps, CID.fAccm)) ?? "").trim();
  if (!ACCM_USER_ID.test(accm)) return ephemeral(MSG.badUserId);
  const typeRaw = firstValue(modalValue(comps, CID.fType));
  if (typeRaw !== "free" && typeRaw !== "vip") return ephemeral(MSG.error);
  const tier = tierFromRoles(i.member?.roles, cfg);
  if (typeRaw === "vip" && tier === "unverified") return ephemeral(MSG.freeFirst);
  if (typeRaw === "free" && tier !== "unverified") return ephemeral(MSG.alreadyFree);
  if (typeRaw === "vip" && tier === "vip" && !inReverifyWindow(deps.now())) return ephemeral(MSG.alreadyVip);
  const fixed = fixedFrom(i.data?.custom_id, CID.clientSubmit);
  const lineRaw = fixed !== null ? String(fixed) : firstValue(modalValue(comps, CID.fLine));
  if (lineRaw === TRANSFER_OPTION_VALUE) return transferNow(i, deps, ctx, accm, typeRaw);
  if (!lineRaw || !/^\d{1,10}$/.test(lineRaw)) return ephemeral(MSG.pickLine);
  const maxBytes = Math.min(cfg.maxUploadBytes, i.attachment_size_limit ?? Number.POSITIVE_INFINITY);
  const maxMb = Math.floor(maxBytes / (1024 * 1024));
  const atts = attachmentsFromModal(comps as never, i.data?.resolved?.attachments, CID.fShot);
  const check = checkAttachmentMeta(atts, maxBytes);
  if (!check.ok) return ephemeral(check.reason === "missing" ? MSG.noFile : MSG.badFile(maxMb));
  const att = atts[0]!;
  if (!isDiscordCdnUrl(att.url)) return ephemeral(MSG.error);
  ctx.waitUntil(processClient(i, { accm, type: typeRaw, lineId: Number(lineRaw), tier, att, maxBytes, maxMb }, deps));
  return deferEphemeral();
}

export function submitIb(i: Interaction, deps: Deps, ctx: WaitCtx): unknown {
  const comps = i.data?.components;
  const email = String(firstValue(modalValue(comps, CID.fEmail)) ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return ephemeral(MSG.badEmail);
  const fixed = fixedFrom(i.data?.custom_id, CID.ibSubmit);
  const lineRaw = fixed !== null ? String(fixed) : firstValue(modalValue(comps, CID.fLine));
  if (!lineRaw || !/^\d{1,10}$/.test(lineRaw)) return ephemeral(MSG.pickLine);
  ctx.waitUntil(processIb(i, email, Number(lineRaw), deps));
  return deferEphemeral();
}

class BadFile extends Error {}

/** Common gate: one pending per member, max 5 submissions per 24 h. Returns an error message or null. */
async function gate(deps: Deps, userId: string): Promise<string | null> {
  if (await deps.db.pendingFor(userId)) return MSG.pending;
  const since = new Date(deps.now().getTime() - 24 * 60 * 60 * 1000).toISOString();
  if ((await deps.db.countSince(userId, since)) >= LIMITS.maxPerDay) return MSG.dailyCap;
  return null;
}

async function processClient(
  i: Interaction,
  x: { accm: string; type: "free" | "vip"; lineId: number; tier: Tier; att: Attachment; maxBytes: number; maxMb: number },
  deps: Deps,
): Promise<void> {
  const { db, discord } = deps;
  const userId = i.member!.user!.id;
  const reply = (content: string) => discord.editOriginal(i.token, { content, allowed_mentions: NO_MENTIONS }).catch((e) => log("edit ack failed", e));
  try {
    const blocked = await gate(deps, userId);
    if (blocked) return void (await reply(blocked));
    const line = await db.getLine(x.lineId);
    if (!line || !line.active || !line.review_channel_id) return void (await reply(MSG.lineGone));
    const member = await db.getMember(userId);
    const flags: AppFlag[] = [];
    if (await db.accmUsedByOther(x.accm, userId)) flags.push("dup_user_id");
    // Member left and rejoined: Discord roles are gone, but we still have a record. Fresh approval still required.
    if (x.tier === "unverified" && member && (member.tier !== "unverified" || member.accm_user_id || member.own_ib_line_id)) {
      flags.push("returning");
      await db.setTier(userId, "unverified", deps.now().toISOString());
    }
    const image = await downloadImage(deps, x.att.url, x.maxBytes);
    const nowIso = deps.now().toISOString();
    const row: NewApplication = {
      id: i.id,
      applicantId: userId,
      applicantName: displayName(i.member),
      type: x.type,
      accmUserId: x.accm,
      accmIbEmail: null,
      targetLineId: line.id,
      reviewerLineId: line.id,
      reviewChannelId: line.review_channel_id,
      status: "pending",
      flags,
      createdAt: nowIso,
      escalateAfterAt: new Date(deps.now().getTime() + HOURS_48).toISOString(),
    };
    await createAndPost(deps, row, image, reply);
  } catch (e) {
    if (e instanceof BadFile) return void (await reply(MSG.badFile(x.maxMb)));
    log("client submission failed", e);
    await reply(MSG.error);
  }
}

async function processIb(i: Interaction, email: string, uplineId: number, deps: Deps): Promise<void> {
  const { cfg, db, discord } = deps;
  const userId = i.member!.user!.id;
  const reply = (content: string) => discord.editOriginal(i.token, { content, allowed_mentions: NO_MENTIONS }).catch((e) => log("edit ack failed", e));
  try {
    const blocked = await gate(deps, userId);
    if (blocked) return void (await reply(blocked));
    if (await db.activeLineByUser(userId)) return void (await reply(MSG.alreadyIb));
    const upline = await db.getLine(uplineId);
    if (!upline || !upline.active || !upline.review_channel_id) return void (await reply(MSG.lineGone));
    const tier = tierFromRoles(i.member?.roles, cfg);
    const member = await db.getMember(userId);
    const flags: AppFlag[] = [];
    if (await db.ibEmailTaken(email, null)) flags.push("dup_ib_email");
    if (tier === "unverified" && member && (member.tier !== "unverified" || member.accm_user_id || member.own_ib_line_id)) flags.push("returning");
    else if (tier === "unverified" && (await db.previousIbEmail(userId))) flags.push("returning");
    if (tier !== "unverified" && member?.referring_ib_line_id && member.referring_ib_line_id !== upline.id) flags.push("upline_differs");
    const nowIso = deps.now().toISOString();
    await createAndPost(
      deps,
      {
        id: i.id,
        applicantId: userId,
        applicantName: displayName(i.member),
        type: "ib",
        accmUserId: null,
        accmIbEmail: email,
        targetLineId: upline.id,
        reviewerLineId: upline.id,
        reviewChannelId: upline.review_channel_id,
        status: "pending",
        flags,
        createdAt: nowIso,
        escalateAfterAt: new Date(deps.now().getTime() + HOURS_48).toISOString(),
      },
      null,
      reply,
    );
  } catch (e) {
    log("ib submission failed", e);
    await reply(MSG.error);
  }
}

async function createAndPost(deps: Deps, row: NewApplication, image: { bytes: Uint8Array; type: string; ext: string } | null, reply: (c: string) => Promise<unknown>) {
  const { db, discord } = deps;
  const ins = await db.insertApp(row);
  if (ins === "pending_exists") return void (await reply(MSG.pending));
  if (ins === "dup_id") return; // duplicate delivery of the same interaction: already handled
  const app = (await db.getApp(row.id))!;
  let posted: { id: string; screenshotUrl: string | null } | null = null;
  try {
    const c = await cardContext(deps, app, new LineCache(db));
    posted = await postCard(deps, row.reviewChannelId!, app, c, image);
    await db.setCard(app.id, row.reviewChannelId!, posted.id, posted.screenshotUrl);
  } catch (e) {
    // Card could not be posted: the application is not created (nothing is kept).
    if (posted) await discord.deleteOwnMessage(row.reviewChannelId!, posted.id).catch((err) => log("cleanup card failed", err));
    await db.deleteApp(app.id).catch((err) => log("cleanup row failed", err));
    throw e;
  }
  await reply(MSG.received);
}

export async function downloadImage(deps: Deps, url: string, maxBytes: number): Promise<{ bytes: Uint8Array; type: string; ext: string }> {
  const res = await cdnFetch(deps, url);
  if (!res.ok) throw new Error(`cdn ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new BadFile();
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) throw new BadFile();
  const type = sniffImageType(bytes);
  if (!type) throw new BadFile();
  return { bytes, type, ext: extFor(type) };
}
