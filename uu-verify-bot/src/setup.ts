/**
 * Server setup planner (pure + an injectable executor), used by scripts/setup-server.ts and unit tests.
 * Creates the spec roles/channels from scratch, matches anything that already exists by name or by id from
 * a previous setup.out.json (idempotent), leaves Discord's default categories/channels and the bot's managed
 * role in place, and locks the defaults by denying View Channel to @everyone and Unverified (bot keep-View).
 * Hidden categories always include a bot allow (View + Manage Channels) so the bot can still see them after
 * @everyone is denied View. If a sibling category already exists but a hidden one is not visible and has no
 * saved id, planning fails fast instead of creating a duplicate.
 */
import { SPEC_RISK_LINE } from "./copy";
import { bits, type Overwrite, Perm } from "./discord";
import { BOT, READ, reviewChannelOverwrites, VIEW, WRITE } from "./perms";

export const ROLE = {
  unverified: "Unverified",
  free: "FREE",
  vip: "VIP",
  subIb: "Sub-IB",
  coach: "Coach",
  admin: "Admin / Mod",
  lineCoachMike: "Line: Coach Mike",
  lineGfx: "Line: GFX",
} as const;
export const BASE_ROLES: string[] = Object.values(ROLE);
/** Roles the bot assigns or removes at runtime (must sit BELOW the bot's managed role). */
export const BOT_MANAGED_ROLES: string[] = [ROLE.unverified, ROLE.free, ROLE.vip, ROLE.subIb, ROLE.coach, ROLE.admin, ROLE.lineCoachMike, ROLE.lineGfx];

export const ChannelType = { TEXT: 0, VOICE: 2, CATEGORY: 4 } as const;

export type Target = { kind: "everyone" } | { kind: "role"; name: string } | { kind: "user"; id: string } | { kind: "bot" };
export interface OverwriteSpec {
  target: Target;
  allow: string;
  deny: string;
}
export interface ChannelSpec {
  key: string;
  name: string;
  topic?: string;
  access: OverwriteSpec[];
}
export interface CategorySpec {
  name: string;
  /** Category-level overwrites (children carry their own explicit overwrites too). */
  access: OverwriteSpec[];
  channels: ChannelSpec[];
}

const everyone = (allow: string, deny: string): OverwriteSpec => ({ target: { kind: "everyone" }, allow, deny });
const role = (name: string, allow: string, deny = "0"): OverwriteSpec => ({ target: { kind: "role", name }, allow, deny });
const bot = (): OverwriteSpec => ({ target: { kind: "bot" }, allow: BOT, deny: "0" });
const SEND = bits(Perm.SEND_MESSAGES);
const VERIFY_ALLOW = bits(Perm.VIEW_CHANNEL, Perm.READ_MESSAGE_HISTORY, Perm.USE_APPLICATION_COMMANDS);
const hidden = [everyone("0", VIEW), role(ROLE.unverified, "0", VIEW)];
/** Hidden spaces also grant the bot View + Manage Channels (and the rest of BOT) so it can still see and manage them. */
const hiddenBot = [...hidden, bot()];

export interface People {
  coachMikeUserIds: string[];
  benUserId: string;
}

export function layout(p: People): CategorySpec[] {
  const reviewAccess = (ibUserIds: string[]): OverwriteSpec[] => [
    ...hidden,
    ...ibUserIds.map((id): OverwriteSpec => ({ target: { kind: "user", id }, allow: WRITE, deny: "0" })),
    role(ROLE.coach, WRITE),
    role(ROLE.admin, WRITE),
    bot(),
  ];
  return [
    {
      name: "START",
      access: [everyone(READ, "0")],
      channels: [
        // Unverified sees ONLY these two. @everyone acts as Unverified (an HTTP-only bot cannot auto-assign on join).
        { key: "start_here", name: "start-here", topic: "Welcome. Next step: #verify.", access: [everyone(READ, SEND), role(ROLE.unverified, READ, SEND), bot()] },
        {
          key: "verify",
          name: "verify",
          topic: "Client ako o IB ako.",
          access: [everyone(VERIFY_ALLOW, SEND), role(ROLE.unverified, VERIFY_ALLOW, SEND), role(ROLE.free, VERIFY_ALLOW, SEND), role(ROLE.vip, VERIFY_ALLOW, SEND), bot()],
        },
      ],
    },
    {
      name: "COMMUNITY",
      access: hiddenBot,
      channels: [
        { key: "education", name: "education", access: [...hidden, role(ROLE.free, READ), role(ROLE.vip, READ), role(ROLE.coach, WRITE), role(ROLE.admin, WRITE), bot()] },
        { key: "community", name: "community", access: [...hidden, role(ROLE.free, WRITE), role(ROLE.vip, WRITE), role(ROLE.coach, WRITE), role(ROLE.admin, WRITE), bot()] },
        { key: "market_talk", name: "market-talk", access: [...hidden, role(ROLE.free, WRITE), role(ROLE.vip, WRITE), role(ROLE.coach, WRITE), role(ROLE.admin, WRITE), bot()] },
      ],
    },
    {
      name: "VIP",
      access: hiddenBot,
      channels: [
        { key: "pro_indicator", name: "pro-indicator", topic: SPEC_RISK_LINE, access: [...hidden, role(ROLE.vip, READ), role(ROLE.coach, WRITE), role(ROLE.admin, WRITE), bot()] },
        { key: "ai_signals", name: "ai-signals", topic: SPEC_RISK_LINE, access: [...hidden, role(ROLE.vip, READ), role(ROLE.coach, WRITE), role(ROLE.admin, WRITE), bot()] },
      ],
    },
    {
      name: "IB LEADERS",
      access: hiddenBot,
      channels: [{ key: "sub_ib_leaders", name: "sub-ib-leaders", access: [...hidden, role(ROLE.subIb, WRITE), role(ROLE.coach, WRITE), role(ROLE.admin, WRITE), bot()] }],
    },
    {
      name: "ADMIN",
      access: hiddenBot,
      channels: [{ key: "admin_log", name: "admin-log", topic: "Decisions, escalations, new lines, resets, errors.", access: [...hidden, role(ROLE.admin, READ), bot()] }],
    },
    {
      name: "REVIEWS",
      access: hiddenBot,
      channels: [
        { key: "review_coach_mike", name: "review-coach-mike", topic: "Private review channel: Coach Mike line.", access: reviewAccess(p.coachMikeUserIds) },
        { key: "review_gfx", name: "review-gfx", topic: "Private review channel: GFX line.", access: reviewAccess([p.benUserId]) },
      ],
    },
  ];
}

export interface GuildRole {
  id: string;
  name: string;
  position: number;
  managed?: boolean;
  tags?: { bot_id?: string };
}
export interface GuildChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}
export interface GuildState {
  roles: GuildRole[];
  channels: GuildChannel[];
}

export interface SetupIds extends People {
  guildId: string;
  botUserId: string;
  /** Managed role where tags.bot_id == botUserId, if known. Bot overwrites prefer this role; otherwise the bot user. */
  botRoleId?: string;
}

/** Ids from a previous setup.out.json, used when the bot cannot see already-created hidden categories. */
export interface PriorSetupIds {
  categoryIds?: Record<string, string>;
  channelIds?: Record<string, string>;
}

export interface Plan {
  roles: Array<{ name: string; action: "create" | "exists"; id?: string }>;
  categories: Array<{ name: string; action: "create" | "exists"; id?: string; access: OverwriteSpec[] }>;
  channels: Array<{ key: string; name: string; category: string; topic?: string; action: "create" | "exists"; id?: string; access: OverwriteSpec[] }>;
  /** Pre-existing channels/categories we do not own (e.g. Discord defaults): left in place, View denied. */
  lockExisting: Array<{ id: string; name: string; type: number; access: OverwriteSpec[] }>;
  memberRoles: Array<{ userId: string; role: string }>;
  warnings: string[];
  /** Fatal: --apply must not run (e.g. a hidden category is missing from the listing and has no saved id). */
  blockers: string[];
}

/** Current known state of the Universe Unlimited guild (22 Nov 2026, per Jarvis). Used by offline --dry-run. */
export function knownGuildState(guildId: string, botUserId: string): GuildState {
  return {
    roles: [
      { id: guildId, name: "@everyone", position: 0 },
      { id: "BOT_MANAGED_ROLE", name: "UU Bot", position: 1, managed: true, tags: { bot_id: botUserId } },
    ],
    channels: [
      { id: "DEFAULT_TEXT_CATEGORY", name: "Text Channels", type: ChannelType.CATEGORY },
      { id: "DEFAULT_VOICE_CATEGORY", name: "Voice Channels", type: ChannelType.CATEGORY },
      { id: "DEFAULT_GENERAL_TEXT", name: "general", type: ChannelType.TEXT, parent_id: "DEFAULT_TEXT_CATEGORY" },
      { id: "DEFAULT_GENERAL_VOICE", name: "General", type: ChannelType.VOICE, parent_id: "DEFAULT_VOICE_CATEGORY" },
    ],
  };
}

export function botRole(roles: GuildRole[], botUserId: string): GuildRole | undefined {
  return roles.find((r) => r.managed && r.tags?.bot_id === botUserId) ?? roles.find((r) => r.managed && r.name === "UU Bot");
}

/** The bot can only assign roles strictly below its own highest role. Never try to move the managed role ourselves. */
export function roleOrderWarnings(roles: GuildRole[], botUserId: string): string[] {
  const b = botRole(roles, botUserId);
  if (!b) return ["WARNING: the bot's managed role ('UU Bot') was not found. Is the bot in the server?"];
  const blocked = roles.filter((r) => BOT_MANAGED_ROLES.includes(r.name) && r.position >= b.position).map((r) => r.name);
  if (blocked.length === 0) return [];
  return [
    `WARNING: '${b.name}' sits below role(s) the bot must assign: ${blocked.join(", ")}. ` +
      `An admin must drag '${b.name}' ABOVE them in Server Settings → Roles (the bot does not reorder its own managed role).`,
  ];
}

export function planSetup(state: GuildState, ids: SetupIds, known?: PriorSetupIds): Plan {
  const roleByName = new Map(state.roles.map((r) => [r.name, r]));
  const lay = layout(ids);
  const ourCategoryNames = new Set(lay.map((c) => c.name));
  const ourChannelNames = new Set(lay.flatMap((c) => c.channels.map((ch) => ch.name)));
  const catByName = new Map(state.channels.filter((c) => c.type === ChannelType.CATEGORY).map((c) => [c.name, c]));
  const chanByName = new Map(state.channels.filter((c) => c.type !== ChannelType.CATEGORY).map((c) => [c.name, c]));
  const priorCat = known?.categoryIds ?? {};
  const priorChan = known?.channelIds ?? {};

  const plan: Plan = { roles: [], categories: [], channels: [], lockExisting: [], memberRoles: [], warnings: [], blockers: [] };
  for (const name of BASE_ROLES) {
    const r = roleByName.get(name);
    plan.roles.push(r ? { name, action: "exists", id: r.id } : { name, action: "create" });
  }
  for (const cat of lay) {
    const c = catByName.get(cat.name);
    const priorId = priorCat[cat.name];
    if (c) {
      plan.categories.push({ name: cat.name, action: "exists", id: c.id, access: cat.access });
    } else if (priorId) {
      plan.categories.push({ name: cat.name, action: "exists", id: priorId, access: cat.access });
      plan.warnings.push(
        `Category ${cat.name} (${priorId}) is not in the guild listing (the bot may not be able to see it). Will reuse this id from setup.out.json and re-apply overwrites instead of creating a duplicate.`,
      );
    } else {
      plan.categories.push({ name: cat.name, action: "create", access: cat.access });
    }
    for (const ch of cat.channels) {
      const e = chanByName.get(ch.name);
      const priorChId = priorChan[ch.key];
      if (e) {
        plan.channels.push({ key: ch.key, name: ch.name, category: cat.name, topic: ch.topic, action: "exists", id: e.id, access: ch.access });
      } else if (priorChId) {
        plan.channels.push({ key: ch.key, name: ch.name, category: cat.name, topic: ch.topic, action: "exists", id: priorChId, access: ch.access });
        plan.warnings.push(
          `Channel #${ch.name} (${priorChId}) is not in the guild listing. Will reuse this id from setup.out.json and re-apply overwrites instead of creating a duplicate.`,
        );
      } else {
        plan.channels.push({ key: ch.key, name: ch.name, category: cat.name, topic: ch.topic, action: "create", access: ch.access });
      }
    }
  }
  const existsCats = plan.categories.filter((c) => c.action === "exists");
  const createCats = plan.categories.filter((c) => c.action === "create");
  if (existsCats.length > 0 && createCats.length > 0) {
    plan.blockers.push(
      `Refusing to create ${createCats.length === 1 ? "category" : "categories"} ${createCats.map((c) => c.name).join(", ")}: ` +
        `other setup ${existsCats.length === 1 ? "category already exists" : "categories already exist"} (${existsCats.map((c) => c.name).join(", ")}) ` +
        `but the missing one(s) are not visible to the bot and have no id in setup.out.json. ` +
        `They may already exist and be hidden (View denied for @everyone without a bot allow). ` +
        `Grant the UU Bot role View and Manage Channels on ${createCats.map((c) => c.name).join(", ")}, or add their ids to setup.out.json, then rerun. ` +
        `Creating them now would duplicate them.`,
    );
  }
  // Leave defaults (and anything else not ours) in place, but lock them: no View for @everyone / Unverified.
  // The bot keeps View so it can still see the locked defaults.
  for (const c of state.channels) {
    const ours = c.type === ChannelType.CATEGORY ? ourCategoryNames.has(c.name) : ourChannelNames.has(c.name);
    if (!ours) plan.lockExisting.push({ id: c.id, name: c.name, type: c.type, access: hiddenBot });
  }
  for (const id of ids.coachMikeUserIds) plan.memberRoles.push({ userId: id, role: ROLE.coach });
  plan.memberRoles.push({ userId: ids.benUserId, role: ROLE.admin });
  plan.warnings.push(...roleOrderWarnings(state.roles, ids.botUserId));
  return plan;
}

export function resolveOverwrites(access: OverwriteSpec[], roleIds: Record<string, string>, ids: SetupIds): Overwrite[] {
  return access.map((o) => {
    const t = o.target;
    if (t.kind === "everyone") return { id: ids.guildId, type: 0, allow: o.allow, deny: o.deny };
    if (t.kind === "bot") {
      if (ids.botRoleId) return { id: ids.botRoleId, type: 0, allow: o.allow, deny: o.deny };
      return { id: ids.botUserId, type: 1, allow: o.allow, deny: o.deny };
    }
    if (t.kind === "user") return { id: t.id, type: 1, allow: o.allow, deny: o.deny };
    const id = roleIds[t.name];
    if (!id) throw new Error(`unknown role ${t.name}`);
    return { id, type: 0, allow: o.allow, deny: o.deny };
  });
}

/** Admin-readable permission matrix (dry-run output and tests). */
export function permissionMatrix(plan: Plan): Array<{ channel: string; viewers: string[]; writers: string[] }> {
  const label = (t: Target) => (t.kind === "everyone" ? "@everyone" : t.kind === "bot" ? "bot" : t.kind === "user" ? `user:${t.id}` : t.name);
  const has = (v: string, p: bigint) => (BigInt(v) & p) === p;
  return plan.channels.map((c) => ({
    channel: `#${c.name}`,
    viewers: c.access.filter((o) => has(o.allow, Perm.VIEW_CHANNEL)).map((o) => label(o.target)),
    writers: c.access.filter((o) => has(o.allow, Perm.SEND_MESSAGES)).map((o) => label(o.target)),
  }));
}

export interface SetupApi {
  createRole(name: string): Promise<{ id: string }>;
  createChannel(body: { name: string; type: number; topic?: string; parent_id?: string | null; permission_overwrites: Overwrite[] }): Promise<{ id: string }>;
  putOverwrite(channelId: string, o: Overwrite): Promise<void>;
  addMemberRole(userId: string, roleId: string): Promise<boolean>;
  listRoles(): Promise<GuildRole[]>;
}

export interface SetupResult {
  roleIds: Record<string, string>;
  channelIds: Record<string, string>;
  categoryIds: Record<string, string>;
  warnings: string[];
}

/** Execute a plan. Idempotent: existing roles/channels are reused (their overwrites are re-applied additively). */
export async function executePlan(
  plan: Plan,
  ids: SetupIds,
  api: SetupApi,
  out: (line: string) => void = () => undefined,
  onProgress?: (partial: SetupResult) => void,
): Promise<SetupResult> {
  if (plan.blockers.length) throw new Error(plan.blockers.join("\n"));
  const roleIds: Record<string, string> = {};
  const categoryIds: Record<string, string> = {};
  const channelIds: Record<string, string> = {};
  const warnings: string[] = [];
  const emit = () => onProgress?.({ roleIds: { ...roleIds }, channelIds: { ...channelIds }, categoryIds: { ...categoryIds }, warnings: [...warnings] });
  for (const r of plan.roles) {
    roleIds[r.name] = r.id ?? (await api.createRole(r.name)).id;
    out(`${r.action === "create" ? "created" : "exists "} role ${r.name}`);
    emit();
  }
  for (const c of plan.categories) {
    const ow = resolveOverwrites(c.access, roleIds, ids);
    if (c.id) {
      for (const o of ow) await api.putOverwrite(c.id, o);
      categoryIds[c.name] = c.id;
    } else categoryIds[c.name] = (await api.createChannel({ name: c.name, type: ChannelType.CATEGORY, permission_overwrites: ow })).id;
    out(`${c.action === "create" ? "created" : "exists "} category ${c.name}`);
    emit();
  }
  for (const ch of plan.channels) {
    const ow = resolveOverwrites(ch.access, roleIds, ids);
    if (ch.id) {
      for (const o of ow) await api.putOverwrite(ch.id, o);
      channelIds[ch.key] = ch.id;
    } else {
      channelIds[ch.key] = (await api.createChannel({ name: ch.name, type: ChannelType.TEXT, topic: ch.topic, parent_id: categoryIds[ch.category], permission_overwrites: ow })).id;
    }
    out(`${ch.action === "create" ? "created" : "exists "} #${ch.name}`);
    emit();
  }
  for (const l of plan.lockExisting) {
    for (const o of resolveOverwrites(l.access, roleIds, ids)) await api.putOverwrite(l.id, o);
    out(`locked existing ${l.type === ChannelType.CATEGORY ? "category" : "channel"} ${l.name} (View denied for @everyone, Unverified; not deleted)`);
  }
  // Role-order warnings are recomputed after the roles exist (see below).
  for (const m of plan.memberRoles) {
    const ok = await api.addMemberRole(m.userId, roleIds[m.role]!);
    if (!ok) warnings.push(`WARNING: user ${m.userId} is not in the server yet; give them '${m.role}' after they join.`);
    else out(`gave ${m.role} to ${m.userId}`);
  }
  warnings.push(...roleOrderWarnings(await api.listRoles(), ids.botUserId));
  return { roleIds, channelIds, categoryIds, warnings };
}

const sqlStr = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);

/** D1 seed for the two launch lines ONLY (Coach Mike top, GFX under Coach Mike). */
export function seedSql(r: SetupResult, p: People & { coachMikeIbEmail: string | null }): string {
  const primary = p.coachMikeUserIds[0]!;
  return `-- Generated by scripts/setup-server.ts. Two launch lines only. Idempotent.
INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id, role_id, review_channel_id, is_seed, active)
VALUES ('coach-mike', 'Coach Mike', ${sqlStr(primary)}, ${sqlStr(p.coachMikeIbEmail?.toLowerCase() ?? null)}, NULL, ${sqlStr(r.roleIds[ROLE.lineCoachMike]!)}, ${sqlStr(r.channelIds.review_coach_mike!)}, 1, 1)
ON CONFLICT (slug) DO UPDATE SET discord_user_id = excluded.discord_user_id, accm_ib_email = excluded.accm_ib_email,
  role_id = excluded.role_id, review_channel_id = excluded.review_channel_id, is_seed = 1, active = 1;
INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id, role_id, review_channel_id, is_seed, active)
VALUES ('gfx', 'GFX', ${sqlStr(p.benUserId)}, 'goldfx.society@gmail.com', (SELECT id FROM ib_lines WHERE slug = 'coach-mike'), ${sqlStr(r.roleIds[ROLE.lineGfx]!)}, ${sqlStr(r.channelIds.review_gfx!)}, 1, 1)
ON CONFLICT (slug) DO UPDATE SET discord_user_id = excluded.discord_user_id, accm_ib_email = excluded.accm_ib_email,
  upline_line_id = excluded.upline_line_id, role_id = excluded.role_id, review_channel_id = excluded.review_channel_id, is_seed = 1, active = 1;
`;
}

/** wrangler.toml [vars] values to paste after setup. */
export function varsSnippet(r: SetupResult): string {
  return [
    `ADMIN_ROLE_IDS = "${r.roleIds[ROLE.admin]}"`,
    `COACH_ROLE_ID = "${r.roleIds[ROLE.coach]}"`,
    `UNVERIFIED_ROLE_ID = "${r.roleIds[ROLE.unverified]}"`,
    `FREE_ROLE_ID = "${r.roleIds[ROLE.free]}"`,
    `VIP_ROLE_ID = "${r.roleIds[ROLE.vip]}"`,
    `SUB_IB_ROLE_ID = "${r.roleIds[ROLE.subIb]}"`,
    `VERIFY_CHANNEL_ID = "${r.channelIds.verify}"`,
    `ADMIN_LOG_CHANNEL_ID = "${r.channelIds.admin_log}"`,
    `REVIEW_CATEGORY_ID = "${r.categoryIds.REVIEWS}"`,
  ].join("\n");
}

export { reviewChannelOverwrites };
