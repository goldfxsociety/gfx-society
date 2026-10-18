import { describe, expect, it } from "vitest";
import { checkAttachmentMeta, isDiscordCdnUrl, sniffImageType } from "../src/attachments";
import * as copy from "../src/copy";
import { approvalCard, commandDefinitions, decisionButtons, infoModal, parseDecisionId, rejectModal, uploadModal, verifyPanel } from "../src/payloads";
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
    expect(sel.options.map((o) => o.value)).toEqual(["unclear", "wrong_screen", "not_accm", "too_old", "cant_confirm", "other"]);
    for (const o of sel.options as unknown as Array<{ label: string }>) expect(o.label.length).toBeLessThanOrEqual(100);
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
    expect(parseDecisionId(`vip:info:${rid}`)).toEqual({ action: "info", requestId: rid });
    expect(parseDecisionId(`vip:infomodal:${rid}`)).toEqual({ action: "infoModal", requestId: rid });
    expect(decisionButtons(rid)[0]!.components.map((b) => b.label)).toEqual(["Approve VIP", "Need more info", "Reject"]);
    const im = infoModal(rid);
    expect(im.data.title.length).toBeLessThanOrEqual(45);
    expect(im.data.components[0]!.label.length).toBeLessThanOrEqual(45);
    expect(im.data.components[0]!.description.length).toBeLessThanOrEqual(100);
    expect(im.data.components[0]!.component).toMatchObject({ type: 4, required: true, max_length: 300 });
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
    expect(p.content).toContain(copy.VALID_DEPOSIT_MEMBER);
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
  const reasons = Object.keys(copy.REASONS) as Array<keyof typeof copy.REASONS>;
  const statuses = ["pending", "approved", "rejected", "needs_info", "expired"] as const;
  /** Every MEMBER-facing message the bot can send (each one is a single Discord message/modal). */
  const member: string[] = [
    JSON.stringify(uploadModal()),
    verifyPanel().content,
    copy.APPROVE_DM,
    copy.dmFallback("500000000000000008"),
    copy.needsInfoDm("Pakita ang ACCM User ID"),
    copy.needsInfoDm(""),
    ...reasons.map((r) => copy.rejectDm(r, "note")),
    ...reasons.flatMap((r) => statuses.map((st) => copy.statusText(st, r))),
    ...Object.values(copy.MSG)
      .filter((v) => typeof v === "string" || typeof v === "function")
      .map((v) => (typeof v === "function" ? String((v as (a: never) => unknown)(8 as never)) : v)),
    ...commandDefinitions().map((c) => c.description),
  ];
  const admin: string[] = [copy.approvalCardText("1", "2", 3), JSON.stringify(rejectModal("800000000000000001")), JSON.stringify(infoModal("800000000000000001"))];
  const withoutIb = (t: string) => t.split(copy.IB_DISCLOSURE).join("");

  it("no income / profit / win-rate / guaranteed-results claims (outside the IB disclosure)", () => {
    for (const s of [...member, ...admin].map(withoutIb)) {
      expect(s).not.toMatch(/\b(profit|kumita|kikita|kitain|income|win[- ]?rate|sure ?win|ROI)\b/i);
      expect(s.replace(/Walang guaranteed results/g, "").replace(/A guaranteed/g, "")).not.toMatch(/guarantee/i);
    }
  });

  it("every member-facing message that names ACCM carries the one-line IB disclosure", () => {
    let named = 0;
    for (const s of member) {
      if (!withoutIb(s).includes("ACCM")) continue;
      named++;
      expect(s).toContain(copy.IB_DISCLOSURE);
    }
    expect(named).toBeGreaterThanOrEqual(4); // panel, modal, reject/needs-info DMs, status
    expect(copy.IB_DISCLOSURE).toBe("GFX at ang partner community ay maaaring kumita ng commission mula sa ACCM kapag nag-trade ka via our link.");
    for (const s of member) if (withoutIb(s).includes("ACCM")) expect(s).toContain("GFX at ang partner community ay maaaring kumita ng commission mula sa ACCM kapag nag-trade ka via our link.");
    expect(copy.IB_DISCLOSURE).not.toMatch(/\n/);
    expect(copy.withIb("no broker here")).toBe("no broker here");
  });

  it("slash command descriptions don't name ACCM (no room for the disclosure in 100 chars)", () => {
    for (const c of commandDefinitions()) expect(c.description).not.toMatch(/ACCM/);
  });

  it("balanced Taglish: member messages mix English and Tagalog", () => {
    const tl = /\b(ang|ng|mo|ka|lang|na|ito|namin|kung|puwede|paki|ulit|muna|bago|dito|kita|hindi|wala|para|sa|ay)\b/i;
    const en = /\b(the|your|you|please|is|only|after|review|screenshot|submit|request|again|with|using|wait)\b/i;
    const long = [copy.APPROVE_DM, copy.PRIVACY_NOTICE, copy.needsInfoDm("x"), copy.rejectDm("unclear"), verifyPanel().content, copy.MSG.received, copy.dmFallback("1")];
    for (const s of long) {
      expect(s).toMatch(tl);
      expect(s).toMatch(en);
    }
  });

  it("privacy notice: verification only, deleted after review, decision log only, contact email", () => {
    expect(copy.PRIVACY_NOTICE).toMatch(/only for VIP verification/);
    expect(copy.PRIVACY_NOTICE).toMatch(/deletes it after the review/);
    expect(copy.PRIVACY_NOTICE).toMatch(/Decision log lang/);
    expect(copy.PRIVACY_NOTICE).toContain("goldfx.society@gmail.com");
    expect(JSON.stringify(uploadModal())).toContain("goldfx.society@gmail.com");
  });

  it("approve DM is education-only with risk reminders; VIP framed as community access", () => {
    expect(copy.APPROVE_DM).toMatch(/education lang ito, not financial advice/);
    expect(copy.APPROVE_DM).toMatch(/max 1% risk per trade/);
    expect(verifyPanel().content).toMatch(/community access, not trading results/);
  });

  it("approval card tells admins the valid-deposit rule and that the bot doesn't auto-check", () => {
    const card = copy.approvalCardText("1", "2", 3);
    expect(card).toMatch(/ACCM screenshot showing the member's name or ACCM User ID, dated within the last 30 days/);
    expect(card).toMatch(/Admins judge the amount/);
    expect(card).toMatch(/does \*\*not\*\* auto-check/);
  });

  it("log line has ids only", () => {
    const l = copy.logLine({ requestId: "1", memberId: "2", adminId: "3", decision: "rejected", decidedAt: "2026-10-18T04:00:00.000Z", reason: "unclear", flags: ["dm_failed"] });
    expect(l).toBe("`1` · member 2 · admin 3 · rejected · 2026-10-18T04:00:00.000Z · reason unclear · dm_failed");
  });

  it("never names the founder", () => {
    for (const s of [...member, ...admin]) expect(s).not.toMatch(/\bBen\b/);
  });
});
