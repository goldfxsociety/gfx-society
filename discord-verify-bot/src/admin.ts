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
 * Checked on EVERY Approve / Need more info / Reject click and on every admin modal submit
 * (default_member_permissions only applies to commands, not buttons).
 * Rules: must be in our guild AND in #vip-approvals AND have one of ADMIN_ROLE_IDS (required config).
 * Manage Roles or Administrator ALONE is NOT enough (decided default).
 */
export function checkAdmin(i: Interaction, cfg: Config): AdminCheck {
  if (i.guild_id !== cfg.guildId || !i.member?.user?.id) return { ok: false, reason: "not_guild" };
  if (i.channel_id !== cfg.approvalsChannelId) return { ok: false, reason: "wrong_channel" };
  if (cfg.adminRoleIds.length === 0) return { ok: false, reason: "not_admin" }; // fail closed
  const m = i.member;
  return m.roles.some((r) => cfg.adminRoleIds.includes(r)) ? { ok: true, adminId: m.user!.id } : { ok: false, reason: "not_admin" };
}
