/**
 * Registers the guild slash commands (/uu-status, /verify-client, /verify-ib) for the Universe Unlimited server.
 * Run LATER (after merge, token set via secure card). Reads env only; never prints the token.
 *   export DISCORD_APP_ID=1573941065491152956 DISCORD_GUILD_ID=1572501982944559124
 *   npm run register-commands        # DISCORD_BOT_TOKEN must already be in the env
 * Uses Bulk Overwrite (PUT): re-running is safe and idempotent.
 */
import { commandDefinitions } from "../src/payloads";

const { DISCORD_APP_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN } = process.env;
const snowflake = /^[0-9]{17,20}$/;
if (!DISCORD_APP_ID || !snowflake.test(DISCORD_APP_ID) || !DISCORD_GUILD_ID || !snowflake.test(DISCORD_GUILD_ID) || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_APP_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN in your shell env first.");
  process.exit(1);
}
const res = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(commandDefinitions()),
});
if (!res.ok) {
  console.error(`Failed: HTTP ${res.status}`);
  process.exit(1);
}
const cmds = (await res.json()) as Array<{ name: string }>;
console.log(`Registered ${cmds.length} command(s): ${cmds.map((c) => `/${c.name}`).join(", ")}`);
