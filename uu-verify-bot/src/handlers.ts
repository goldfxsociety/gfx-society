/**
 * Interaction router. Returns the initial interaction response (within 3 s). Quick D1 reads happen inline
 * (modals must be the first response); slow work (CDN download, card posting, role changes, DMs) goes to ctx.waitUntil.
 */
import { MSG, SPEC_TRANSFER, TRANSFER_OPTION_VALUE, denyReasonText } from "./copy";
import { type Deps, log } from "./deps";
import { openClient, openIb, submitClient, submitIb, transferNow } from "./flows";
import { autocompleteChoices, CID, deferEphemeral, deferUpdate, denyModal, ephemeral, firstValue, modalValue, NO_MENTIONS, parseReviewId } from "./payloads";
import { checkReviewer, runApprove, runDeny, validDenyCode, viewEmail } from "./review";
import { type Interaction, InteractionType, type WaitCtx } from "./types";

export type { Deps } from "./deps";

export async function handleInteraction(i: Interaction, deps: Deps, ctx: WaitCtx): Promise<unknown> {
  const { cfg } = deps;
  if (i.type === InteractionType.PING) return { type: 1 };
  if (i.guild_id !== cfg.guildId || !i.member?.user?.id) {
    if (i.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) return autocompleteChoices([], "", false);
    return ephemeral(MSG.guildOnly);
  }
  try {
    switch (i.type) {
      case InteractionType.APPLICATION_COMMAND:
        return await onCommand(i, deps, ctx);
      case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE:
        return await onAutocomplete(i, deps);
      case InteractionType.MESSAGE_COMPONENT:
        return await onComponent(i, deps, ctx);
      case InteractionType.MODAL_SUBMIT:
        return await onModal(i, deps, ctx);
    }
  } catch (e) {
    log("interaction failed", e);
  }
  return ephemeral(MSG.error);
}

async function onCommand(i: Interaction, deps: Deps, ctx: WaitCtx): Promise<unknown> {
  const name = i.data?.name;
  if (name === "uu-status") {
    ctx.waitUntil(runStatus(i, deps));
    return deferEphemeral();
  }
  if (name === "verify-client" || name === "verify-ib") {
    const raw = String(i.data?.options?.[0]?.value ?? "");
    if (name === "verify-client" && raw === TRANSFER_OPTION_VALUE) {
      if (i.channel_id !== deps.cfg.verifyChannelId) return ephemeral(MSG.wrongChannel(deps.cfg.verifyChannelId));
      return transferNow(i, deps, ctx, null, "free");
    }
    if (!/^\d{1,10}$/.test(raw)) return ephemeral(MSG.pickLine);
    return name === "verify-client" ? openClient(i, deps, Number(raw)) : openIb(i, deps, Number(raw));
  }
  return ephemeral(MSG.error);
}

async function onAutocomplete(i: Interaction, deps: Deps): Promise<unknown> {
  const focused = i.data?.options?.find((o) => o.focused);
  const lines = await deps.db.activeLines();
  return autocompleteChoices(lines, String(focused?.value ?? ""), i.data?.name === "verify-client");
}

async function onComponent(i: Interaction, deps: Deps, ctx: WaitCtx): Promise<unknown> {
  const cid = i.data?.custom_id;
  if (cid === CID.client) return openClient(i, deps);
  if (cid === CID.ib) return openIb(i, deps);
  const r = parseReviewId(cid);
  if (!r || r.action === "denyModal") return ephemeral(MSG.error);
  if (r.action === "email") {
    const res = (await viewEmail(i, r.appId, deps)) as { content: string };
    return ephemeral(res.content);
  }
  const chk = await checkReviewer(i, r.appId, deps);
  if (!chk.ok) return ephemeral(chk.message);
  if (r.action === "deny") return denyModal(chk.app.id, chk.app.type);
  ctx.waitUntil(runApprove(i, chk, deps));
  return deferUpdate();
}

async function onModal(i: Interaction, deps: Deps, ctx: WaitCtx): Promise<unknown> {
  const cid = i.data?.custom_id ?? "";
  if (cid === CID.clientSubmit || cid.startsWith(`${CID.clientSubmit}:`)) return submitClient(i, deps, ctx);
  if (cid === CID.ibSubmit || cid.startsWith(`${CID.ibSubmit}:`)) return submitIb(i, deps, ctx);
  const r = parseReviewId(cid);
  if (r?.action !== "denyModal") return ephemeral(MSG.error);
  const chk = await checkReviewer(i, r.appId, deps);
  if (!chk.ok) return ephemeral(chk.message);
  const code = firstValue(modalValue(i.data?.components, CID.fReason));
  if (!validDenyCode(code, chk.app)) return ephemeral(MSG.error);
  const note = String(firstValue(modalValue(i.data?.components, CID.fNote)) ?? "").trim();
  if (code === "other" && note.length < 3) return ephemeral(MSG.otherNeedsNote);
  ctx.waitUntil(runDeny(i, chk, code, note, deps));
  return deferUpdate();
}

async function runStatus(i: Interaction, deps: Deps): Promise<void> {
  try {
    const app = await deps.db.latestFor(i.member!.user!.id);
    let content: string = MSG.statusNone;
    if (app?.status === "pending") content = MSG.statusPending;
    if (app?.status === "approved") content = MSG.statusApproved;
    if (app?.status === "transferred") content = SPEC_TRANSFER;
    if (app?.status === "denied") {
      const [code, ...rest] = (app.decision_reason ?? "other").split(": ");
      const reason = code === "member_left" ? "" : denyReasonText(code ?? "other", app.type, rest.join(": "));
      content = `Hindi na-approve ang huling application mo.${reason ? `\n\nDahilan: ${reason}` : ""}\n\nPwede kang mag-submit ulit kapag ready na.`;
    }
    await deps.discord.editOriginal(i.token, { content, allowed_mentions: NO_MENTIONS });
  } catch (e) {
    log("status failed", e);
    await deps.discord.editOriginal(i.token, { content: MSG.error }).catch(() => undefined);
  }
}
