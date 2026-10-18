import { partners } from "@/config/partners";

/** Flip to false to send every "Next step" CTA to /broker while /accm isn't live (fallback). */
export const ACCM_PAGE_LIVE = true;
export const NEXT_STEP_HREF = ACCM_PAGE_LIVE ? "/accm" : "/broker";

/** Discord invite. Null = hide every Discord button. Only /accm and /broker render it. */
export const DISCORD_INVITE_URL: string | null =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/AZb5Gk9xNP";

/** ACCM link for /accm or /broker: same IB link as partners.ts, with the matching utm_medium. */
export const accmHref = (medium: "accm_page" | "broker_page") =>
  (partners.find((p) => p.id === "accm")?.liveUrl ?? "").replace(/utm_medium=[^&]+/, `utm_medium=${medium}`);
