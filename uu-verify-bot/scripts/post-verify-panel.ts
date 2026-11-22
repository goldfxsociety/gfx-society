/**
 * Posts the #verify panel (Client ako / IB ako buttons + privacy notice). Optionally the #start-here welcome.
 * Public post: needs Ben's per-post OK, so it refuses to run without --confirm-ben-ok. Never prints the token.
 *   export DISCORD_VERIFY_CHANNEL_ID=...  [DISCORD_START_HERE_CHANNEL_ID=...]
 *   npm run post-verify-panel -- --confirm-ben-ok
 */
import { startHerePanel, verifyPanel } from "../src/payloads";

const { DISCORD_VERIFY_CHANNEL_ID, DISCORD_START_HERE_CHANNEL_ID, DISCORD_BOT_TOKEN } = process.env;
const snowflake = /^[0-9]{17,20}$/;
if (!process.argv.includes("--confirm-ben-ok")) {
  console.error("Public post: pass --confirm-ben-ok only after Ben approved this post.");
  process.exit(1);
}
if (!DISCORD_VERIFY_CHANNEL_ID || !snowflake.test(DISCORD_VERIFY_CHANNEL_ID) || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_VERIFY_CHANNEL_ID and DISCORD_BOT_TOKEN in your shell env first.");
  process.exit(1);
}
async function post(channelId: string, body: unknown) {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}
if (DISCORD_START_HERE_CHANNEL_ID && snowflake.test(DISCORD_START_HERE_CHANNEL_ID)) console.log(`Posted #start-here ${await post(DISCORD_START_HERE_CHANNEL_ID, startHerePanel())}`);
console.log(`Posted #verify panel ${await post(DISCORD_VERIFY_CHANNEL_ID, verifyPanel())}. Pin it.`);
