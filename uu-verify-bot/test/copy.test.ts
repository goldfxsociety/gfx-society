import { describe, expect, it } from "vitest";
import * as C from "../src/copy";
import { clientModal, commandDefinitions, denyCodesFor, ibModal, reviewButtons, startHerePanel, verifyPanel } from "../src/payloads";

const allCopy = () => (Object.values(C) as unknown[]).filter((v): v is string => typeof v === "string").join("\n") + JSON.stringify(C.MSG) + JSON.stringify(commandDefinitions());

describe("member-facing copy", () => {
  it("never uses banned phrasing (demo first, income / win-rate / profit claims, guarantees)", () => {
    const text = allCopy().toLowerCase();
    for (const banned of ["demo first", "demo", "win rate", "win-rate", "winrate", "guarantee", "garantisado", "sure profit", "income", "passive", "100%"]) {
      expect(text, banned).not.toContain(banned);
    }
    // "kikita" (earn) as a word; "makikita" (will be seen) in the spec copy is fine.
    expect(text).not.toMatch(/(^|[^a-z])kikita/);
  });

  it("risk line is on the VIP approved DM and is exact", () => {
    expect(C.SPEC_RISK_LINE).toBe("Education lang, not financial advice. Max 1% risk per trade.");
    expect(C.SPEC_VIP_APPROVED).toContain("Education lang ito, not financial advice. Max 1% risk per trade.");
  });

  it("transfer copy carries the ACCM transfer emails, subject and GFX IB email", () => {
    expect(C.SPEC_TRANSFER).toContain("csse@accmfx.com at roselle@accmfx.com, subject: For Transfer IB. IB email: goldfx.society@gmail.com.");
  });

  it("Denied DM fills [reason]", () => {
    expect(C.deniedDm("X")).toBe("Hindi na-approve ang verification mo.\n\nDahilan: X\n\nPwede kang mag-submit ulit kapag ready na.");
  });

  it("#verify panel: Client ako + IB ako buttons, both §10 blocks and the privacy notice; #start-here has welcome + privacy", () => {
    const p = verifyPanel();
    expect(p.components[0]!.components.map((b) => b.label)).toEqual(["Client ako", "IB ako"]);
    expect(p.content).toContain(C.SPEC_CLIENT_AKO);
    expect(p.content).toContain(C.SPEC_IB_AKO);
    expect(p.content).toContain(C.PRIVACY_NOTICE);
    expect(startHerePanel().content).toBe(`${C.SPEC_START_HERE}\n\n${C.PRIVACY_NOTICE}`);
    expect(C.PRIVACY_NOTICE).toBe(
      "Privacy: Ang IB na pinili mo lang ang makakakita ng proof mo (at ang upline niya hanggang kay Coach Mike kung ma-escalate). Admins lang ang makakakita ng IB email. Buburahin ang screenshot pagkatapos ng decision. Huwag mag-send ng full account statement.",
    );
  });

  it("VIP reminder is the 22 Nov signed-off text (no 'lahat ng'; includes the keep-VIP clause)", () => {
    expect(C.SPEC_REMINDER).toBe(
      "Paalala: sa 1st ng susunod na buwan, babalik sa FREE ang VIP roles.\n\nKung gusto mong manatiling VIP, mag-reverify bago mag-1st. Kapag na-approve, hindi ka kasama sa reset. Screenshot lang na $50 o more ang deposit o balance mo. Pwede mong i-crop ang ibang details.",
    );
    expect(C.SPEC_REMINDER).not.toContain("lahat ng");
  });

  it("post-admin-deny duplicate reasons are the 22 Nov signed-off text, not 'admin still needs to look'", () => {
    expect(C.denyReasonText("duplicate", "free")).toBe(
      "Nagamit na ang ACCM User ID na ito ng ibang Discord account. Hindi ma-approve ang application na ito.",
    );
    expect(C.denyReasonText("duplicate_email", "ib")).toBe(
      "May IB line na gamit ang ACCM IB email na ito. Hindi ma-approve ang application na ito.",
    );
    for (const text of [C.denyReasonText("duplicate", "free"), C.denyReasonText("duplicate", "vip"), C.denyReasonText("duplicate_email", "ib")]) {
      expect(text).not.toMatch(/Kailangan muna|i-review ng admin|admin still|look at it/i);
    }
  });

  it("screenshot Label descriptions stay within Discord's 100-char limit; deletion sentence lives in the modal privacy notice", () => {
    const LIMIT = 100;
    const deletion = "Buburahin ang screenshot pagkatapos ng decision.";
    expect(C.MODAL.shotDescFree.length).toBeLessThanOrEqual(LIMIT);
    expect(C.MODAL.shotDescVip.length).toBeLessThanOrEqual(LIMIT);
    expect(`${C.MODAL.shotDescFree} ${deletion}`.length).toBeGreaterThan(LIMIT);
    expect(`${C.MODAL.shotDescVip} ${deletion}`.length).toBeGreaterThan(LIMIT);
    expect(C.MODAL.shotDescFree).toBe("Verified status mo. Pwede mong i-crop ang ibang details.");
    expect(C.MODAL.shotDescVip).toBe("$50 o more na deposit o balance. Pwede mong i-crop ang ibang details.");
    expect(C.PRIVACY_NOTICE).toContain(deletion);
    const lines = [
      { id: 1, slug: "gfx", display_name: "GFX", discord_user_id: "1", accm_ib_email: "hidden@example.com", upline_line_id: null, role_id: "r", review_channel_id: "c", active: 1, is_seed: 1, created_at: "2026-01-01T00:00:00.000Z" },
    ];
    const client = clientModal({ allowed: ["free", "vip"], lines, defaultLineId: null, prefillAccm: null }) as any;
    const clientVip = clientModal({ allowed: ["vip"], lines, defaultLineId: null, prefillAccm: null }) as any;
    const ib = ibModal({ lines, defaultLineId: null }) as any;
    expect(client.data.components[0]).toEqual({ type: 10, content: C.PRIVACY_NOTICE });
    expect(ib.data.components[0]).toEqual({ type: 10, content: C.PRIVACY_NOTICE });
    const shotFree = client.data.components.find((c: any) => c.label === C.MODAL.shotLabel);
    const shotVip = clientVip.data.components.find((c: any) => c.label === C.MODAL.shotLabel);
    expect(shotFree.description).toBe(C.MODAL.shotDescFree);
    expect(shotVip.description).toBe(C.MODAL.shotDescVip);
  });

  it("review buttons: VIP says 'Approve VIP ($50+)'; IB cards add the admin-only email button", () => {
    expect(JSON.stringify(reviewButtons("700000000000000001", "vip"))).toContain("Approve VIP ($50+)");
    expect(JSON.stringify(reviewButtons("700000000000000001", "free"))).not.toContain("View IB Email");
    expect(JSON.stringify(reviewButtons("700000000000000001", "ib"))).toContain("Admin: View IB Email");
    expect(denyCodesFor("free")).toEqual(["wrong_ib", "not_tree", "unclear", "duplicate", "other"]);
  });
});
