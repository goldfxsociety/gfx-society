import { describe, expect, it } from "vitest";
import * as C from "../src/copy";
import { commandDefinitions, denyCodesFor, reviewButtons, startHerePanel, verifyPanel } from "../src/payloads";

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
    expect(C.PRIVACY_NOTICE).toMatch(/Admins lang ang makakakita ng IB email/);
    expect(C.PRIVACY_NOTICE).toMatch(/Buburahin ang screenshot pagkatapos ng decision/);
  });

  it("review buttons: VIP says 'Approve VIP ($50+)'; IB cards add the admin-only email button", () => {
    expect(JSON.stringify(reviewButtons("700000000000000001", "vip"))).toContain("Approve VIP ($50+)");
    expect(JSON.stringify(reviewButtons("700000000000000001", "free"))).not.toContain("View IB Email");
    expect(JSON.stringify(reviewButtons("700000000000000001", "ib"))).toContain("Admin: View IB Email");
    expect(denyCodesFor("free")).toEqual(["wrong_ib", "not_tree", "unclear", "duplicate", "other"]);
  });
});
