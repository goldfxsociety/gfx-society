/**
 * Registers the guild slash commands (/uu-status, /verify-client, /verify-ib) for the Universe Unlimited server.
 * Run LATER (after merge, token set via secure card). Never prints the token.
 *   npm run register-commands
 * DISCORD_BOT_TOKEN must already be in the env. DISCORD_APP_ID and the guild id default to wrangler.toml [vars]
 * (DISCORD_APP_ID, GUILD_ID). Env DISCORD_APP_ID, DISCORD_GUILD_ID, or GUILD_ID override those defaults.
 * Uses Bulk Overwrite (PUT): re-running is safe and idempotent.
 */
import { readFileSync } from "node:fs";
import { commandDefinitions } from "../src/payloads";

const snowflake = /^[0-9]{17,20}$/;

/** Public string values from wrangler.toml [vars] only. Never used for secrets. */
function wranglerVars(path = new URL("../wrangler.toml", import.meta.url)): Record<string, string> {
  const text = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  let inVars = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim();
    if (heading.startsWith("[")) {
      inVars = heading === "[vars]";
      continue;
    }
    if (!inVars) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

const vars = wranglerVars();
const env = process.env;
const appId = env.DISCORD_APP_ID ?? vars.DISCORD_APP_ID;
const guildId = env.DISCORD_GUILD_ID ?? env.GUILD_ID ?? vars.GUILD_ID;
const token = env.DISCORD_BOT_TOKEN;
if (!appId || !snowflake.test(appId) || !guildId || !snowflake.test(guildId) || !token) {
  console.error(
    "Set DISCORD_BOT_TOKEN in your shell env (via the secure card; it is never printed). " +
      "DISCORD_APP_ID and the guild id default to wrangler.toml [vars] (DISCORD_APP_ID, GUILD_ID), " +
      "or set DISCORD_APP_ID and DISCORD_GUILD_ID / GUILD_ID in the env.",
  );
  process.exit(1);
}
const res = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commandDefinitions()),
});
if (!res.ok) {
  console.error(`Failed: HTTP ${res.status}`);
  process.exit(1);
}
const cmds = (await res.json()) as Array<{ name: string }>;
console.log(`Registered ${cmds.length} command(s): ${cmds.map((c) => `/${c.name}`).join(", ")}`);
