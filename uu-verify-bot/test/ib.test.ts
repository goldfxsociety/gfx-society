import { describe, expect, it } from "vitest";
import { MSG, PRIVACY_NOTICE, SPEC_IB_APPROVED_FROM_CLIENT, SPEC_IB_APPROVED_NEW, deniedDm } from "../src/copy";
import { handleInteraction } from "../src/handlers";
import { CID } from "../src/payloads";
import { VIEW, WRITE } from "../src/perms";
import type { Application, IbLine } from "../src/types";
import { button, clientSubmit, denySubmit, IDS, ibSubmit, world, type World } from "./helpers";

const { freeRole, vipRole, subIbRole } = IDS;
const EMAIL = "juan.ib@example.com";

async function run(w: World, i: Parameters<typeof handleInteraction>[0]) {
  const r = await handleInteraction(i, w.deps, w.ctx);
  await w.ctx.flush();
  return r as any;
}
const appOf = (w: World, id: string) => w.d1.one<Application>("SELECT * FROM applications WHERE id = ?", id);
const click = (w: World, cid: string, userId: string, roles: string[], app: Application) => run(w, button(cid, userId, roles, app.review_channel_id!, app.review_message_id!));
const followups = (w: World) => w.fake.calls.filter((c) => /^\/webhooks\/\d+\/tok$/.test(c.path)).map((c) => (c.body as { content: string }).content);

describe("IB ako: modal", () => {
  it("privacy notice, ACCM IB email, upline dropdown with display names only", async () => {
    const w = world();
    const r = await run(w, button(CID.ib, IDS.member, []));
    expect(r.type).toBe(9);
    expect(r.data.components[0]).toEqual({ type: 10, content: PRIVACY_NOTICE });
    expect(r.data.components[1].component.custom_id).toBe(CID.fEmail);
    expect(r.data.components[2].component.options.map((o: any) => o.label)).toEqual(["Coach Mike", "GFX"]);
    expect(JSON.stringify(r)).not.toContain("@gmail.com");
  });

  it("validates the email", async () => {
    const w = world();
    expect((await run(w, ibSubmit(IDS.member, [], { email: "not-an-email", line: "2" }))).data.content).toBe(MSG.badEmail);
  });
});

describe("IB ako: new IB", () => {
  it("routes to the upline; email hidden from the card; admin-only button; approve auto-creates role + private channel + dropdown entry", async () => {
    const w = world();
    w.fake.members.set(IDS.member, [IDS.unverifiedRole]);
    const i = ibSubmit(IDS.member, [IDS.unverifiedRole], { email: "Juan.IB@Example.com", line: "2", nick: "Juan IB" });
    await run(w, i);
    const app = appOf(w, i.id);
    expect(app).toMatchObject({ type: "ib", accm_ib_email: EMAIL, target_ib_line_id: 2, review_channel_id: IDS.reviewGfx, status: "pending" });
    const card = w.fake.messages.get(app.review_message_id!)!;
    expect(card.content).not.toContain(EMAIL);
    expect(card.content.toLowerCase()).not.toContain("example.com");
    expect(card.file).toBeUndefined();
    expect(JSON.stringify(card.components)).toContain("Admin: View IB Email");

    // Upline IB (Ben) WITHOUT Admin role cannot see the email.
    const denied = await click(w, CID.email + app.id, IDS.ben, [subIbRole, freeRole], app);
    expect(denied.data.content).toBe(MSG.notAdmin);
    expect(denied.data.flags).toBe(64);
    // Coach Mike (not admin) cannot either.
    expect((await click(w, CID.email + app.id, IDS.coach1, [IDS.coachRole], app)).data.content).toBe(MSG.notAdmin);
    // Admin sees it, ephemerally only.
    const shown = await click(w, CID.email + app.id, IDS.admin, [IDS.adminRole], app);
    expect(shown.data.flags).toBe(64);
    expect(shown.data.content).toContain(EMAIL);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM decision_logs WHERE action = 'email_viewed'").n).toBe(1);
    expect(w.d1.rows("SELECT detail FROM decision_logs").every((r: any) => !String(r.detail ?? "").includes("@"))).toBe(true);

    await click(w, CID.approve + app.id, IDS.ben, [subIbRole, freeRole], app);
    expect(appOf(w, i.id).status).toBe("approved");
    // role + private review channel
    expect(w.fake.createdRoles).toEqual([{ id: expect.any(String), name: "Line: Juan IB" }]);
    const ch = w.fake.createdChannels[0]!;
    expect(ch.name).toBe("review-juan-ib");
    expect(ch.parent_id).toBe(IDS.reviewCategory);
    const ow = Object.fromEntries(ch.permission_overwrites.map((o) => [o.id, o]));
    expect(ow[IDS.guild]).toMatchObject({ deny: VIEW });
    expect(ow[IDS.member]).toMatchObject({ type: 1, allow: WRITE });
    expect(ow[IDS.coachRole]).toMatchObject({ type: 0, allow: WRITE });
    expect(ow[IDS.adminRole]).toMatchObject({ type: 0, allow: WRITE });
    expect(ow[IDS.ben]).toBeUndefined(); // upline has no standing access (escalations are re-posted)
    // ib_lines row: active, upline GFX, in the dropdown immediately
    const line = w.d1.one<IbLine>("SELECT * FROM ib_lines WHERE discord_user_id = ?", IDS.member);
    expect(line).toMatchObject({ display_name: "Juan IB", slug: "juan-ib", upline_line_id: 2, active: 1, is_seed: 0, accm_ib_email: EMAIL, role_id: w.fake.createdRoles[0]!.id, review_channel_id: ch.id });
    const modal = await run(w, button(CID.client, IDS.member2, []));
    expect(modal.data.components[3].component.options.map((o: any) => o.label)).toContain("Juan IB");
    expect(JSON.stringify(modal)).not.toContain(EMAIL);
    // roles: Sub-IB + FREE + upline's line tag; Unverified removed
    expect(w.fake.members.get(IDS.member)?.sort()).toEqual([subIbRole, freeRole, IDS.lineGfxRole].sort());
    expect(w.fake.dms.get(IDS.member)).toEqual([SPEC_IB_APPROVED_NEW]);
    expect(w.d1.one("SELECT tier, is_sub_ib, own_ib_line_id, referring_ib_line_id FROM members WHERE discord_user_id = ?", IDS.member)).toEqual({ tier: "free", is_sub_ib: 1, own_ib_line_id: line.id, referring_ib_line_id: 2 });
    const log = w.fake.messagesIn(IDS.adminLog).at(-1)!.content;
    expect(log).toContain("APPROVED IB");
    expect(log).not.toContain(EMAIL);
    expect(w.fake.messages.has(app.review_message_id!)).toBe(false);

    // The new line's clients now route to the new private channel.
    w.fake.members.set(IDS.member2, []);
    const c = clientSubmit(IDS.member2, [], { accm: "222333", type: "free", line: String(line.id) });
    await run(w, c);
    expect(appOf(w, c.id).review_channel_id).toBe(ch.id);
  });
});

describe("IB ako: existing client becomes sub-IB (spec §6)", () => {
  it("keeps FREE/VIP and the original client-IB link, adds Sub-IB, stays in the VIP re-check", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier, vip_above_min, vip_verified_at) VALUES ('${IDS.member}', '123456', 2, 'vip', 'yes', '2026-11-10T00:00:00.000Z')`);
    w.fake.members.set(IDS.member, [freeRole, vipRole, IDS.lineGfxRole]);
    // Their referring IB (GFX) is pre-selected as upline.
    const modal = await run(w, button(CID.ib, IDS.member, [freeRole, vipRole]));
    expect(modal.data.components[2].component.options.find((o: any) => o.default)?.value).toBe("2");
    const i = ibSubmit(IDS.member, [freeRole, vipRole], { email: EMAIL, line: "2", nick: "Maria" });
    await run(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).not.toContain("upline_differs");
    await click(w, CID.approve + app.id, IDS.ben, [], app);
    expect(w.fake.members.get(IDS.member)).toEqual([freeRole, vipRole, IDS.lineGfxRole, subIbRole]);
    expect(w.fake.dms.get(IDS.member)).toEqual([SPEC_IB_APPROVED_FROM_CLIENT]);
    const m = w.d1.one<any>("SELECT * FROM members WHERE discord_user_id = ?", IDS.member);
    expect(m).toMatchObject({ tier: "vip", vip_above_min: "yes", referring_ib_line_id: 2, is_sub_ib: 1 });
    expect(m.own_ib_line_id).not.toBeNull();
    // Still in the VIP re-check: the reset selects them.
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM members WHERE tier = 'vip'").n).toBe(1);
  });

  it("a different upline than the current referring IB is noted on the card", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member}', '123456', 2, 'free')`);
    const i = ibSubmit(IDS.member, [freeRole], { email: EMAIL, line: "1" });
    await run(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).toContain("upline_differs");
    expect(w.fake.messages.get(app.review_message_id!)!.content).toContain("current referring IB on record ay GFX");
  });
});

describe("Duplicate ACCM IB email", () => {
  it("is flagged, stays pending with no Denied DM, and never creates a second line, not even by an Admin", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = ibSubmit(IDS.member, [], { email: "GOLDFX.society@gmail.com", line: "1" });
    await run(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).toContain("dup_ib_email");
    expect(app.status).toBe("pending");
    expect(w.fake.messages.get(app.review_message_id!)!.content).toContain("Duplicate ACCM IB email");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    await click(w, CID.approve + app.id, IDS.admin, [IDS.adminRole], app);
    expect(followups(w).at(-1)).toBe(MSG.dupEmailBlocked);
    expect(appOf(w, i.id).status).toBe("pending");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    expect(w.fake.createdRoles).toHaveLength(0);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM ib_lines").n).toBe(2);
    // DB constraint backs it up.
    expect(() =>
      w.d1.sqlite.exec(`INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id) VALUES ('x', 'X', '${IDS.member}', 'goldfx.society@gmail.com', 1)`),
    ).toThrow(/UNIQUE/);
  });

  it("admin deny after review uses the post-review duplicate-email copy, not admin-still-needs-to-look wording", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = ibSubmit(IDS.member, [], { email: "GOLDFX.society@gmail.com", line: "1" });
    await run(w, i);
    const app = appOf(w, i.id);
    expect(app.status).toBe("pending");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    await run(w, denySubmit(app.id, IDS.admin, [IDS.adminRole], app.review_channel_id!, "duplicate_email", "", app.review_message_id!));
    const reason = "May IB line na gamit ang ACCM IB email na ito. Hindi ma-approve ang application na ito.";
    expect(appOf(w, i.id)).toMatchObject({ status: "denied", decision_reason: "duplicate_email" });
    expect(w.fake.dms.get(IDS.member)).toEqual([deniedDm(reason)]);
    expect(w.fake.dms.get(IDS.member)!.join("\n")).not.toMatch(/Kailangan muna|i-review ng admin|admin still|look at it/i);
  });

  it("second pending IB request with the same email is flagged too", async () => {
    const w = world();
    await run(w, ibSubmit(IDS.member, [], { email: EMAIL, line: "2" }));
    const i2 = ibSubmit(IDS.member2, [], { email: EMAIL, line: "2" });
    await run(w, i2);
    expect(appOf(w, i2.id).flags).toContain("dup_ib_email");
  });

  it("channel creation failure rolls back the role and the decision", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = ibSubmit(IDS.member, [], { email: EMAIL, line: "2" });
    await run(w, i);
    w.fake.failCreateChannel = true;
    await click(w, CID.approve + i.id, IDS.ben, [], appOf(w, i.id));
    expect(appOf(w, i.id).status).toBe("pending");
    expect(w.fake.deletedRoles).toEqual([w.fake.createdRoles[0]!.id]);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM ib_lines").n).toBe(2);
  });
});

describe("IB returning member", () => {
  it("shows an IB-email-on-record note without printing the email; admin button shows both", async () => {
    const w = world();
    w.d1.sqlite.exec(`
      INSERT INTO ib_lines (id, slug, display_name, discord_user_id, accm_ib_email, upline_line_id, active) VALUES (5, 'old', 'Old', '${IDS.member}', 'old.ib@example.com', 2, 0);
      INSERT INTO members (discord_user_id, tier, is_sub_ib, own_ib_line_id) VALUES ('${IDS.member}', 'free', 1, 5);`);
    const i = ibSubmit(IDS.member, [], { email: EMAIL, line: "2" });
    await run(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).toContain("returning");
    const card = w.fake.messages.get(app.review_message_id!)!.content;
    expect(card).toContain("Returning member: may dating IB email on record (iba sa submitted)");
    expect(card).not.toContain("example.com");
    const shown = await click(w, CID.email + app.id, IDS.admin, [IDS.adminRole], app);
    expect(shown.data.content).toContain(EMAIL);
    expect(shown.data.content).toContain("old.ib@example.com");
  });
});
