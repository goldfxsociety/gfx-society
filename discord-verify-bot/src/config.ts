import type { Config, Env } from "./types";

const SNOWFLAKE = /^[0-9]{17,20}$/;

export class ConfigError extends Error {}

/** Reads and validates config. Never logs secret values. */
export function loadConfig(env: Env): Config {
  const ids: Array<[keyof Env, string | undefined]> = [
    ["DISCORD_APP_ID", env.DISCORD_APP_ID],
    ["GUILD_ID", env.GUILD_ID],
    ["VIP_ROLE_ID", env.VIP_ROLE_ID],
    ["VERIFY_CHANNEL_ID", env.VERIFY_CHANNEL_ID],
    ["APPROVALS_CHANNEL_ID", env.APPROVALS_CHANNEL_ID],
    ["LOG_CHANNEL_ID", env.LOG_CHANNEL_ID],
  ];
  const bad = ids.filter(([, v]) => !v || !SNOWFLAKE.test(v)).map(([k]) => k);
  const adminRoleIds = (env.ADMIN_ROLE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminRoleIds.some((r) => !SNOWFLAKE.test(r))) bad.push("ADMIN_ROLE_IDS");
  for (const k of ["DISCORD_PUBLIC_KEY", "DISCORD_BOT_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
    if (!env[k]) bad.push(k);
  }
  if (env.DISCORD_PUBLIC_KEY && !/^[0-9a-fA-F]{64}$/.test(env.DISCORD_PUBLIC_KEY)) bad.push("DISCORD_PUBLIC_KEY");
  if (!env.SUPABASE_URL || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.SUPABASE_URL)) bad.push("SUPABASE_URL");
  if (bad.length) throw new ConfigError(`Missing or invalid config: ${[...new Set(bad)].join(", ")}`);
  const max = Number(env.MAX_UPLOAD_BYTES || 8 * 1024 * 1024);
  return {
    appId: env.DISCORD_APP_ID,
    guildId: env.GUILD_ID,
    vipRoleId: env.VIP_ROLE_ID,
    adminRoleIds,
    verifyChannelId: env.VERIFY_CHANNEL_ID,
    approvalsChannelId: env.APPROVALS_CHANNEL_ID,
    logChannelId: env.LOG_CHANNEL_ID,
    supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    maxUploadBytes: Number.isFinite(max) && max > 0 ? max : 8 * 1024 * 1024,
    publicKey: env.DISCORD_PUBLIC_KEY,
    botToken: env.DISCORD_BOT_TOKEN,
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
