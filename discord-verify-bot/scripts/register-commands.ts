/**
 * Registers the guild slash commands (/verify-deposit, /verify-status) for the PDE x GFX Society server.
 * Run LATER by the founder from their own machine, after the app exists. Reads env only; never prints the token.
 *
 *   export DISCORD_APP_ID=...  DISCORD_GUILD_ID=...
 *   read -s DISCORD_BOT_TOKEN && export DISCORD_BOT_TOKEN   # paste token, nothing is echoed
 *   npm run register-commands
 *
 * Uses "Bulk Overwrite Guild Application Commands" (PUT), so re-running is safe and idempotent.
 */
import { commandDefinitions } from "../src/payloads";

const { DISCORD_APP_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN } = process.env;
const snowflake = /^[0-9]{17,20}$/;

if (!DISCORD_APP_ID || !snowflake.test(DISCORD_APP_ID) || !DISCORD_GUILD_ID || !snowflake.test(DISCORD_GUILD_ID) || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_APP_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN in your shell env first (see comment at top).");
  process.exit(1);
}

const res = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(commandDefinitions()),
});
if (!res.ok) {
  console.error(`Failed: HTTP ${res.status}`, await res.text());
  process.exit(1);
}
const cmds = (await res.json()) as Array<{ name: string; id: string }>;
console.log(`Registered ${cmds.length} command(s): ${cmds.map((c) => `/${c.name}`).join(", ")}`);
