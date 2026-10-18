/**
 * Posts the "Verify deposit" panel (button + privacy notice) in #verify. Pin it afterwards.
 * Run LATER by the founder. Reads env only; never prints the token.
 *
 *   export DISCORD_VERIFY_CHANNEL_ID=...
 *   read -s DISCORD_BOT_TOKEN && export DISCORD_BOT_TOKEN
 *   npm run post-verify-panel
 *
 * Requires the bot to have View Channel + Send Messages in #verify (channel override).
 */
import { verifyPanel } from "../src/payloads";

const { DISCORD_VERIFY_CHANNEL_ID, DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_VERIFY_CHANNEL_ID || !/^[0-9]{17,20}$/.test(DISCORD_VERIFY_CHANNEL_ID) || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_VERIFY_CHANNEL_ID and DISCORD_BOT_TOKEN in your shell env first.");
  process.exit(1);
}
const res = await fetch(`https://discord.com/api/v10/channels/${DISCORD_VERIFY_CHANNEL_ID}/messages`, {
  method: "POST",
  headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(verifyPanel()),
});
if (!res.ok) {
  console.error(`Failed: HTTP ${res.status}`, await res.text());
  process.exit(1);
}
const msg = (await res.json()) as { id: string };
console.log(`Posted panel message ${msg.id}. Pin it in #verify.`);
