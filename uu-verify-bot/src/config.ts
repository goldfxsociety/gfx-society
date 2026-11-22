import type { Config, Env } from "./types";

export const SNOWFLAKE = /^[0-9]{17,20}$/;

export class ConfigError extends Error {}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Reads and validates config. Never logs secret values (only variable NAMES on error). */
export function loadConfig(env: Env): Config {
  const single: Array<keyof Env> = [
    "DISCORD_APP_ID",
    "GUILD_ID",
    "COACH_ROLE_ID",
    "UNVERIFIED_ROLE_ID",
    "FREE_ROLE_ID",
    "VIP_ROLE_ID",
    "SUB_IB_ROLE_ID",
    "VERIFY_CHANNEL_ID",
    "ADMIN_LOG_CHANNEL_ID",
  ];
  const bad: string[] = single.filter((k) => typeof env[k] !== "string" || !SNOWFLAKE.test(env[k] as string));
  const adminRoleIds = list(env.ADMIN_ROLE_IDS);
  if (adminRoleIds.length === 0 || adminRoleIds.some((r) => !SNOWFLAKE.test(r))) bad.push("ADMIN_ROLE_IDS");
  const coachMikeUserIds = list(env.COACH_MIKE_DISCORD_USER_IDS);
  if (coachMikeUserIds.length === 0 || coachMikeUserIds.some((r) => !SNOWFLAKE.test(r))) bad.push("COACH_MIKE_DISCORD_USER_IDS");
  const cat = (env.REVIEW_CATEGORY_ID ?? "").trim();
  if (cat && !SNOWFLAKE.test(cat)) bad.push("REVIEW_CATEGORY_ID");
  if (!env.DISCORD_BOT_TOKEN) bad.push("DISCORD_BOT_TOKEN");
  if (!env.DISCORD_PUBLIC_KEY || !/^[0-9a-fA-F]{64}$/.test(env.DISCORD_PUBLIC_KEY)) bad.push("DISCORD_PUBLIC_KEY");
  if (!env.DB) bad.push("DB");
  if (bad.length) throw new ConfigError(`Missing or invalid config: ${[...new Set(bad)].join(", ")}`);
  const max = Number(env.MAX_UPLOAD_BYTES || 8 * 1024 * 1024);
  return {
    appId: env.DISCORD_APP_ID,
    guildId: env.GUILD_ID,
    adminRoleIds,
    coachRoleId: env.COACH_ROLE_ID,
    unverifiedRoleId: env.UNVERIFIED_ROLE_ID,
    freeRoleId: env.FREE_ROLE_ID,
    vipRoleId: env.VIP_ROLE_ID,
    subIbRoleId: env.SUB_IB_ROLE_ID,
    verifyChannelId: env.VERIFY_CHANNEL_ID,
    adminLogChannelId: env.ADMIN_LOG_CHANNEL_ID,
    reviewCategoryId: cat || null,
    coachMikeUserIds,
    maxUploadBytes: Number.isFinite(max) && max > 0 ? max : 8 * 1024 * 1024,
    publicKey: env.DISCORD_PUBLIC_KEY,
    botToken: env.DISCORD_BOT_TOKEN,
  };
}
