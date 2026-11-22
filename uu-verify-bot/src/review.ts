/** Reviewer actions on a review card: Approve, Deny, Admin: View IB Email. */
import { cardContext, lineReviewerIds, LineCache } from "./cards";
import {
  deniedDm,
  denyReasonText,
  dmFallback,
  MSG,
  SPEC_FREE_APPROVED,
  SPEC_IB_APPROVED_FROM_CLIENT,
  SPEC_IB_APPROVED_NEW,
  SPEC_TRANSFER,
  SPEC_VIP_APPROVED,
} from "./copy";
import { parseFlags } from "./db";
import { type Deps, isAdmin, log } from "./deps";
import { NO_MENTIONS, denyCodesFor } from "./payloads";
import { reviewChannelOverwrites, slugify } from "./perms";
import { type Application, EPHEMERAL, type IbLine, type Interaction } from "./types";

export type ReviewerCheck = { ok: true; actorId: string; admin: boolean; app: Application; reviewer: IbLine | null } | { ok: false; message: string };

/** Who may act on a card: the current reviewer line's IB (both Coach Mike accounts for the top line), Coach, or Admin / Mod. */
export async function checkReviewer(i: Interaction, appId: string, deps: Deps): Promise<ReviewerCheck> {
  const { cfg, db } = deps;
  const actorId = i.member?.user?.id;
  if (!actorId) return { ok: false, message: MSG.guildOnly };
  const app = await db.getApp(appId);
  if (!app) return { ok: false, message: MSG.notFound };
  if (app.status !== "pending") return { ok: false, message: MSG.alreadyDecided };
  if (i.message?.id && app.review_message_id && i.message.id !== app.review_message_id) return { ok: false, message: MSG.staleCard };
  if (app.review_channel_id && i.channel_id !== app.review_channel_id) return { ok: false, message: MSG.staleCard };
  const admin = isAdmin(i, cfg);
  const reviewer = app.current_reviewer_line_id !== null ? await db.getLine(app.current_reviewer_line_id) : null;
  const coach = Boolean(i.member?.roles?.includes(cfg.coachRoleId)) || cfg.coachMikeUserIds.includes(actorId);
  const owner = reviewer ? lineReviewerIds(reviewer, cfg).includes(actorId) : false;
  if (!admin && !coach && !owner) return { ok: false, message: MSG.notReviewer };
  if (app.applicant_discord_id === actorId) return { ok: false, message: MSG.selfDecision };
  return { ok: true, actorId, admin, app, reviewer };
}

const notice = (deps: Deps, i: Interaction, content: string) =>
  deps.discord.followup(i.token, { content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS }).catch((e) => log("followup failed", e));

async function adminLog(deps: Deps, content: string) {
  await deps.discord.createMessage(deps.cfg.adminLogChannelId, { content: content.slice(0, 2000), allowed_mentions: NO_MENTIONS }).catch((e) => log("admin-log failed", e));
}

export async function notifyMember(deps: Deps, userId: string, content: string): Promise<boolean> {
  const ok = await deps.discord.dm(userId, content).catch((e) => {
    log("dm failed", e);
    return false;
  });
  if (!ok) {
    await deps.discord
      .createMessage(deps.cfg.verifyChannelId, { content: dmFallback(userId), allowed_mentions: { parse: [], users: [userId] } })
      .catch((e) => log("dm fallback failed", e));
  }
  return ok;
}

/** Delete one posted review card (404 already counts as done in deleteOwnMessage). Failures are retried by cron. */
export async function deleteTrackedCard(
  deps: Deps,
  card: { applicationId: string; channelId: string; messageId: string },
): Promise<boolean> {
  const nowIso = deps.now().toISOString();
  try {
    await deps.discord.deleteOwnMessage(card.channelId, card.messageId);
    await deps.db.markReviewCardDeleted(card.channelId, card.messageId, nowIso);
    return true;
  } catch (e) {
    log("card delete failed", e);
    await deps.db.log({ applicationId: card.applicationId, action: "card_delete_failed" }, nowIso).catch(() => undefined);
    return false;
  }
}

/** Delete every posted review card for this application — including leftovers from a 48h hop — and clear the screenshot URL. */
export async function deleteCard(deps: Deps, app: Pick<Application, "id" | "review_channel_id" | "review_message_id">): Promise<boolean> {
  const nowIso = deps.now().toISOString();
  const tracked = await deps.db.openCards(app.id);
  const list = [...tracked];
  if (
    app.review_channel_id &&
    app.review_message_id &&
    !list.some((c) => c.channel_id === app.review_channel_id && c.message_id === app.review_message_id)
  ) {
    list.push({ application_id: app.id, channel_id: app.review_channel_id, message_id: app.review_message_id });
  }
  if (list.length === 0) {
    await deps.db.markCardDeleted(app.id, nowIso);
    return true;
  }
  let all = true;
  for (const c of list) {
    if (!(await deleteTrackedCard(deps, { applicationId: app.id, channelId: c.channel_id, messageId: c.message_id }))) all = false;
  }
  if (all) await deps.db.markCardDeleted(app.id, nowIso);
  return all;
}

/** Flagged (or live) duplicate User ID / IB email: only Admin / Mod may close it. */
export async function isFlaggedDuplicate(app: Application, deps: Deps): Promise<boolean> {
  const flags = parseFlags(app.flags);
  if (flags.includes("dup_user_id") || flags.includes("dup_ib_email")) return true;
  if (app.accm_user_id && (await deps.db.accmUsedByOther(app.accm_user_id, app.applicant_discord_id))) return true;
  if (app.accm_ib_email && (await deps.db.ibEmailTaken(app.accm_ib_email, app.id))) return true;
  return false;
}

const logLine = (tag: string, app: Application, actorId: string | null, extra: string[] = []) =>
  [`[${tag}] app ${app.id}`, app.type.toUpperCase(), `<@${app.applicant_discord_id}>`, actorId ? `by <@${actorId}>` : null, ...extra].filter(Boolean).join(" · ");

async function closeMemberLeft(deps: Deps, i: Interaction, app: Application, actorId: string) {
  const nowIso = deps.now().toISOString();
  const won = await deps.db.decide(app.id, "denied", actorId, nowIso, "member_left", null);
  if (!won) return notice(deps, i, MSG.alreadyDecided);
  await deps.db.log({ applicationId: app.id, action: "member_left", actorId, targetId: app.applicant_discord_id }, nowIso);
  await adminLog(deps, logLine("CLOSED: member left", won, actorId));
  await deleteCard(deps, won);
  await notice(deps, i, MSG.memberLeft);
}

async function addRoles(deps: Deps, userId: string, have: string[], add: Array<string | null | undefined>, remove: Array<string | null | undefined>) {
  const g = deps.cfg.guildId;
  for (const r of add) if (r && !have.includes(r)) await deps.discord.addRole(g, userId, r);
  for (const r of remove) if (r && have.includes(r)) await deps.discord.removeRole(g, userId, r);
}

export async function runApprove(i: Interaction, chk: Extract<ReviewerCheck, { ok: true }>, deps: Deps): Promise<void> {
  try {
    const { app } = chk;
    const flags = parseFlags(app.flags);
    if (app.type === "ib") {
      await approveIb(i, chk, deps);
      return;
    }
    // Duplicate User ID: only an Admin / Mod may approve (override); re-checked live.
    const dupNow = await deps.db.accmUsedByOther(app.accm_user_id!, app.applicant_discord_id);
    if ((flags.includes("dup_user_id") || dupNow) && !chk.admin) return void (await notice(deps, i, MSG.needAdminDupUserId));
    await approveClient(i, chk, deps, flags.includes("dup_user_id") || dupNow);
  } catch (e) {
    log("approve failed", e);
    await notice(deps, i, MSG.error);
  }
}

async function approveClient(i: Interaction, chk: Extract<ReviewerCheck, { ok: true }>, deps: Deps, override: boolean) {
  const { cfg, db } = deps;
  const { app, actorId } = chk;
  const gm = await deps.discord.getMember(cfg.guildId, app.applicant_discord_id);
  if (!gm) return closeMemberLeft(deps, i, app, actorId);
  const nowIso = deps.now().toISOString();
  const won = await db.decide(app.id, "approved", actorId, nowIso, override ? "admin_override_duplicate" : null, app.type === "vip" ? "yes" : null);
  if (!won) return void (await notice(deps, i, MSG.alreadyDecided));
  const target = app.target_ib_line_id !== null ? await db.getLine(app.target_ib_line_id) : null;
  const hadFree = gm.roles.includes(cfg.freeRoleId);
  try {
    if (app.type === "free") await addRoles(deps, app.applicant_discord_id, gm.roles, [cfg.freeRoleId, target?.role_id], [cfg.unverifiedRoleId]);
    else await addRoles(deps, app.applicant_discord_id, gm.roles, [cfg.freeRoleId, hadFree ? null : target?.role_id, cfg.vipRoleId], [cfg.unverifiedRoleId]);
  } catch (e) {
    log("role assign failed", e);
    await db.undecide(app.id, app.escalate_after_at);
    await db.log({ applicationId: app.id, action: "role_error", actorId, targetId: app.applicant_discord_id }, nowIso);
    await adminLog(deps, logLine("ERROR: role assign failed (check bot role order)", app, actorId));
    return void (await notice(deps, i, MSG.roleFailed));
  }
  const member = await db.getMember(app.applicant_discord_id);
  if (app.type === "free") {
    await db.upsertMember(app.applicant_discord_id, nowIso, {
      display_name: app.applicant_display_name,
      accm_user_id: app.accm_user_id,
      referring_ib_line_id: app.target_ib_line_id,
      tier: "free",
      vip_above_min: null,
    });
  } else {
    await db.upsertMember(app.applicant_discord_id, nowIso, {
      display_name: app.applicant_display_name,
      accm_user_id: member?.accm_user_id ?? app.accm_user_id,
      referring_ib_line_id: member?.referring_ib_line_id ?? app.target_ib_line_id,
      tier: "vip",
      vip_above_min: "yes",
      vip_verified_at: nowIso,
    });
  }
  await db.log({ applicationId: app.id, action: "approved", actorId, targetId: app.applicant_discord_id, lineId: app.target_ib_line_id, reasonCode: override ? "admin_override_duplicate" : null }, nowIso);
  const dmOk = await notifyMember(deps, app.applicant_discord_id, app.type === "vip" ? SPEC_VIP_APPROVED : SPEC_FREE_APPROVED);
  await adminLog(
    deps,
    logLine(app.type === "vip" ? "APPROVED VIP (above minimum)" : "APPROVED FREE", app, actorId, [
      `line ${target?.display_name ?? "?"}`,
      override ? "admin override: duplicate User ID" : "",
      dmOk ? "" : "DM closed",
    ].filter(Boolean)),
  );
  await deleteCard(deps, won);
}

async function uniqueSlug(deps: Deps, name: string): Promise<string> {
  const base = slugify(name);
  if (!(await deps.db.slugTaken(base))) return base;
  for (let n = 2; n < 50; n++) {
    const s = `${base}-${n}`;
    if (!(await deps.db.slugTaken(s))) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function approveIb(i: Interaction, chk: Extract<ReviewerCheck, { ok: true }>, deps: Deps) {
  const { cfg, db, discord } = deps;
  const { app, actorId } = chk;
  // Duplicate ACCM IB email: never a second line, not even for admins (resolve manually, then Deny).
  if (parseFlags(app.flags).includes("dup_ib_email") || (await db.ibEmailTaken(app.accm_ib_email!, app.id))) return void (await notice(deps, i, MSG.dupEmailBlocked));
  if (await db.activeLineByUser(app.applicant_discord_id)) return void (await notice(deps, i, MSG.alreadyIb));
  const gm = await discord.getMember(cfg.guildId, app.applicant_discord_id);
  if (!gm) return closeMemberLeft(deps, i, app, actorId);
  const upline = app.target_ib_line_id !== null ? await db.getLine(app.target_ib_line_id) : null;
  if (!upline) return void (await notice(deps, i, MSG.lineGone));
  const nowIso = deps.now().toISOString();
  const won = await db.decide(app.id, "approved", actorId, nowIso, null, null);
  if (!won) return void (await notice(deps, i, MSG.alreadyDecided));

  const fromClient = gm.roles.includes(cfg.freeRoleId) || gm.roles.includes(cfg.vipRoleId);
  const name = app.applicant_display_name ?? "IB";
  const slug = await uniqueSlug(deps, name);
  let roleId: string | null = null;
  let channelId: string | null = null;
  let lineId: number | null = null;
  const rollback = async (msg: string, e?: unknown) => {
    log("ib approve failed", e);
    if (channelId) await discord.deleteChannel(channelId).catch((err) => log("rollback channel failed", err));
    if (roleId) await discord.deleteRole(cfg.guildId, roleId).catch((err) => log("rollback role failed", err));
    await db.undecide(app.id, app.escalate_after_at);
    await db.log({ applicationId: app.id, action: "role_error", actorId, targetId: app.applicant_discord_id }, nowIso).catch(() => undefined);
    await notice(deps, i, msg);
  };
  try {
    roleId = (await discord.createRole(cfg.guildId, `Line: ${name}`.slice(0, 100))).id;
    channelId = (
      await discord.createChannel(cfg.guildId, {
        name: `review-${slug}`.slice(0, 100),
        type: 0,
        topic: `Private review channel ng line ni ${name}. Hindi ito nakikita ng ibang IB.`,
        parent_id: cfg.reviewCategoryId,
        permission_overwrites: reviewChannelOverwrites({
          guildId: cfg.guildId,
          botUserId: cfg.appId,
          ibUserIds: [app.applicant_discord_id],
          coachRoleId: cfg.coachRoleId,
          adminRoleIds: cfg.adminRoleIds,
        }),
      })
    ).id;
  } catch (e) {
    return rollback(MSG.roleFailed, e);
  }
  lineId = await db.insertLine({ slug, displayName: name, userId: app.applicant_discord_id, email: app.accm_ib_email!, uplineId: upline.id, roleId, channelId, createdAt: nowIso });
  if (lineId === null) return rollback(MSG.dupEmailBlocked);
  try {
    await addRoles(
      deps,
      app.applicant_discord_id,
      gm.roles,
      fromClient ? [cfg.subIbRoleId] : [cfg.subIbRoleId, cfg.freeRoleId, upline.role_id],
      [cfg.unverifiedRoleId],
    );
  } catch (e) {
    await db.deleteLine(lineId).catch((err) => log("rollback line failed", err));
    return rollback(MSG.roleFailed, e);
  }
  const member = await db.getMember(app.applicant_discord_id);
  await db.upsertMember(app.applicant_discord_id, nowIso, {
    display_name: name,
    is_sub_ib: 1,
    own_ib_line_id: lineId,
    // Client to sub-IB (spec §6): keep FREE/VIP and the existing client-IB link unchanged.
    ...(fromClient ? {} : { tier: "free" as const, referring_ib_line_id: member?.referring_ib_line_id ?? upline.id }),
  });
  await db.log({ applicationId: app.id, action: "approved", actorId, targetId: app.applicant_discord_id, lineId: upline.id }, nowIso);
  await db.log({ applicationId: app.id, action: "line_created", actorId, targetId: app.applicant_discord_id, lineId, detail: `slug ${slug}` }, nowIso);
  const dmOk = await notifyMember(deps, app.applicant_discord_id, fromClient ? SPEC_IB_APPROVED_FROM_CLIENT : SPEC_IB_APPROVED_NEW);
  await adminLog(
    deps,
    logLine("APPROVED IB · new line", app, actorId, [`line ${name} (#review-${slug}, <#${channelId}>)`, `upline ${upline.display_name}`, fromClient ? "from client" : "new IB", dmOk ? "" : "DM closed"].filter(Boolean)),
  );
  await deleteCard(deps, won);
}

export async function runDeny(i: Interaction, chk: Extract<ReviewerCheck, { ok: true }>, code: string, note: string, deps: Deps): Promise<void> {
  const { db } = deps;
  const { app, actorId } = chk;
  try {
    // Design 22 Nov: a flagged duplicate stays pending until an Admin / Mod reviews. Line IB / Coach cannot deny or send the Denied DM.
    const dupCode = code === "duplicate" || code === "duplicate_email";
    if (!chk.admin && (dupCode || (await isFlaggedDuplicate(app, deps)))) return void (await notice(deps, i, MSG.needAdminDupUserId));
    const status = code === "not_tree" ? "transferred" : "denied";
    const reason = code === "other" ? `other: ${note}`.slice(0, 400) : code;
    const nowIso = deps.now().toISOString();
    const won = await db.decide(app.id, status, actorId, nowIso, reason, app.type === "vip" && code === "below_min" ? "no" : null);
    if (!won) return void (await notice(deps, i, MSG.alreadyDecided));
    await db.log({ applicationId: app.id, action: status, actorId, targetId: app.applicant_discord_id, lineId: app.target_ib_line_id, reasonCode: code }, nowIso);
    const dm = code === "not_tree" ? SPEC_TRANSFER : deniedDm(denyReasonText(code, app.type, note));
    const dmOk = await notifyMember(deps, app.applicant_discord_id, dm);
    await adminLog(deps, logLine(status === "transferred" ? "TRANSFER ROUTE (reviewer)" : "DENIED", app, actorId, [`reason ${code}`, dmOk ? "" : "DM closed"].filter(Boolean)));
    await deleteCard(deps, won);
  } catch (e) {
    log("deny failed", e);
    await notice(deps, i, MSG.error);
  }
}

export function validDenyCode(code: string | undefined, app: Application): code is string {
  return Boolean(code && denyCodesFor(app.type).includes(code));
}

/** Admin-only: show the private ACCM IB email ephemerally (and the previous one on record for a returning member). */
export async function viewEmail(i: Interaction, appId: string, deps: Deps): Promise<unknown> {
  const { cfg, db } = deps;
  if (!isAdmin(i, cfg)) return { content: MSG.notAdmin };
  const app = await db.getApp(appId);
  if (!app) return { content: MSG.notFound };
  if (!app.accm_ib_email) return { content: MSG.noEmail };
  const prev = parseFlags(app.flags).includes("returning") ? await db.previousIbEmail(app.applicant_discord_id) : null;
  await db.log({ applicationId: app.id, action: "email_viewed", actorId: i.member!.user!.id, targetId: app.applicant_discord_id }, deps.now().toISOString());
  const lines = [`ACCM IB email (admin-only, huwag i-share): ${app.accm_ib_email}`];
  if (prev && prev !== app.accm_ib_email) lines.push(`Dating IB email on record: ${prev}`);
  return { content: lines.join("\n") };
}

export { LineCache, cardContext };
