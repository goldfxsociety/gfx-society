/**
 * Universe Unlimited server setup. Creates the spec roles and channels with locked permissions, keeps Discord's
 * default categories/channels and the bot's managed role ('UU Bot') in place but denies View on the defaults,
 * gives Coach to both Coach Mike accounts and Admin / Mod to Ben, then writes:
 *   setup.out.json     role/channel ids (git-ignored)
 *   seed.generated.sql D1 seed for the two launch lines (git-ignored)
 *
 * Modes
 *   (default) --dry-run   OFFLINE: plans against the known guild state; no network, no token needed.
 *   --dry-run --online    GET-only diff against the live guild (needs DISCORD_BOT_TOKEN). No writes.
 *   --apply               Creates/updates roles, channels, overwrites and member roles. Jarvis runs this only
 *                         after QA PASS + merge, with the token set via secure card.
 *   --post-panels         With --apply: also posts the #start-here welcome and the #verify panel.
 *                         Public posts need Ben's per-post OK, so this also requires --confirm-ben-ok.
 *
 * Env: DISCORD_BOT_TOKEN (never printed), GUILD_ID, DISCORD_APP_ID, COACH_MIKE_DISCORD_USER_IDS, BEN_DISCORD_USER_ID,
 *      COACH_MIKE_IB_EMAIL (optional). Defaults for the public ids come from wrangler.toml.
 */
import { writeFileSync } from "node:fs";
import { Discord, DiscordError } from "../src/discord";
import { startHerePanel, verifyPanel } from "../src/payloads";
import {
  executePlan,
  type GuildChannel,
  type GuildRole,
  knownGuildState,
  permissionMatrix,
  planSetup,
  seedSql,
  type SetupApi,
  type SetupIds,
  varsSnippet,
} from "../src/setup";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const online = args.has("--online");
const postPanels = args.has("--post-panels");
const snowflake = /^[0-9]{17,20}$/;
const env = process.env;

const ids: SetupIds = {
  guildId: env.GUILD_ID ?? "1572501982944559124",
  botUserId: env.DISCORD_APP_ID ?? "1573941065491152956",
  coachMikeUserIds: (env.COACH_MIKE_DISCORD_USER_IDS ?? "1317701669768925188,1417055027121619004").split(",").map((s) => s.trim()).filter(Boolean),
  benUserId: env.BEN_DISCORD_USER_ID ?? "502826848812531712",
};
const coachMikeIbEmail = env.COACH_MIKE_IB_EMAIL?.trim() || null;

const bad = [
  !snowflake.test(ids.guildId) && "GUILD_ID",
  !snowflake.test(ids.botUserId) && "DISCORD_APP_ID",
  (ids.coachMikeUserIds.length === 0 || ids.coachMikeUserIds.some((x) => !snowflake.test(x))) && "COACH_MIKE_DISCORD_USER_IDS",
  !snowflake.test(ids.benUserId) && "BEN_DISCORD_USER_ID",
].filter(Boolean);
if (bad.length) {
  console.error(`Missing or invalid: ${bad.join(", ")}`);
  process.exit(1);
}
if (postPanels && !(apply && args.has("--confirm-ben-ok"))) {
  console.error("--post-panels needs --apply and --confirm-ben-ok (public posts need Ben's per-post OK).");
  process.exit(1);
}

async function main() {
  let state = knownGuildState(ids.guildId, ids.botUserId);
  let discord: Discord | null = null;
  if (apply || online) {
    if (!env.DISCORD_BOT_TOKEN) {
      console.error("DISCORD_BOT_TOKEN is not set (enter it via the secure card; it is never printed).");
      process.exit(1);
    }
    discord = new Discord(env.DISCORD_BOT_TOKEN, ids.botUserId);
    const [roles, channels] = await Promise.all([
      discord.request<GuildRole[]>("GET", `/guilds/${ids.guildId}/roles`),
      discord.request<GuildChannel[]>("GET", `/guilds/${ids.guildId}/channels`),
    ]);
    state = { roles, channels };
  }
  const plan = planSetup(state, ids);
  console.log(`Mode: ${apply ? "APPLY" : online ? "DRY-RUN (online, read-only)" : "DRY-RUN (offline, known guild state)"}`);
  console.log("\nRoles:");
  for (const r of plan.roles) console.log(`  ${r.action === "create" ? "+ create" : "= exists"}  ${r.name}`);
  console.log("\nCategories / channels:");
  for (const c of plan.categories) {
    console.log(`  ${c.action === "create" ? "+" : "="} ${c.name}`);
    for (const ch of plan.channels.filter((x) => x.category === c.name)) console.log(`      ${ch.action === "create" ? "+" : "="} #${ch.name}${ch.topic ? `  (topic: ${ch.topic})` : ""}`);
  }
  console.log("\nExisting channels left in place, View denied for @everyone + Unverified:");
  for (const l of plan.lockExisting) console.log(`  🔒 ${l.name} (type ${l.type})`);
  console.log("\nPermission matrix (who can view / write):");
  for (const m of permissionMatrix(plan)) console.log(`  ${m.channel.padEnd(20)} view: ${m.viewers.join(", ")}\n  ${"".padEnd(20)} write: ${m.writers.join(", ") || "(read-only)"}`);
  console.log("\nMember roles:");
  for (const m of plan.memberRoles) console.log(`  ${m.role} → ${m.userId}`);
  for (const w of plan.warnings) console.log(`\n${w}`);
  if (!apply) {
    console.log("\nDry run only. Nothing was changed.");
    return;
  }

  const d = discord!;
  const api: SetupApi = {
    createRole: (name) => d.createRole(ids.guildId, name),
    createChannel: (body) => d.createChannel(ids.guildId, body),
    putOverwrite: async (channelId, o) => {
      await d.request("PUT", `/channels/${channelId}/permissions/${o.id}`, { json: { type: o.type, allow: o.allow, deny: o.deny } });
    },
    addMemberRole: async (userId, roleId) => {
      try {
        await d.addRole(ids.guildId, userId, roleId);
        return true;
      } catch (e) {
        if (e instanceof DiscordError && e.status === 404) return false;
        throw e;
      }
    },
    listRoles: () => d.request<GuildRole[]>("GET", `/guilds/${ids.guildId}/roles`),
  };
  const res = await executePlan(plan, ids, api, (l) => console.log(`  ${l}`));
  writeFileSync("setup.out.json", JSON.stringify(res, null, 2));
  writeFileSync("seed.generated.sql", seedSql(res, { ...ids, coachMikeIbEmail }));
  console.log("\nWrote setup.out.json and seed.generated.sql (both git-ignored).");
  console.log("\nPaste into wrangler.toml [vars]:\n" + varsSnippet(res));
  for (const w of res.warnings) console.log(`\n${w}`);
  if (postPanels) {
    const s = await d.createMessage(res.channelIds.start_here!, startHerePanel());
    const v = await d.createMessage(res.channelIds.verify!, verifyPanel());
    console.log(`\nPosted #start-here (${s.id}) and #verify (${v.id}) panels. Pin them.`);
  }
}

main().catch((e) => {
  console.error(`Setup failed: ${e instanceof Error ? e.message : "error"}`);
  process.exit(1);
});
