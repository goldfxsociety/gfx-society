import { describe, expect, it } from "vitest";
import { checkAttachmentMeta, isDiscordCdnUrl, sniffImageType } from "../src/attachments";
import * as copy from "../src/copy";
import { approvalCard, commandDefinitions, decisionButtons, parseDecisionId, rejectModal, uploadModal, verifyPanel } from "../src/payloads";
import { PNG } from "./helpers";

describe("payload builders", () => {
  it("upload modal respects Discord limits (title ≤45, label ≤45, description ≤100, 1 image)", () => {
    const m = uploadModal();
    expect(m.type).toBe(9);
    expect(m.data.title.length).toBeLessThanOrEqual(45);
    const label = m.data.components[1] as { label: string; description: string; component: { type: number; max_values: number; file_types: string[] } };
    expect(label.label.length).toBeLessThanOrEqual(45);
    expect(label.description.length).toBeLessThanOrEqual(100);
    expect(label.component).toMatchObject({ type: 19, max_values: 1, file_types: ["image"] });
    expect(m.data.components.length).toBeLessThanOrEqual(5);
  });

  it("reject modal has the 4 reason presets and an optional note", () => {
    const m = rejectModal("800000000000000001");
    expect(m.data.title.length).toBeLessThanOrEqual(45);
    const sel = m.data.components[0]!.component as { options: Array<{ value: string }> };
    expect(sel.options.map((o) => o.value)).toEqual(["unclear", "wrong_screen", "cant_confirm", "other"]);
    for (const c of m.data.components) {
      expect(c.label.length).toBeLessThanOrEqual(45);
      if ("description" in c && c.description) expect(c.description.length).toBeLessThanOrEqual(100);
    }
  });

  it("approval card: no pings, neutral filename, custom_ids ≤100 and parseable", () => {
    const rid = "800000000000000001";
    const c = approvalCard(rid, "500000000000000008", 1760000000, "png");
    expect(c.payload.allowed_mentions).toEqual({ parse: [] });
    expect(c.filename).toBe(`vip-${rid}.png`);
    for (const b of decisionButtons(rid)[0]!.components) {
      expect(b.custom_id.length).toBeLessThanOrEqual(100);
      expect(parseDecisionId(b.custom_id)?.requestId).toBe(rid);
    }
    expect(parseDecisionId(`vip:rejectmodal:${rid}`)).toEqual({ action: "rejectModal", requestId: rid });
    expect(parseDecisionId("vip:approve:abc")).toBeNull();
  });

  it("commands are guild-only with descriptions ≤100", () => {
    for (const c of commandDefinitions()) {
      expect(c.contexts).toEqual([0]);
      expect(c.description.length).toBeLessThanOrEqual(100);
      expect(c.name).toMatch(/^[-a-z]{1,32}$/);
    }
  });

  it("panel has the Verify deposit button and privacy notice", () => {
    const p = verifyPanel();
    expect(p.content).toContain(copy.PRIVACY_NOTICE);
    expect(p.components[0]!.components[0]!.custom_id).toBe("vip:start");
  });
});

describe("attachments", () => {
  it("accepts one png/jpeg/webp within the size limit; refuses others", () => {
    const a = { id: "1", filename: "a.png", size: 1000, url: "https://cdn.discordapp.com/x", content_type: "image/png" };
    expect(checkAttachmentMeta([a], 8e6).ok).toBe(true);
    expect(checkAttachmentMeta([], 8e6)).toEqual({ ok: false, reason: "missing" });
    expect(checkAttachmentMeta([a, a], 8e6)).toEqual({ ok: false, reason: "too_many" });
    expect(checkAttachmentMeta([{ ...a, content_type: "image/svg+xml" }], 8e6)).toEqual({ ok: false, reason: "type" });
    expect(checkAttachmentMeta([{ ...a, content_type: "image/gif" }], 8e6)).toEqual({ ok: false, reason: "type" });
    expect(checkAttachmentMeta([{ ...a, size: 9e6 }], 8e6)).toEqual({ ok: false, reason: "size" });
  });
  it("sniffs magic bytes", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg>"))).toBeNull();
  });
  it("only downloads from Discord's CDN", () => {
    expect(isDiscordCdnUrl("https://cdn.discordapp.com/ephemeral-attachments/1/2/a.png?ex=1")).toBe(true);
    expect(isDiscordCdnUrl("https://media.discordapp.net/x")).toBe(true);
    expect(isDiscordCdnUrl("http://cdn.discordapp.com/x")).toBe(false);
    expect(isDiscordCdnUrl("https://cdn.discordapp.com.evil.io/x")).toBe(false);
  });
});

describe("copy compliance", () => {
  const all: string[] = [];
  const collect = (v: unknown) => {
    if (typeof v === "string") all.push(v);
    else if (typeof v === "function") {
      try {
        all.push(String((v as (...a: string[]) => unknown)("500000000000000008", "x")));
      } catch {
        /* ignore */
      }
    } else if (v && typeof v === "object") Object.values(v).forEach(collect);
  };
  collect(copy);
  for (const r of ["unclear", "wrong_screen", "cant_confirm", "other"] as const) all.push(copy.rejectDm(r, "note"));

  it("no income / profit / win-rate / guarantee claims", () => {
    for (const s of all) {
      expect(s).not.toMatch(/\b(profit|kumita|kikita|income|win[- ]?rate|sure ?win|guaranteed (profit|returns?|income))\b/i);
      expect(s.replace(/Walang guaranteed results/g, "")).not.toMatch(/guarantee/i);
    }
  });
  it("any copy naming ACCM includes the IB disclosure", () => {
    for (const s of all) if (/ACCM/.test(s) && s !== copy.IB_DISCLOSURE) expect(s).toContain(copy.IB_DISCLOSURE);
  });
  it("privacy notice says: verification only, deleted after review, decision log only, contact email", () => {
    expect(copy.PRIVACY_NOTICE).toMatch(/para lang sa VIP verification/);
    expect(copy.PRIVACY_NOTICE).toMatch(/buburahin ito pagkatapos ng review/);
    expect(copy.PRIVACY_NOTICE).toMatch(/Decision log lang/);
    expect(copy.PRIVACY_NOTICE).toContain("goldfx.society@gmail.com");
  });
  it("approve DM is education-only with risk reminders", () => {
    expect(copy.APPROVE_DM).toMatch(/education lang ito, hindi financial advice/);
    expect(copy.APPROVE_DM).toMatch(/max 1% risk per trade/);
  });
  it("log line has ids only", () => {
    const l = copy.logLine({ requestId: "1", memberId: "2", adminId: "3", decision: "rejected", decidedAt: "2026-10-18T04:00:00.000Z", reason: "unclear", flags: ["dm_failed"] });
    expect(l).toBe("`1` · member 2 · admin 3 · rejected · 2026-10-18T04:00:00.000Z · reason unclear · dm_failed");
  });
  it("never names the founder", () => {
    for (const s of all) expect(s).not.toMatch(/\bBen\b/);
  });
});
