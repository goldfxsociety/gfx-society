/**
 * Universe Unlimited onboarding bot — Cloudflare Worker, Discord HTTP interactions endpoint + Cron Trigger.
 * No Gateway, no intents, no user-account automation. Only handlers may be exported from this entry module.
 */
import { handleRequest, makeDeps } from "./app";
import { runCron } from "./cron";
import type { Env } from "./types";

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(req, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const s = await runCron(makeDeps(env));
          console.log(`[uu-bot] cron: ${JSON.stringify(s)}`);
        } catch (e) {
          console.error(`[uu-bot] cron failed${e instanceof Error ? `: ${e.message}` : ""}`);
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
