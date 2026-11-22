/** Request handling for the Worker (kept out of index.ts: a Worker entry module may only export handlers). */
import { ConfigError, loadConfig } from "./config";
import { Db } from "./db";
import type { Deps } from "./deps";
import { Discord } from "./discord";
import { handleInteraction } from "./handlers";
import { type Env, type Interaction, InteractionType } from "./types";
import { verifyDiscordRequest } from "./verify";

/** Workers throws "Illegal invocation" if fetch is called as a method of another object. */
const boundFetch: typeof fetch = (input, init) => fetch(input, init);

/** Interactions are small JSON (attachments arrive as metadata, not bytes). */
export const MAX_BODY_BYTES = 256 * 1024;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function makeDeps(env: Env, fetchImpl: typeof fetch = boundFetch, now: () => Date = () => new Date()): Deps {
  const cfg = loadConfig(env);
  return { cfg, discord: new Discord(cfg.botToken, cfg.appId, fetchImpl), db: new Db(env.DB), fetchImpl, now };
}

export async function handleRequest(
  req: Request,
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
  fetchImpl: typeof fetch = boundFetch,
  now?: () => Date,
): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname === "/") return new Response("UU verify bot: ok", { status: 200 });
  if (req.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/interactions")) return new Response("Not found", { status: 404 });

  let deps: Deps;
  try {
    deps = makeDeps(env, fetchImpl, now);
  } catch (e) {
    console.error(`[uu-bot] ${e instanceof ConfigError ? e.message : "config error"}`);
    return new Response("Server misconfigured", { status: 500 });
  }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  const ok = await verifyDiscordRequest(deps.cfg.publicKey, req.headers.get("X-Signature-Ed25519"), req.headers.get("X-Signature-Timestamp"), raw);
  if (!ok) return new Response("Bad request signature", { status: 401 });

  let interaction: Interaction;
  try {
    interaction = JSON.parse(raw) as Interaction;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (interaction.type === InteractionType.PING) return json({ type: 1 });
  if (interaction.application_id !== deps.cfg.appId) return new Response("Wrong application", { status: 400 });

  return json(await handleInteraction(interaction, deps, ctx));
}
