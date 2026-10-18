import type { Config, Interaction } from "./types";

export const PERMISSION = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_ROLES: 1n << 28n,
} as const;

export function hasPermission(bitfield: string | undefined, flag: bigint): boolean {
  if (!bitfield || !/^[0-9]+$/.test(bitfield)) return false;
  return (BigInt(bitfield) & flag) === flag;
}

export type AdminCheck = { ok: true; adminId: string } | { ok: false; reason: "not_guild" | "wrong_channel" | "not_admin" };

/**
 * Checked on EVERY Approve/Reject click and reject-modal submit
 * (default_member_permissions only applies to commands, not buttons).
 * Rules: must be in our guild AND in #vip-approvals AND
 *  - Administrator, or
 *  - if ADMIN_ROLE_IDS is set: one of those roles; otherwise: Manage Roles.
 */
export function checkAdmin(i: Interaction, cfg: Config): AdminCheck {
  if (i.guild_id !== cfg.guildId || !i.member?.user?.id) return { ok: false, reason: "not_guild" };
  if (i.channel_id !== cfg.approvalsChannelId) return { ok: false, reason: "wrong_channel" };
  const m = i.member;
  const adminId = m.user!.id;
  if (hasPermission(m.permissions, PERMISSION.ADMINISTRATOR)) return { ok: true, adminId };
  if (cfg.adminRoleIds.length > 0) {
    return m.roles.some((r) => cfg.adminRoleIds.includes(r)) ? { ok: true, adminId } : { ok: false, reason: "not_admin" };
  }
  return hasPermission(m.permissions, PERMISSION.MANAGE_ROLES) ? { ok: true, adminId } : { ok: false, reason: "not_admin" };
}
