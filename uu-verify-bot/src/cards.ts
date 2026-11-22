/** Review cards: what reviewers see in #review-{line}. NEVER contains the ACCM IB email or any amount. */
import type { Db } from "./db";
import { parseFlags } from "./db";
import type { Deps } from "./deps";
import { NO_MENTIONS, reviewButtons } from "./payloads";
import type { Application, Config, IbLine } from "./types";

export class LineCache {
  private m = new Map<number, IbLine | null>();
  constructor(private db: Db) {}
  async get(id: number | null): Promise<IbLine | null> {
    if (id === null) return null;
    if (!this.m.has(id)) this.m.set(id, await this.db.getLine(id));
    return this.m.get(id) ?? null;
  }
}

/** Discord users who review for a line. The ONE Coach Mike line (top of tree) has all of Coach Mike's accounts. */
export function lineReviewerIds(line: IbLine, cfg: Config): string[] {
  const ids = [line.discord_user_id];
  if (line.upline_line_id === null) ids.push(...cfg.coachMikeUserIds);
  return [...new Set(ids)];
}

const TITLES = { free: "Client application — FREE", vip: "Client application — VIP", ib: "IB registration (Sub-IB)" } as const;

export interface CardContext {
  target: IbLine | null;
  reviewer: IbLine | null;
  /** Returning member note inputs. */
  previousAccm: string | null;
  previousIbEmailSame: boolean | null;
  /** Client-to-sub-IB: name of their current referring IB, when it differs from the nominated upline. */
  currentReferrerName: string | null;
}

export function cardText(app: Application, c: CardContext, cfg: Config): string {
  const flags = parseFlags(app.flags);
  const unix = (iso: string | null) => (iso ? Math.floor(Date.parse(iso) / 1000) : null);
  const lines: string[] = [`**${TITLES[app.type]}** · app \`${app.id}\``];
  lines.push(`Applicant: <@${app.applicant_discord_id}> (${app.applicant_display_name ?? "member"})`);
  if (app.type !== "ib") lines.push(`ACCM User ID: \`${app.accm_user_id}\``);
  lines.push(`${app.type === "ib" ? "Nominated upline IB" : "Referring IB"}: ${c.target?.display_name ?? "—"}`);
  if (c.reviewer) {
    const pings = lineReviewerIds(c.reviewer, cfg)
      .map((id) => `<@${id}>`)
      .join(" ");
    lines.push(`Reviewer: ${c.reviewer.display_name} ${pings}${app.escalation_hops > 0 ? ` (escalated ×${app.escalation_hops}, 48h rule)` : ""}`);
  }
  const created = unix(app.created_at);
  const esc = unix(app.escalate_after_at);
  lines.push(`Submitted: <t:${created}:f>${esc ? ` · auto-escalates <t:${esc}:R>` : ""}`);
  if (flags.includes("dup_user_id")) lines.push("⚠️ Duplicate ACCM User ID: nagamit na ng ibang Discord account. Admin / Mod review muna bago i-approve.");
  if (flags.includes("dup_ib_email")) lines.push("⚠️ Duplicate ACCM IB email: may line o pending request na. Hindi gagawa ng pangalawang line. Admin review.");
  if (flags.includes("returning")) {
    if (app.type === "ib") {
      lines.push(
        `↩️ Returning member: may dating IB email on record${c.previousIbEmailSame === null ? "" : c.previousIbEmailSame ? " (pareho sa submitted)" : " (iba sa submitted)"}. Admin: View IB Email. Kailangan pa rin ng bagong approval.`,
      );
    } else {
      const same = c.previousAccm ? (c.previousAccm === app.accm_user_id ? " (pareho sa submitted)" : " (iba sa submitted)") : "";
      lines.push(`↩️ Returning member: may dating record${c.previousAccm ? `. Dating ACCM User ID: \`${c.previousAccm}\`${same}` : ""}. Kailangan pa rin ng bagong approval.`);
    }
  }
  if (flags.includes("upline_differs") && c.currentReferrerName) lines.push(`Note: current referring IB on record ay ${c.currentReferrerName}.`);
  if (flags.includes("screenshot_missing")) lines.push("Screenshot: hindi na-recover sa escalation. Humingi ng bago kung kailangan.");
  if (app.type === "free") lines.push("Check sa sarili mong IB portal: registered at verified under you ba ang User ID na ito?");
  if (app.type === "vip") lines.push("Confirm lang kung $50 o more ang deposit o balance (above minimum). Huwag i-record ang amount.");
  if (app.type === "ib") lines.push("Confirm na sub-IB mo ito. Admin-only ang ACCM IB email (button sa baba).");
  return lines.join("\n").slice(0, 2000);
}

export async function cardContext(deps: Deps, app: Application, cache: LineCache): Promise<CardContext> {
  const target = await cache.get(app.target_ib_line_id);
  const reviewer = await cache.get(app.current_reviewer_line_id);
  const flags = parseFlags(app.flags);
  let previousAccm: string | null = null;
  let previousIbEmailSame: boolean | null = null;
  let currentReferrerName: string | null = null;
  if (flags.includes("returning") || flags.includes("upline_differs")) {
    const m = await deps.db.getMember(app.applicant_discord_id);
    previousAccm = m?.accm_user_id ?? null;
    if (flags.includes("upline_differs") && m?.referring_ib_line_id) currentReferrerName = (await cache.get(m.referring_ib_line_id))?.display_name ?? null;
    if (app.type === "ib" && flags.includes("returning")) {
      const prev = await deps.db.previousIbEmail(app.applicant_discord_id);
      previousIbEmailSame = prev ? prev === app.accm_ib_email : null;
    }
  }
  return { target, reviewer, previousAccm, previousIbEmailSame, currentReferrerName };
}

export function cardPayload(app: Application, c: CardContext, cfg: Config, file?: { ext: string }) {
  const filename = file ? `uu-${app.id}.${file.ext}` : null;
  return {
    filename,
    payload: {
      content: cardText(app, c, cfg),
      // Ping only the reviewer(s); never @everyone / roles / the applicant.
      allowed_mentions: { ...NO_MENTIONS, users: c.reviewer ? lineReviewerIds(c.reviewer, cfg) : [] },
      ...(filename ? { attachments: [{ id: 0, filename, description: "Proof screenshot (deleted after decision)" }] } : {}),
      components: reviewButtons(app.id, app.type),
    },
  };
}

/** Post a card (with the screenshot bytes re-uploaded under a neutral filename, if any). */
export async function postCard(deps: Deps, channelId: string, app: Application, c: CardContext, image: { bytes: Uint8Array; type: string; ext: string } | null) {
  const card = cardPayload(app, c, deps.cfg, image ? { ext: image.ext } : undefined);
  if (image && card.filename) {
    const msg = await deps.discord.createMessageWithFile(channelId, card.payload, new Blob([image.bytes], { type: image.type }), card.filename);
    return { id: msg.id, screenshotUrl: msg.attachments?.[0]?.url ?? null };
  }
  const msg = await deps.discord.createMessage(channelId, card.payload);
  return { id: msg.id, screenshotUrl: null };
}

export function extFor(type: string): string {
  return type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
}
