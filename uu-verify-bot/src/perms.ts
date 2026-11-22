import { bits, type Overwrite, Perm } from "./discord";

export const READ = bits(Perm.VIEW_CHANNEL, Perm.READ_MESSAGE_HISTORY);
export const WRITE = bits(Perm.VIEW_CHANNEL, Perm.READ_MESSAGE_HISTORY, Perm.SEND_MESSAGES, Perm.ADD_REACTIONS, Perm.EMBED_LINKS, Perm.ATTACH_FILES);
export const BOT = bits(Perm.VIEW_CHANNEL, Perm.MANAGE_CHANNELS, Perm.READ_MESSAGE_HISTORY, Perm.SEND_MESSAGES, Perm.EMBED_LINKS, Perm.ATTACH_FILES);
export const VIEW = bits(Perm.VIEW_CHANNEL);

/**
 * Private #review-{line}: that IB (all reviewer accounts for the line), Coach, Admin / Mod, and the bot.
 * Uplines do not get standing access: an escalated case is re-posted in the upline's own review channel.
 */
export function reviewChannelOverwrites(x: { guildId: string; botUserId: string; ibUserIds: string[]; coachRoleId: string; adminRoleIds: string[] }): Overwrite[] {
  return [
    { id: x.guildId, type: 0, allow: "0", deny: VIEW },
    ...[...new Set(x.ibUserIds)].map((id): Overwrite => ({ id, type: 1, allow: WRITE, deny: "0" })),
    { id: x.coachRoleId, type: 0, allow: WRITE, deny: "0" },
    ...x.adminRoleIds.map((id): Overwrite => ({ id, type: 0, allow: WRITE, deny: "0" })),
    { id: x.botUserId, type: 1, allow: BOT, deny: "0" },
  ];
}

/** "Juan Dela Cruz" -> "juan-dela-cruz" (ascii a-z0-9-, max 60). */
export function slugify(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "line";
}
