import type { Attachment } from "./types";

export const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export type AttachmentCheck = { ok: true; contentType: string; ext: string } | { ok: false; reason: "missing" | "too_many" | "type" | "size" };

/** Metadata validation (Discord's `file_types: ["image"]` filter only checks extensions). */
export function checkAttachmentMeta(atts: Attachment[], maxBytes: number): AttachmentCheck {
  if (atts.length === 0) return { ok: false, reason: "missing" };
  if (atts.length > 1) return { ok: false, reason: "too_many" };
  const a = atts[0]!;
  const ct = (a.content_type ?? "").split(";")[0]!.trim().toLowerCase();
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(ct)) return { ok: false, reason: "type" };
  if (!Number.isFinite(a.size) || a.size <= 0 || a.size > maxBytes) return { ok: false, reason: "size" };
  return { ok: true, contentType: ct, ext: EXT[ct]! };
}

/** Sniff the real bytes so a renamed non-image can't get through. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}

/** Only fetch from Discord's CDN (prevents SSRF via a forged URL; signature check already makes this unlikely). */
export function isDiscordCdnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "cdn.discordapp.com" || u.hostname === "media.discordapp.net");
  } catch {
    return false;
  }
}

/** Collect resolved attachments referenced by a modal File Upload (custom_id) — Label (18) → File Upload (19). */
export function attachmentsFromModal(
  components: Array<{ type: number; custom_id?: string; values?: string[]; component?: unknown; components?: unknown[] }> | undefined,
  resolved: Record<string, Attachment> | undefined,
  customId: string,
): Attachment[] {
  const ids: string[] = [];
  const walk = (c: unknown): void => {
    if (!c || typeof c !== "object") return;
    const o = c as { type?: number; custom_id?: string; values?: string[]; component?: unknown; components?: unknown[] };
    if (o.type === 19 && o.custom_id === customId && Array.isArray(o.values)) ids.push(...o.values);
    if (o.component) walk(o.component);
    if (Array.isArray(o.components)) o.components.forEach(walk);
  };
  (components ?? []).forEach(walk);
  return ids.map((id) => resolved?.[id]).filter((a): a is Attachment => Boolean(a));
}
