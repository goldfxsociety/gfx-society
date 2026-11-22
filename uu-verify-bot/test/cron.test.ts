import { describe, expect, it } from "vitest";
import { SPEC_REMINDER, SPEC_RESET_DAY } from "../src/copy";
import { runCron } from "../src/cron";
import { handleInteraction } from "../src/handlers";
import { CRON_BUDGET } from "../src/meter";
import { CID } from "../src/payloads";
import { inReverifyWindow, manila, upcomingReset } from "../src/time";
import type { Application } from "../src/types";
import { button, clientSubmit, IDS, ibSubmit, PNG, world, type World } from "./helpers";

const appOf = (w: World, id: string) => w.d1.one<Application>("SELECT * FROM applications WHERE id = ?", id);
const HOUR = 60 * 60 * 1000;
const advance = (w: World, ms: number) => (w.clock.now = new Date(w.clock.now.getTime() + ms));
const SUB = "500000000000000099";

/** Adds a sub-IB line (id 3) under GFX (id 2). Chain: sub → GFX → Coach Mike. */
function withSubLine(w: World) {
  w.d1.sqlite.exec(
    `INSERT INTO ib_lines (id, slug, display_name, discord_user_id, upline_line_id, role_id, review_channel_id) VALUES (3, 'sub', 'Sub IB', '${SUB}', 2, '310000000000000003', '410000000000000003')`,
  );
}

describe("Asia/Manila time helpers", () => {
  it("reminder window starts 00:00 Manila 7 days before the 1st", () => {
    const up = upcomingReset(new Date("2026-11-22T06:00:00Z"));
    expect(up.key).toBe("2026-12");
    expect(up.startsAt.toISOString()).toBe("2026-11-30T16:00:00.000Z"); // Dec 1 00:00 +08
    expect(up.windowStart.toISOString()).toBe("2026-11-23T16:00:00.000Z"); // Nov 24 00:00 +08 (30 - 6)
    expect(inReverifyWindow(new Date("2026-11-23T15:59:59Z"))).toBe(false);
    expect(inReverifyWindow(new Date("2026-11-23T16:00:00Z"))).toBe(true);
    expect(manila(new Date("2026-11-30T16:00:00Z"))).toMatchObject({ y: 2026, m: 12, day: 1, hour: 0 });
    // February / year rollover
    expect(upcomingReset(new Date("2027-02-21T16:00:00Z")).windowStart.toISOString()).toBe("2027-02-21T16:00:00.000Z"); // Feb 22 (28 - 6)
    expect(upcomingReset(new Date("2026-12-26T00:00:00Z")).key).toBe("2027-01");
  });
});

describe("48h upline escalation", () => {
  it("sub-IB → upline → Coach Mike, re-uploading the screenshot each hop, then stops at Coach Mike with one admin alert", async () => {
    const w = world();
    withSubLine(w);
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "3" });
    await handleInteraction(i, w.deps, w.ctx);
    await w.ctx.flush();
    const a0 = appOf(w, i.id);
    expect(a0.review_channel_id).toBe("410000000000000003");

    // Before 48h: nothing happens.
    advance(w, 47 * HOUR);
    expect((await runCron(w.deps)).escalated).toBe(0);

    // Hop 1: Sub IB → GFX
    advance(w, 2 * HOUR);
    expect((await runCron(w.deps)).escalated).toBe(1);
    const a1 = appOf(w, i.id);
    expect(a1).toMatchObject({ current_reviewer_line_id: 2, escalation_hops: 1, review_channel_id: IDS.reviewGfx, status: "pending" });
    expect(w.fake.messages.has(a0.review_message_id!)).toBe(false); // old card removed
    const c1 = w.fake.messages.get(a1.review_message_id!)!;
    expect(c1.file?.bytes).toEqual(PNG); // screenshot preserved until the final decision
    expect(c1.content).toContain("escalated ×1");
    expect(w.fake.messagesIn(IDS.adminLog).at(-1)?.content).toContain("Sub IB → GFX");

    // Hop 2: GFX → Coach Mike
    advance(w, 49 * HOUR);
    await runCron(w.deps);
    const a2 = appOf(w, i.id);
    expect(a2).toMatchObject({ current_reviewer_line_id: 1, escalation_hops: 2, review_channel_id: IDS.reviewCoach });
    expect(w.fake.messages.get(a2.review_message_id!)!.file?.bytes).toEqual(PNG);

    // At Coach Mike: stop escalating, alert admins once.
    advance(w, 49 * HOUR);
    const s3 = await runCron(w.deps);
    expect(s3).toMatchObject({ escalated: 0, topAlerts: 1 });
    expect(appOf(w, i.id)).toMatchObject({ current_reviewer_line_id: 1, escalation_hops: 2, escalate_after_at: null });
    expect(appOf(w, i.id).flags).toContain("top_alerted");
    advance(w, 49 * HOUR);
    expect(await runCron(w.deps)).toMatchObject({ escalated: 0, topAlerts: 0 });
    expect(w.fake.messagesIn(IDS.adminLog).filter((m) => m.content.includes("top of tree"))).toHaveLength(1);

    // Either Coach Mike account may decide at the root; screenshot deleted on decision.
    const card = appOf(w, i.id);
    await handleInteraction(button(CID.approve + card.id, IDS.coach2, [], card.review_channel_id!, card.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(appOf(w, i.id)).toMatchObject({ status: "approved", decided_by_discord_id: IDS.coach2 });
    expect(w.fake.messages.has(card.review_message_id!)).toBe(false);
  });

  it("retries a leftover screenshot in the lower IB channel when the post-hop delete fails", async () => {
    const w = world();
    withSubLine(w);
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "3" });
    await handleInteraction(i, w.deps, w.ctx);
    await w.ctx.flush();
    const a0 = appOf(w, i.id);
    const oldId = a0.review_message_id!;
    expect(w.fake.messages.has(oldId)).toBe(true);

    w.fake.failDeleteMessage = true;
    advance(w, 49 * HOUR);
    expect((await runCron(w.deps)).escalated).toBe(1);
    const a1 = appOf(w, i.id);
    expect(a1).toMatchObject({ current_reviewer_line_id: 2, review_channel_id: IDS.reviewGfx, status: "pending" });
    expect(a1.review_message_id).not.toBe(oldId);
    expect(w.fake.messages.has(oldId)).toBe(true); // leftover in the lower IB channel
    expect(w.fake.messages.has(a1.review_message_id!)).toBe(true); // current upline card
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM review_cards WHERE application_id = ? AND deleted_at IS NULL", i.id).n).toBe(2);

    w.fake.failDeleteMessage = false;
    const s = await runCron(w.deps);
    expect(s.cards).toBe(1);
    expect(w.fake.messages.has(oldId)).toBe(false);
    expect(w.fake.messages.has(a1.review_message_id!)).toBe(true); // pending current card stays
    expect(appOf(w, i.id).status).toBe("pending");
    expect(appOf(w, i.id).screenshot_deleted_at).toBeNull();
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM review_cards WHERE application_id = ? AND deleted_at IS NULL", i.id).n).toBe(1);

    // A later decision still deletes the current card (and would also have wiped the leftover).
    const card = appOf(w, i.id);
    await handleInteraction(button(CID.approve + card.id, IDS.ben, [], card.review_channel_id!, card.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(w.fake.messages.has(card.review_message_id!)).toBe(false);
    expect(appOf(w, i.id).screenshot_deleted_at).not.toBeNull();
  });

  it("a decision after a failed hop delete still removes the leftover card in the lower channel", async () => {
    const w = world();
    withSubLine(w);
    w.fake.members.set(IDS.member, []);
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "3" });
    await handleInteraction(i, w.deps, w.ctx);
    await w.ctx.flush();
    const oldId = appOf(w, i.id).review_message_id!;
    w.fake.failDeleteMessage = true;
    advance(w, 49 * HOUR);
    await runCron(w.deps);
    const card = appOf(w, i.id);
    expect(w.fake.messages.has(oldId)).toBe(true);
    w.fake.failDeleteMessage = false;
    await handleInteraction(button(CID.approve + card.id, IDS.ben, [], card.review_channel_id!, card.review_message_id!), w.deps, w.ctx);
    await w.ctx.flush();
    expect(w.fake.messages.has(oldId)).toBe(false);
    expect(w.fake.messages.has(card.review_message_id!)).toBe(false);
    expect(appOf(w, i.id)).toMatchObject({ status: "approved" });
    expect(appOf(w, i.id).screenshot_deleted_at).not.toBeNull();
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM review_cards WHERE application_id = ? AND deleted_at IS NULL", i.id).n).toBe(0);
  });

  it("old reviewer's stale card cannot decide after escalation; IB requests escalate too", async () => {
    const w = world();
    withSubLine(w);
    const i = ibSubmit(IDS.member, [], { email: "x.ib@example.com", line: "3" });
    await handleInteraction(i, w.deps, w.ctx);
    await w.ctx.flush();
    const a0 = appOf(w, i.id);
    advance(w, 49 * HOUR);
    await runCron(w.deps);
    const r = (await handleInteraction(button(CID.approve + a0.id, SUB, [], a0.review_channel_id!, a0.review_message_id!), w.deps, w.ctx)) as any;
    expect(r.data.content).toMatch(/Lumipat na/);
    const a1 = appOf(w, i.id);
    expect(a1.current_reviewer_line_id).toBe(2);
    expect(w.fake.messages.get(a1.review_message_id!)!.content).not.toContain("example.com");
  });

  it("an application already at Coach Mike's line never escalates further", async () => {
    const w = world();
    const i = clientSubmit(IDS.member, [], { accm: "123456", type: "free", line: "1" });
    await handleInteraction(i, w.deps, w.ctx);
    await w.ctx.flush();
    advance(w, 49 * HOUR);
    expect(await runCron(w.deps)).toMatchObject({ escalated: 0, topAlerts: 1 });
    expect(appOf(w, i.id)).toMatchObject({ current_reviewer_line_id: 1, escalation_hops: 0, review_channel_id: IDS.reviewCoach });
  });
});

function seedVips(w: World, n: number, verifiedAt = "2026-11-05T00:00:00.000Z") {
  const ins = w.d1.sqlite.prepare("INSERT INTO members (discord_user_id, accm_user_id, referring_ib_line_id, tier, vip_above_min, vip_verified_at, is_sub_ib) VALUES (?, ?, 2, 'vip', 'yes', ?, ?)");
  const ids: string[] = [];
  for (let k = 0; k < n; k++) {
    const id = `8000000000000${String(k).padStart(5, "0")}`;
    ins.run(id, String(100000 + k), verifiedAt, k === 0 ? 1 : 0); // member 0 is a VIP IB (Sub-IB)
    w.fake.members.set(id, k === 0 ? [IDS.freeRole, IDS.vipRole, IDS.subIbRole] : [IDS.freeRole, IDS.vipRole]);
    ids.push(id);
  }
  return ids;
}

describe("7-day-before reminder", () => {
  it("DMs every VIP (incl. VIP IBs) once, batched under the subrequest budget, idempotent per YYYY-MM", async () => {
    const w = world("2026-11-23T15:00:00.000Z"); // Nov 23 23:00 Manila: too early
    const ids = seedVips(w, 30);
    expect((await runCron(w.deps)).reminders).toBe(0);
    w.clock.now = new Date("2026-11-23T16:05:00.000Z"); // Nov 24 00:05 Manila
    let total = 0;
    for (let t = 0; t < 10; t++) {
      const before = w.fake.requestCount + w.d1.queries;
      const s = await runCron(w.deps);
      expect(s.used).toBeLessThanOrEqual(CRON_BUDGET);
      expect(w.fake.requestCount + w.d1.queries - before).toBeLessThan(50);
      total += s.reminders;
      advance(w, 5 * 60 * 1000);
    }
    expect(total).toBe(30);
    for (const id of ids) expect(w.fake.dms.get(id)).toEqual([SPEC_REMINDER]);
    expect(w.d1.one("SELECT status, processed FROM cron_runs WHERE job = 'vip_reminder' AND period_key = '2026-12'")).toEqual({ status: "done", processed: 30 });
    expect(w.fake.messagesIn(IDS.adminLog).filter((m) => m.content.includes("VIP REMINDER 2026-12"))).toHaveLength(1);
  });
});

describe("1st-of-month VIP reset", () => {
  it("removes only VIP (keeps FREE + Sub-IB, includes VIP IBs), sets tier free / vip_above_min NULL, DMs reset copy, batched + idempotent", async () => {
    const w = world("2026-11-30T15:59:00.000Z"); // Nov 30 23:59 Manila
    const ids = seedVips(w, 25);
    // Reverified inside the window (Nov 26): counts for December, not reset.
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, tier, vip_above_min, vip_verified_at) VALUES ('${IDS.member2}', 'vip', 'yes', '2026-11-26T02:00:00.000Z')`);
    w.fake.members.set(IDS.member2, [IDS.freeRole, IDS.vipRole]);
    // Member who left the server: DB reset, no DM.
    w.d1.sqlite.exec(`INSERT INTO members (discord_user_id, tier, vip_above_min, vip_verified_at) VALUES ('${IDS.outsider}', 'vip', 'yes', '2026-11-02T00:00:00.000Z')`);
    // Mark the reminder done so this test only measures the reset.
    w.d1.sqlite.exec(`INSERT INTO cron_runs (job, period_key, status) VALUES ('vip_reminder', '2026-12', 'done')`);

    expect((await runCron(w.deps)).reset).toBe(0); // not yet the 1st
    w.clock.now = new Date("2026-11-30T16:05:00.000Z"); // Dec 1 00:05 Manila
    let ticks = 0;
    for (; ticks < 20; ticks++) {
      const s = await runCron(w.deps);
      expect(s.used).toBeLessThanOrEqual(CRON_BUDGET);
      if (w.d1.one<{ status: string }>("SELECT status FROM cron_runs WHERE job = 'vip_reset' AND period_key = '2026-12'").status === "done") break;
      advance(w, 5 * 60 * 1000);
    }
    expect(ticks).toBeGreaterThan(1); // spans several ticks (batched)
    for (const id of ids) {
      expect(w.fake.members.get(id)).not.toContain(IDS.vipRole);
      expect(w.fake.members.get(id)).toContain(IDS.freeRole);
      expect(w.fake.dms.get(id)).toEqual([SPEC_RESET_DAY]);
    }
    expect(w.fake.members.get(ids[0]!)).toContain(IDS.subIbRole); // VIP IB keeps Sub-IB
    expect(w.d1.one<{ n: number }>(`SELECT count(*) n FROM members WHERE tier = 'vip' AND discord_user_id <> '${IDS.member2}'`).n).toBe(0);
    expect(w.d1.one(`SELECT tier, vip_above_min, is_sub_ib FROM members WHERE discord_user_id = ?`, ids[0])).toEqual({ tier: "free", vip_above_min: null, is_sub_ib: 1 });
    expect(w.fake.members.get(IDS.member2)).toContain(IDS.vipRole); // reverified in the window
    expect(w.fake.dms.get(IDS.outsider)).toBeUndefined();
    expect(w.d1.one(`SELECT dm_status FROM decision_logs WHERE action = 'vip_reset' AND target_discord_id = ?`, IDS.outsider)).toEqual({ dm_status: "skipped" });
    const done = w.fake.messagesIn(IDS.adminLog).filter((m) => m.content.includes("VIP RESET 2026-12"));
    expect(done.map((m) => m.content.includes("done"))).toEqual([false, true]);

    // Idempotent: later ticks this month do nothing.
    const dmsBefore = [...w.fake.dms.values()].flat().length;
    advance(w, 60 * 60 * 1000);
    expect((await runCron(w.deps)).reset).toBe(0);
    expect([...w.fake.dms.values()].flat().length).toBe(dmsBefore);
  });

  it("does not start mid-month (first deploy on the 22nd never wipes VIP)", async () => {
    const w = world("2026-11-22T06:00:00.000Z");
    seedVips(w, 3);
    await runCron(w.deps);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM members WHERE tier = 'vip'").n).toBe(3);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM cron_runs").n).toBe(0);
  });

  it("stops on a Discord 429 and resumes next tick without double-processing", async () => {
    const w = world("2026-11-30T16:05:00.000Z");
    const ids = seedVips(w, 6);
    w.d1.sqlite.exec(`INSERT INTO cron_runs (job, period_key, status) VALUES ('vip_reminder', '2026-12', 'done')`);
    w.fake.rateLimitAfter = 3; // admin-log start + 2 role removals, then 429
    await runCron(w.deps);
    const resetSoFar = w.d1.one<{ n: number }>("SELECT count(*) n FROM members WHERE tier = 'free'").n;
    expect(resetSoFar).toBeLessThan(6);
    w.fake.rateLimitAfter = Number.POSITIVE_INFINITY;
    for (let t = 0; t < 5; t++) {
      advance(w, 5 * 60 * 1000);
      await runCron(w.deps);
    }
    for (const id of ids) expect(w.fake.dms.get(id)).toEqual([SPEC_RESET_DAY]);
    expect(w.d1.one<{ n: number }>("SELECT count(*) n FROM decision_logs WHERE action = 'vip_reset'").n).toBe(6);
  });
});
