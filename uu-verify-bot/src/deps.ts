import type { Db } from "./db";
import type { Discord } from "./discord";
import type { Config, GuildMember, Interaction, Tier } from "./types";

export interface Deps {
  cfg: Config;
  discord: Discord;
  db: Db;
  /** fetch used for downloading screenshots from Discord's CDN. */
  fetchImpl: typeof fetch;
  now: () => Date;
}

export const HOURS_48 = 48 * 60 * 60 * 1000;
export const LIMITS = { maxPerDay: 5 } as const;

export const log = (msg: string, e?: unknown) => console.error(`[uu-bot] ${msg}${e instanceof Error ? `: ${e.message}` : ""}`);

export function displayName(m: GuildMember | undefined): string {
  const n = (m?.nick || m?.user?.global_name || m?.user?.username || m?.user?.id || "member").trim();
  return n.slice(0, 100) || "member";
}

export function tierFromRoles(roles: string[] | undefined, cfg: Config): Tier {
  if (roles?.includes(cfg.vipRoleId)) return "vip";
  if (roles?.includes(cfg.freeRoleId)) return "free";
  return "unverified";
}

export const isAdmin = (i: Interaction, cfg: Config) => Boolean(i.member?.roles?.some((r) => cfg.adminRoleIds.includes(r)));

/** Download a screenshot from Discord's CDN (metered in cron mode). */
export async function cdnFetch(deps: Deps, url: string): Promise<Response> {
  deps.discord.meter?.spend(1);
  return deps.fetchImpl(url);
}
