import { describe, expect, it } from "vitest";
import { MSG, PRIVACY_NOTICE, SPEC_FREE_APPROVED, SPEC_TRANSFER, SPEC_VIP_APPROVED, SPEC_WRONG_IB, TRANSFER_OPTION_LABEL, deniedDm } from "../src/copy";
import { handleInteraction } from "../src/handlers";
import { CID } from "../src/payloads";
import type { Application } from "../src/types";
import { button, clientSubmit, denySubmit, IDS, member, nextInteractionId, PNG, world, type World } from "./helpers";

const { freeRole, vipRole, unverifiedRole } = IDS;

async function submit(w: World, i: ReturnType<typeof clientSubmit>) {
  const res = (await handleInteraction(i, w.deps, w.ctx)) as { type: number; data?: { content?: string } };
  await w.ctx.flush();
  return res;
}
const appOf = (w: World, id: string) => w.d1.one<Application>("SELECT * FROM applications WHERE id = ?", id);
const ephemeralText = (r: unknown) => (r as { data: { content: string } }).data.content;
const followups = (w: World) => w.fake.calls.filter((c) => /^\/webhooks\/\d+\/tok$/.test(c.path)).map((c) => (c.body as { content: string }).content);
const edits = (w: World) => w.fake.calls.filter((c) => c.path.endsWith("/messages/@original")).map((c) => (c.body as { content: string }).content);

async function click(w: World, customId: string, userId: string, roles: string[], app: Application) {
  const r = await handleInteraction(button(customId, userId, roles, app.review_channel_id!, app.review_message_id!), w.deps, w.ctx);
  await w.ctx.flush();
  return r as { type: number; data?: { content?: string; custom_id?: string; components?: unknown[] } };
}

describe("Client ako: open modal", () => {
  it("shows privacy notice, 6-digit User ID, FREE only for Unverified, display-name dropdown + transfer option, image upload", async () => {
    const w = world();
    const r = (await handleInteraction(button(CID.client, IDS.member, []), w.deps, w.ctx)) as any;
    expect(r.type).toBe(9);
    const comps = r.data.components;
    expect(comps).toHaveLength(5);
    expect(comps[0]).toEqual({ type: 10, content: PRIVACY_NOTICE });
    expect(comps[1].component).toMatchObject({ custom_id: CID.fAccm, min_length: 6, max_length: 6 });
    expect(comps[2].component.options.map((o: any) => o.value)).toEqual(["free"]);
    const opts = comps[3].component.options;
    expect(opts.map((o: any) => o.label)).toEqual(["Coach Mike", "GFX", TRANSFER_OPTION_LABEL]);
    expect(JSON.stringify(r)).not.toContain("goldfx.society@gmail.com"); // IB email never in a dropdown
    expect(comps[4].component).toMatchObject({ type: 19, custom_id: CID.fShot, file_types: ["image"], max_values: 1 });
  });

  it("FREE member gets VIP only, pre-filled User ID and referring IB preselected; VIP member outside the window is told they are VIP", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member}', '123456', 2, 'free')`);
    const r = (await handleInteraction(button(CID.client, IDS.member, [freeRole]), w.deps, w.ctx)) as any;
    expect(r.data.components[2].component.options.map((o: any) => o.value)).toEqual(["vip"]);
    expect(r.data.components[1].component.value).toBe("123456");
    expect(r.data.components[3].component.options.find((o: any) => o.default)?.value).toBe("2");
    const v = await handleInteraction(button(CID.client, IDS.member, [freeRole, vipRole]), w.deps, w.ctx);
    expect(ephemeralText(v)).toBe(MSG.alreadyVip);
    // In the 7-day window before the 1st (Asia/Manila) a VIP can reverify.
    w.clock.now = new Date("2026-11-23T16:30:00.000Z"); // 24 Nov 00:30 Manila
    const v2 = (await handleInteraction(button(CID.client, IDS.member, [freeRole, vipRole]), w.deps, w.ctx)) as any;
    expect(v2.type).toBe(9);
  });

  it("only works in #verify", async () => {
    const w = world();
    const r = await handleInteraction(button(CID.client, IDS.member, [], IDS.adminLog), w.deps, w.ctx);
    expect(ephemeralText(r)).toBe(MSG.wrongChannel(IDS.verify));
  });

  it("over 24 active lines: points to /verify-client search instead of a truncated dropdown", async () => {
    const w = world();
    for (let n = 0; n < 23; n++) {
      w.d1.sqlite.exec(`INSERT INTO ib_lines (slug, display_name, discord_user_id, upline_line_id, role_id, review_channel_id) VALUES ('l${n}', 'IB ${n}', '6000000000000000${String(n).padStart(2, "0")}', 1, '310000000000000001', '410000000000000001')`);
    }
    const r = await handleInteraction(button(CID.client, IDS.member, []), w.deps, w.ctx);
    expect(ephemeralText(r)).toBe(MSG.tooManyLinesClient);
    // autocomplete search still finds every line by display name, plus the transfer option
    const ac = (await handleInteraction(
      { id: nextInteractionId(), application_id: IDS.app, type: 4, token: "t", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member, []), data: { name: "verify-client", options: [{ name: "referring_ib", type: 3, value: "IB 2", focused: true }] } },
      w.deps,
      w.ctx,
    )) as any;
    expect(ac.type).toBe(8);
    expect(ac.data.choices.map((c: any) => c.name)).toContain("IB 22");
    expect(ac.data.choices.at(-1).name).toBe(TRANSFER_OPTION_LABEL);
    // /verify-client with a chosen IB opens the modal without the dropdown
    const m = (await handleInteraction(
      { id: nextInteractionId(), application_id: IDS.app, type: 2, token: "t", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member, []), data: { name: "verify-client", options: [{ name: "referring_ib", type: 3, value: "2" }] } },
      w.deps,
      w.ctx,
    )) as any;
    expect(m.type).toBe(9);
    expect(m.data.custom_id).toBe(`${CID.clientSubmit}:2`);
    expect(m.data.components).toHaveLength(4);
  });
});

describe("Client ako: FREE flow", () => {
  it("validates the 6-digit User ID", async () => {
    const w = world();
    expect(ephemeralText(await handleInteraction(clientSubmit(IDS.member, [], { accm: "12345", type: "free", line: "2" }), w.deps, w.ctx))).toBe(MSG.badUserId);
    expect(ephemeralText(await handleInteraction(clientSubmit(IDS.member, [], { accm: "12345a", type: "free", line: "2" }), w.deps, w.ctx))).toBe(MSG.badUserId);
  });

  it("enforces FREE before VIP", async () => {
    const w = world();
    expect(ephemeralText(await handleInteraction(clientSubmit(IDS.member, [], { accm: "123456", type: "vip", line: "2" }), w.deps, w.ctx))).toBe(MSG.freeFirst);
    expect(ephemeralText(await handleInteraction(clientSubmit(IDS.member, [freeRole], { accm: "123456", type: "free", line: "2" }), w.deps, w.ctx))).toBe(MSG.alreadyFree);
  });

  it("routes to the referring IB's review channel, approve → FREE + line tag, DM, admin log, card (screenshot) deleted", async () => {
    const w = world();
    w.fake.members.set(IDS.member, [unverifiedRole]);
    const i = clientSubmit(IDS.member, [unverifiedRole], { accm: "123456", type: "free", line: "2", nick: "Juan" });
    const ack = await submit(w, i);
    expect(ack.type).toBe(5);
    expect(edits(w).at(-1)).toBe(MSG.received);
    const app = appOf(w, i.id);
    expect(app).toMatchObject({ status: "pending", type: "free", accm_user_id: "123456", target_ib_line_id: 2, current_reviewer_line_id: 2, review_channel_id: IDS.reviewGfx });
    const card = w.fake.messages.get(app.review_message_id!)!;
    expect(card.channelId).toBe(IDS.reviewGfx);
    expect(card.content).toContain("123456");
    expect(card.content).toContain("Referring IB: GFX");
    expect(card.file?.filename).toBe(`uu-${i.id}.png`); // neutral name, never the member's filename
    expect(card.file?.bytes).toEqual(PNG);
    expect(card.allowed_mentions).toEqual({ parse: [], users: [IDS.ben] });
    expect(JSON.stringify(card.components)).toContain('"label":"Approve"');

    // Another IB (Coach Mike's line is not the reviewer, but Coach role can act) — a random member cannot.
    const nope = await click(w, CID.approve + app.id, IDS.member2, [freeRole], app);
    expect(ephemeralText(nope)).toBe(MSG.notReviewer);

    const r = await click(w, CID.approve + app.id, IDS.ben, [IDS.adminRole], app);
    expect(r.type).toBe(6);
    expect(w.fake.members.get(IDS.member)).toEqual([freeRole, IDS.lineGfxRole]);
    expect(w.fake.dms.get(IDS.member)).toEqual([SPEC_FREE_APPROVED]);
    expect(w.fake.messagesIn(IDS.adminLog).at(-1)?.content).toContain("APPROVED FREE");
    expect(w.fake.messages.has(app.review_message_id!)).toBe(false); // card + screenshot gone
    const done = appOf(w, i.id);
    expect(done).toMatchObject({ status: "approved", decided_by_discord_id: IDS.ben, screenshot_url: null });
    expect(done.screenshot_deleted_at).not.toBeNull();
    expect(w.d1.one("SELECT tier, accm_user_id, referring_ib_line_id FROM members WHERE discord_user_id = ?", IDS.member)).toEqual({ tier: "free", accm_user_id: "123456", referring_ib_line_id: 2 });
  });

  it("DMs closed: posts a neutral pointer in #verify", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    w.fake.dmClosed.add(IDS.member);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    await click(w, CID.approve + i.id, IDS.ben, [IDS.adminRole], appOf(w, i.id));
    const pointer = w.fake.messagesIn(IDS.verify).at(-1)!;
    expect(pointer.content).toContain("/uu-status");
    expect(pointer.allowed_mentions).toEqual({ parse: [], users: [IDS.member] });
  });

  it("one pending application per member", async () => {
    const w = world();
    await submit(w, clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" }));
    await submit(w, clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "1" }));
    expect(edits(w).at(-1)).toBe(MSG.pending);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM applications").n).toBe(1);
  });
});

describe("Client ako: VIP flow", () => {
  it("Approve VIP ($50+) stores vip_above_min = 'yes' only, adds VIP on top of FREE, keeps the client-IB link", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member}', '123456', 2, 'free')`);
    w.fake.members.set(IDS.member, [freeRole, IDS.lineGfxRole]);
    const i = clientSubmit(IDS.member, [freeRole, IDS.lineGfxRole], { accm: "123456", type: "vip", line: "1" });
    await submit(w, i);
    const app = appOf(w, i.id);
    expect(app.review_channel_id).toBe(IDS.reviewCoach);
    const card = w.fake.messages.get(app.review_message_id!)!;
    expect(JSON.stringify(card.components)).toContain("Approve VIP ($50+)");
    expect(card.content).toContain("$50 o more");
    expect(card.content).toContain("Huwag i-record ang amount");
    // Either Coach Mike account can decide for the ONE Coach Mike line.
    expect(card.allowed_mentions?.users?.sort()).toEqual([IDS.coach1, IDS.coach2].sort());
    await click(w, CID.approve + app.id, IDS.coach2, [], app); // second account, even without the Coach role
    expect(w.fake.members.get(IDS.member)).toEqual([freeRole, IDS.lineGfxRole, vipRole]);
    expect(w.fake.dms.get(IDS.member)).toEqual([SPEC_VIP_APPROVED]);
    const m = w.d1.one<any>("SELECT * FROM members WHERE discord_user_id = ?", IDS.member);
    expect(m).toMatchObject({ tier: "vip", vip_above_min: "yes", referring_ib_line_id: 2 });
    expect(m.vip_verified_at).not.toBeNull();
    expect(appOf(w, i.id)).toMatchObject({ status: "approved", vip_above_min: "yes" });
    // No balance or amount anywhere in the schema.
    const cols = w.d1.rows<{ name: string }>("SELECT name FROM pragma_table_info('members') UNION ALL SELECT name FROM pragma_table_info('applications')").map((c) => c.name);
    expect(cols.some((c) => /balance|amount|deposit/.test(c))).toBe(false);
  });

  it("both Coach Mike accounts can approve for the Coach Mike line", async () => {
    for (const coach of [IDS.coach1, IDS.coach2]) {
      const w = world();
      w.fake.members.set(IDS.member, []);
      const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "1" });
      await submit(w, i);
      await click(w, CID.approve + i.id, coach, [], appOf(w, i.id));
      expect(appOf(w, i.id)).toMatchObject({ status: "approved", decided_by_discord_id: coach });
    }
  });

  it("VIP denial 'Below $50 minimum' stores vip_above_min = 'no'; member stays FREE", async () => {
    const w = world();
    w.fake.members.set(IDS.member, [freeRole]);
    const i = clientSubmit(IDS.member, [freeRole], { accm: "123456", type: "vip", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    await handleInteraction(denySubmit(app.id, IDS.ben, [], IDS.reviewGfx, "below_min", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(appOf(w, i.id)).toMatchObject({ status: "denied", vip_above_min: "no" });
    expect(w.fake.members.get(IDS.member)).toEqual([freeRole]);
  });
});

describe("Duplicate ACCM User ID", () => {
  it("is flagged on the card, stays pending with no Denied DM, and blocks normal approval until an Admin / Mod overrides", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member2}', '654321', 2, 'free')`);
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "654321", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).toContain("dup_user_id");
    expect(app.status).toBe("pending");
    expect(w.fake.messages.get(app.review_message_id!)!.content).toContain("Duplicate ACCM User ID");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    await click(w, CID.approve + app.id, IDS.ben, [], app); // Ben as line IB, WITHOUT Admin role
    expect(followups(w).at(-1)).toBe(MSG.needAdminDupUserId);
    expect(appOf(w, i.id).status).toBe("pending");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    await click(w, CID.approve + app.id, IDS.admin, [IDS.adminRole], app);
    expect(appOf(w, i.id)).toMatchObject({ status: "approved", decision_reason: "admin_override_duplicate" });
  });

  it("admin deny after review uses the post-review duplicate copy, not admin-still-needs-to-look wording", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member2}', '654321', 2, 'free')`);
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "654321", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    expect(app.status).toBe("pending");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    await handleInteraction(denySubmit(app.id, IDS.admin, [IDS.adminRole], app.review_channel_id!, "duplicate", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    const reason = "Nagamit na ang ACCM User ID na ito ng ibang Discord account. Hindi ma-approve ang application na ito.";
    expect(appOf(w, i.id)).toMatchObject({ status: "denied", decision_reason: "duplicate" });
    expect(w.fake.dms.get(IDS.member)).toEqual([deniedDm(reason)]);
    expect(w.fake.dms.get(IDS.member)!.join("\n")).not.toMatch(/Kailangan muna|i-review ng admin|admin still|look at it/i);
  });

  it("a line IB or Coach without Admin / Mod cannot deny a flagged duplicate; card stays pending and no Denied DM is sent", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member2}', '654321', 2, 'free')`);
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "654321", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).toContain("dup_user_id");
    // Line IB (Ben, no Admin role)
    await handleInteraction(denySubmit(app.id, IDS.ben, [], app.review_channel_id!, "duplicate", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(followups(w).at(-1)).toBe(MSG.needAdminDupUserId);
    expect(appOf(w, i.id).status).toBe("pending");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
    expect(w.fake.messages.has(app.review_message_id!)).toBe(true);
    // Coach without Admin / Mod, any deny reason
    await handleInteraction(denySubmit(app.id, IDS.coach1, [IDS.coachRole], app.review_channel_id!, "unclear", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(followups(w).at(-1)).toBe(MSG.needAdminDupUserId);
    expect(appOf(w, i.id).status).toBe("pending");
    expect(w.fake.dms.get(IDS.member) ?? []).toEqual([]);
  });
});

describe("Transfer route", () => {
  it("dropdown 'Wala sa list' answers immediately with the exact §10 Transfer copy and records 'transferred'", async () => {
    const w = world();
    const i = clientSubmit(IDS.outsider, [], { accm: "111222", type: "free", line: "other" });
    const r = await submit(w, i);
    expect(ephemeralText(r)).toBe(SPEC_TRANSFER);
    expect(appOf(w, i.id)).toMatchObject({ status: "transferred", target_ib_line_id: null, decision_reason: "not_tree_self_selected" });
    expect(w.fake.messagesIn(IDS.reviewGfx)).toHaveLength(0);
    expect(w.fake.calls.some((c) => c.path.startsWith("cdn:"))).toBe(false); // screenshot never downloaded
    expect(w.fake.messagesIn(IDS.adminLog).at(-1)?.content).toContain("TRANSFER ROUTE");
  });

  it("reviewer denial 'Not under Coach Mike's tree' DMs the Transfer copy and marks 'transferred'", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    const modal = (await click(w, CID.deny + app.id, IDS.ben, [], app)) as any;
    expect(modal.type).toBe(9);
    expect(modal.data.components[0].component.options.map((o: any) => o.label)).toEqual(["Wrong referring IB", "Not under Coach Mike's tree", "Unclear screenshot", "Duplicate User ID", "Other"]);
    await handleInteraction(denySubmit(app.id, IDS.ben, [], IDS.reviewGfx, "not_tree", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(appOf(w, i.id).status).toBe("transferred");
    expect(w.fake.dms.get(IDS.member)).toEqual([SPEC_TRANSFER]);
    expect(w.fake.members.get(IDS.member)).toEqual([]); // no FREE
    expect(w.fake.messages.has(app.review_message_id!)).toBe(false);
  });
});

describe("Wrong-IB denial and Other", () => {
  it("wrong_ib uses the §10 Wrong-IB reason inside the Denied DM; member stays Unverified; screenshot deleted", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    await handleInteraction(denySubmit(app.id, IDS.ben, [], IDS.reviewGfx, "wrong_ib", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(w.fake.dms.get(IDS.member)).toEqual([deniedDm(SPEC_WRONG_IB)]);
    expect(deniedDm(SPEC_WRONG_IB)).toContain(`Dahilan: ${SPEC_WRONG_IB}`);
    expect(appOf(w, i.id)).toMatchObject({ status: "denied", decision_reason: "wrong_ib" });
    expect(w.fake.deleted.map((m) => m.id)).toContain(app.review_message_id);
    expect(w.fake.members.get(IDS.member)).toEqual([]);
  });

  it("Other requires a reason, which replaces [reason]", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    const r = await handleInteraction(denySubmit(app.id, IDS.ben, [], IDS.reviewGfx, "other", "", app.review_message_id!), w.deps, w.ctx);
    expect(ephemeralText(r)).toBe(MSG.otherNeedsNote);
    await handleInteraction(denySubmit(app.id, IDS.ben, [], IDS.reviewGfx, "other", "Hindi tugma ang User ID sa portal ko.", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(w.fake.dms.get(IDS.member)).toEqual([deniedDm("Hindi tugma ang User ID sa portal ko.")]);
  });
});

describe("Screenshot handling and safety", () => {
  it("card delete failure is retried by cron and the screenshot is still deleted", async () => {
    const { runCron } = await import("../src/cron");
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    w.fake.failDeleteMessage = true;
    await click(w, CID.approve + app.id, IDS.ben, [], app);
    expect(appOf(w, i.id).screenshot_deleted_at).toBeNull();
    w.fake.failDeleteMessage = false;
    const s = await runCron(w.deps);
    expect(s.cards).toBe(1);
    expect(appOf(w, i.id).screenshot_deleted_at).not.toBeNull();
    expect(w.fake.messages.has(app.review_message_id!)).toBe(false);
  });

  it("member left before the decision: closed, no roles, card deleted", async () => {
    const w = world();
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    w.fake.members.delete(IDS.member);
    await click(w, CID.approve + app.id, IDS.ben, [], app);
    expect(appOf(w, i.id)).toMatchObject({ status: "denied", decision_reason: "member_left" });
    expect(w.fake.messages.has(app.review_message_id!)).toBe(false);
  });

  it("role assignment failure rolls the decision back to pending so the reviewer can retry", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    w.fake.failAddRole = true;
    await click(w, CID.approve + app.id, IDS.ben, [], app);
    expect(followups(w).at(-1)).toBe(MSG.roleFailed);
    expect(appOf(w, i.id).status).toBe("pending");
    expect(w.fake.messages.has(app.review_message_id!)).toBe(true);
  });

  it("applicant cannot decide their own application; decided cards cannot be decided twice", async () => {
    const w = world();
    w.fake.members.set(IDS.admin, [IDS.adminRole]);
    const i = clientSubmit(IDS.admin, [IDS.adminRole], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    expect(ephemeralText(await click(w, CID.approve + app.id, IDS.admin, [IDS.adminRole], app))).toBe(MSG.selfDecision);
    await click(w, CID.approve + app.id, IDS.ben, [], app);
    expect(ephemeralText(await click(w, CID.approve + app.id, IDS.ben, [], app))).toBe(MSG.alreadyDecided);
  });
});

describe("Member leaves and rejoins", () => {
  it("returning Unverified member: card shows the previous User ID note; fresh approval still required", async () => {
    const w = world();
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier) VALUES ('${IDS.member}', '123456', 2, 'free')`);
    w.fake.members.set(IDS.member, []); // rejoined: Discord roles are gone
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    expect(app.flags).toContain("returning");
    expect(app.flags).not.toContain("dup_user_id"); // same Discord user, not a duplicate
    const card = w.fake.messages.get(app.review_message_id!)!.content;
    expect(card).toContain("Returning member");
    expect(card).toContain("Dating ACCM User ID: `123456` (pareho sa submitted)");
    expect(card).toContain("Kailangan pa rin ng bagong approval");
    expect(app.status).toBe("pending");
    expect(w.d1.one<{ tier: string }>("SELECT tier FROM members WHERE discord_user_id = ?", IDS.member).tier).toBe("unverified");
  });
});

describe("/uu-status", () => {
  it("shows the latest result ephemerally (for members with closed DMs)", async () => {
    const w = world();
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "2" });
    await submit(w, i);
    const app = appOf(w, i.id);
    await handleInteraction(denySubmit(app.id, IDS.ben, [], IDS.reviewGfx, "wrong_ib", "", app.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    const r = (await handleInteraction({ id: nextInteractionId(), application_id: IDS.app, type: 2, token: "tok", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member, []), data: { name: "uu-status" } }, w.deps, w.ctx)) as any;
    expect(r.type).toBe(5);
    await w.ctx.flush();
    expect(edits(w).at(-1)).toContain(SPEC_WRONG_IB);
  });
});
