/**
 * GFX Discord VIP verification bot — Cloudflare Worker, Discord HTTP interactions endpoint.
 * No Gateway, no intents, no self-bot/user-account automation.
 * Only handlers may be exported from this entry module.
 */
import { handleRequest, makeDeps } from "./app";
import { expireStale } from "./handlers";
import type { Env } from "./types";

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(req, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const n = await expireStale(makeDeps(env));
          if (n) console.log(`[vip-bot] expired ${n} stale request(s)`);
        } catch (e) {
          console.error(`[vip-bot] cron failed${e instanceof Error ? `: ${e.message}` : ""}`);
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
