import { describe, expect, it } from "vitest";
import { APPROVE_DM, APPROVER_GUIDANCE, IB_DISCLOSURE, MSG } from "../src/copy";
import { expireStale, handleInteraction, LIMITS, maintenance, purgeOldLogs, rateDecision, retentionCutoff, retryLeftoverCards } from "../src/handlers";
import type { RequestRow } from "../src/types";
import { button, CDN_URL, harness, IDS, infoSubmit, member, nextId, rejectSubmit, uploadSubmit } from "./helpers";

/** Insert a row directly into the fake DB. */
function seed(h: ReturnType<typeof harness>, over: Partial<RequestRow>): RequestRow {
  const decided = over.status !== undefined && over.status !== "pending";
  const row: RequestRow = {
    request_id: crypto.randomUUID(),
    guild_id: IDS.guild,
    member_id: nextId(),
    status: "pending",
    admin_id: null,
    reason_code: null,
    flags: [],
    approval_message_id: null,
    log_message_id: null,
    card_alert_at: null,
    card_tried_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    decided_at: decided ? "2026-10-02T00:00:00.000Z" : null,
    ...over,
  };
  h.sb.rows.push(row);
  return row;
}

async function submit(h: ReturnType<typeof harness>, memberId = IDS.member) {
  const i = uploadSubmit(memberId);
  const resp = handleInteraction(i, h.deps, h.ctx) as { type: number };
  await h.flush();
  return { i, resp };
}

const editedAck = (h: ReturnType<typeof harness>) =>
  h.dc.find("PATCH", /^\/webhooks\/\d+\/[^/]+\/messages\/@original$/).map((c) => (c.json as { content: string }).content);

describe("start: /verify-deposit and the panel button", () => {
  it("opens the upload modal (privacy notice above the file field) in #verify", () => {
    const h = harness();
    const cmd = { id: nextId(), application_id: IDS.app, type: 2, token: "t", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member), data: { name: "verify-deposit" } };
    const r = handleInteraction(cmd, h.deps, h.ctx) as { type: number; data: { components: Array<{ type: number }> } };
    expect(r.type).toBe(9);
    expect(r.data.components[0]!.type).toBe(10);
    expect(r.data.components[1]!.type).toBe(18);
    const btn = { ...cmd, type: 3, data: { custom_id: "vip:start" } };
    expect((handleInteraction(btn, h.deps, h.ctx) as { type: number }).type).toBe(9);
  });

  it("tells existing VIPs they're already VIP (no modal, nothing forwarded)", () => {
    const h = harness();
    const cmd = { id: nextId(), application_id: IDS.app, type: 2, token: "t", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member, [IDS.vip]), data: { name: "verify-deposit" } };
    const r = handleInteraction(cmd, h.deps, h.ctx) as { type: number; data: { content: string; flags: number } };
    expect(r.type).toBe(4);
    expect(r.data.content).toBe(MSG.alreadyVip);
    expect(r.data.flags).toBe(64);
  });

  it("only works in #verify", () => {
    const h = harness();
    const cmd = { id: nextId(), application_id: IDS.app, type: 2, token: "t", guild_id: IDS.guild, channel_id: IDS.approvals, member: member(IDS.member), data: { name: "verify-deposit" } };
    expect((handleInteraction(cmd, h.deps, h.ctx) as { type: number }).type).toBe(4);
  });
});

describe("submit screenshot", () => {
  it("defers (type 5, ephemeral), re-uploads bytes to #vip-approvals with buttons, stores only ids", async () => {
    const h = harness();
    const { i, resp } = await submit(h);
    expect(resp).toEqual({ type: 5, data: { flags: 64 } });
    const uploads = h.dc.calls.filter((c) => c.form);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.path).toBe(`/channels/${IDS.approvals}/messages`);
    expect(uploads[0]!.fileBytes).toBeGreaterThan(0);
    const payload = uploads[0]!.json as { content: string; attachments: Array<{ filename: string }>; components: Array<{ components: Array<{ custom_id: string }> }> };
    expect(payload.attachments[0]!.filename).toBe(`vip-${i.id}.png`); // member's filename (may contain a name) is dropped
    expect(payload.content).not.toContain("cdn.discordapp.com");
    expect(payload.components[0]!.components.map((b) => b.custom_id)).toEqual([`vip:approve:${i.id}`, `vip:info:${i.id}`, `vip:reject:${i.id}`]);
    expect(payload.content).toContain(APPROVER_GUIDANCE);
    expect(h.sb.rows).toHaveLength(1);
    expect(h.sb.rows[0]).toMatchObject({ request_id: i.id, member_id: IDS.member, status: "pending" });
    // Nothing sent to Supabase contains an image URL, filename or bytes.
    for (const b of h.sb.bodies) expect(b).not.toMatch(/cdn|discordapp|\.png|Juan/);
    expect(editedAck(h)).toEqual([MSG.received]);
  });

  it("rejects non-images / too-big files immediately (no download)", () => {
    const h = harness();
    const pdf = uploadSubmit(IDS.member, {}, { content_type: "application/pdf" });
    expect((handleInteraction(pdf, h.deps, h.ctx) as { data: { content: string } }).data.content).toMatch(/Images only/);
    const big = uploadSubmit(IDS.member, {}, { size: 50 * 1024 * 1024 });
    expect((handleInteraction(big, h.deps, h.ctx) as { data: { content: string } }).data.content).toMatch(/Images only/);
    const offCdn = uploadSubmit(IDS.member, {}, { url: "https://evil.example/x.png" });
    expect((handleInteraction(offCdn, h.deps, h.ctx) as { data: { content: string } }).data.content).toBe(MSG.error);
    expect(h.cdnFetches).toHaveLength(0);
  });

  it("rejects a renamed non-image after sniffing bytes, and creates no request", async () => {
    const h = harness({ cdnBytes: new TextEncoder().encode("%PDF-1.7 not an image") });
    await submit(h);
    expect(h.dc.calls.filter((c) => c.form)).toHaveLength(0);
    expect(h.sb.rows).toHaveLength(0);
    expect(editedAck(h)[0]).toMatch(/Images only/);
  });

  it("one pending request per member", async () => {
    const h = harness();
    await submit(h);
    await submit(h);
    expect(h.sb.rows).toHaveLength(1);
    expect(editedAck(h)).toEqual([MSG.received, MSG.pending]);
  });

  it("re-upload failure: no request is created and the member is asked to retry", async () => {
    const h = harness();
    h.dc.failUpload = true;
    await submit(h);
    expect(h.sb.rows).toHaveLength(0);
    expect(editedAck(h)).toEqual([MSG.error]);
  });

  it("10-min cooldown after a rejection and max 5 per 24 h", () => {
    const now = new Date("2026-10-18T04:00:00Z");
    const r = (status: "rejected" | "approved" | "pending", minsAgo: number) => ({
      status,
      created_at: new Date(now.getTime() - minsAgo * 60000).toISOString(),
      decided_at: status === "pending" ? null : new Date(now.getTime() - minsAgo * 60000).toISOString(),
    });
    expect(rateDecision([], now)).toBe("ok");
    expect(rateDecision([r("rejected", 5)], now)).toBe("cooldown");
    expect(rateDecision([r("rejected", 11)], now)).toBe("ok");
    expect(rateDecision([r("pending", 1)], now)).toBe("pending");
    expect(rateDecision([1, 2, 3, 4, 5].map((m) => r("rejected", 60 * m)), now)).toBe("daily_cap");
  });
});

describe("approve", () => {
  it("assigns @VIP, DMs the member, deletes the card, logs one line", async () => {
    const h = harness();
    const { i } = await submit(h);
    const cardId = h.sb.rows[0]!.approval_message_id!;
    const resp = handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    expect(resp).toEqual({ type: 6 });
    await h.flush();
    expect(h.dc.find("PUT", new RegExp(`/members/${IDS.member}/roles/${IDS.vip}$`))).toHaveLength(1);
    const dm = h.dc.find("POST", new RegExp(`/channels/${IDS.dmChannel}/messages`));
    expect((dm[0]!.json as { content: string }).content).toBe(APPROVE_DM);
    expect(h.dc.find("DELETE", new RegExp(`/channels/${IDS.approvals}/messages/${cardId}$`))).toHaveLength(1);
    const logs = h.dc.find("POST", new RegExp(`/channels/${IDS.logs}/messages$`));
    expect(logs).toHaveLength(1);
    expect((logs[0]!.json as { content: string }).content).toMatch(new RegExp(`member ${IDS.member} · admin ${IDS.admin} · approved`));
    expect(h.sb.rows[0]).toMatchObject({ status: "approved", admin_id: IDS.admin, approval_message_id: null, flags: [] });
  });

  it("is idempotent: double-click / two admins at once → one role add, one DM, loser told who decided", async () => {
    const h = harness();
    const { i } = await submit(h);
    handleInteraction(button(`vip:approve:${i.id}`, IDS.admin), h.deps, h.ctx);
    handleInteraction(button(`vip:approve:${i.id}`, IDS.admin2), h.deps, h.ctx);
    handleInteraction(button(`vip:approve:${i.id}`, IDS.admin), h.deps, h.ctx);
    await h.flush();
    expect(h.dc.find("PUT", /\/roles\//)).toHaveLength(1);
    expect(h.dc.find("POST", new RegExp(`/channels/${IDS.dmChannel}/messages`))).toHaveLength(1);
    expect(h.dc.find("POST", new RegExp(`/channels/${IDS.logs}/messages$`))).toHaveLength(1);
    const followups = h.dc.find("POST", /^\/webhooks\/\d+\/[^/]+$/).map((c) => (c.json as { content: string; flags: number }));
    expect(followups.length).toBe(2);
    for (const f of followups) {
      expect(f.flags).toBe(64);
      expect(f.content).toMatch(/Na-decide na/);
    }
  });

  it("non-admins (incl. Manage Roles / Administrator without the admin role) get an ephemeral refusal on all 3 buttons", async () => {
    const h = harness();
    const { i } = await submit(h);
    for (const perms of ["0", String(1n << 28n), String(1n << 3n)]) {
      for (const action of ["approve", "info", "reject"]) {
        const r = handleInteraction(button(`vip:${action}:${i.id}`, IDS.admin2, perms, {}, []), h.deps, h.ctx) as { type: number; data: { content: string } };
        expect(r.type).toBe(4);
        expect(r.data.content).toBe(MSG.notAdmin);
      }
    }
    const r2 = handleInteraction({ ...infoSubmit(i.id, "more pls", IDS.admin2), member: member(IDS.admin2, [], String(1n << 3n)) }, h.deps, h.ctx) as { data: { content: string } };
    expect(r2.data.content).toBe(MSG.notAdmin);
    await h.flush();
    expect(h.sb.rows[0]!.status).toBe("pending");
    expect(h.dc.find("PUT", /\/roles\//)).toHaveLength(0);
  });

  it("admins can't decide their own request", async () => {
    const h = harness();
    const { i } = await submit(h, IDS.admin);
    handleInteraction(button(`vip:approve:${i.id}`, IDS.admin), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]!.status).toBe("pending");
    expect(h.dc.find("PUT", /\/roles\//)).toHaveLength(0);
  });

  it("DMs closed (50007): decision applies, #verify gets a no-details notice, log flag dm_failed", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.dmClosed = true;
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    const notice = h.dc.find("POST", new RegExp(`/channels/${IDS.verify}/messages$`));
    expect(notice).toHaveLength(1);
    const n = notice[0]!.json as { content: string; allowed_mentions: { users: string[] } };
    expect(n.content).toContain(`<@${IDS.member}>`);
    expect(n.content).not.toMatch(/approved|rejected|deposit/i);
    expect(n.allowed_mentions.users).toEqual([IDS.member]);
    expect(h.sb.rows[0]).toMatchObject({ status: "approved", flags: ["dm_failed"] });
  });

  it("already VIP: no role PUT, flag already_vip", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.memberRoles = [IDS.vip];
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    expect(h.dc.find("PUT", /\/roles\//)).toHaveLength(0);
    expect(h.sb.rows[0]!.flags).toEqual(["already_vip"]);
  });

  it("member left: no DM, card deleted, flag member_left", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.memberRoles = null;
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    expect(h.dc.find("POST", /\/users\/@me\/channels/)).toHaveLength(0);
    expect(h.dc.find("DELETE", /\/messages\//)).toHaveLength(1);
    expect(h.sb.rows[0]!.flags).toEqual(["member_left"]);
  });

  it("role hierarchy error (50013): reverts to pending, re-enables buttons, alerts admins, keeps the card", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.roleHierarchyBroken = true;
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]).toMatchObject({ status: "pending", admin_id: null, decided_at: null });
    expect(h.dc.find("DELETE", /\/messages\//)).toHaveLength(0);
    const alerts = h.dc.find("POST", new RegExp(`/channels/${IDS.approvals}/messages$`)).filter((c) => !c.form);
    expect((alerts[0]!.json as { content: string }).content).toBe(MSG.hierarchy);
    // Fixed hierarchy → retry works.
    h.dc.roleHierarchyBroken = false;
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]!.status).toBe("approved");
  });
});

describe("reject", () => {
  it("opens a reason modal, then DMs the reason + note, deletes the card, stores only the reason code", async () => {
    const h = harness();
    const { i } = await submit(h);
    const modal = handleInteraction(button(`vip:reject:${i.id}`), h.deps, h.ctx) as { type: number; data: { custom_id: string } };
    expect(modal.type).toBe(9);
    expect(modal.data.custom_id).toBe(`vip:rejectmodal:${i.id}`);
    const r = handleInteraction(rejectSubmit(i.id, "unclear", "Paki-crop nang mas malinaw @everyone"), h.deps, h.ctx);
    expect(r).toEqual({ type: 6 });
    await h.flush();
    const dm = h.dc.find("POST", new RegExp(`/channels/${IDS.dmChannel}/messages`))[0]!.json as { content: string };
    expect(dm.content).toMatch(/blurry o naka-crop/);
    expect(dm.content).toContain(IB_DISCLOSURE);
    expect(dm.content).toMatch(/Note from the admin: Paki-crop/);
    expect(dm.content).not.toContain("@everyone");
    expect(h.sb.rows[0]).toMatchObject({ status: "rejected", reason_code: "unclear", admin_id: IDS.admin });
    for (const b of h.sb.bodies) expect(b).not.toContain("Paki-crop"); // note is never stored
    expect(h.dc.find("DELETE", /\/messages\//)).toHaveLength(1);
  });

  it("unknown reason codes fall back to 'other'", async () => {
    const h = harness();
    const { i } = await submit(h);
    handleInteraction(rejectSubmit(i.id, "drop table"), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]!.reason_code).toBe("other");
  });

  it("approve after reject is a no-op", async () => {
    const h = harness();
    const { i } = await submit(h);
    handleInteraction(rejectSubmit(i.id, "wrong_screen"), h.deps, h.ctx);
    await h.flush();
    handleInteraction(button(`vip:approve:${i.id}`, IDS.admin2), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]!.status).toBe("rejected");
    expect(h.dc.find("PUT", /\/roles\//)).toHaveLength(0);
  });
});

describe("need more info", () => {
  it("opens a note form, DMs a Taglish request with the note + how to resubmit + IB line, sets needs_info, logs it", async () => {
    const h = harness();
    const { i } = await submit(h);
    const modal = handleInteraction(button(`vip:info:${i.id}`), h.deps, h.ctx) as { type: number; data: { custom_id: string } };
    expect(modal.type).toBe(9);
    expect(modal.data.custom_id).toBe(`vip:infomodal:${i.id}`);
    expect(handleInteraction(infoSubmit(i.id, "Pakita ang ACCM User ID sa screenshot"), h.deps, h.ctx)).toEqual({ type: 6 });
    await h.flush();
    const dm = (h.dc.find("POST", new RegExp(`/channels/${IDS.dmChannel}/messages`))[0]!.json as { content: string }).content;
    expect(dm).toMatch(/Kailangan pa namin ng konting info/);
    expect(dm).toMatch(/Note from the admin: Pakita ang ACCM User ID/);
    expect(dm).toMatch(/\/verify-deposit/);
    expect(dm).toContain(IB_DISCLOSURE);
    expect(h.sb.rows[0]).toMatchObject({ status: "needs_info", admin_id: IDS.admin, reason_code: null, approval_message_id: null });
    for (const b of h.sb.bodies) expect(b).not.toContain("Pakita"); // note never stored
    const logs = h.dc.find("POST", new RegExp(`/channels/${IDS.logs}/messages$`));
    expect((logs[0]!.json as { content: string }).content).toMatch(/needs_info/);
    expect(h.dc.find("DELETE", new RegExp(`/channels/${IDS.approvals}/messages/`))).toHaveLength(1);
    expect(h.dc.find("PUT", /\/roles\//)).toHaveLength(0);
  });

  it("lets the member resubmit right away (no cooldown)", async () => {
    const h = harness();
    const { i } = await submit(h);
    handleInteraction(infoSubmit(i.id, "clearer screenshot please"), h.deps, h.ctx);
    await h.flush();
    await submit(h);
    expect(h.sb.rows.filter((r) => r.status === "pending")).toHaveLength(1);
  });

  it("closed DMs → no-details #verify mention + /verify-status explains", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.dmClosed = true;
    handleInteraction(infoSubmit(i.id, "clearer screenshot please"), h.deps, h.ctx);
    await h.flush();
    expect(h.dc.find("POST", new RegExp(`/channels/${IDS.verify}/messages$`))).toHaveLength(1);
    expect(h.sb.rows[0]!.flags).toEqual(["dm_failed"]);
    const cmd = { id: nextId(), application_id: IDS.app, type: 2, token: "tok-s", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member), data: { name: "verify-status" } };
    handleInteraction(cmd, h.deps, h.ctx);
    await h.flush();
    expect(editedAck(h).at(-1)).toMatch(/needs more info/);
  });

  it("self need-more-info is blocked", async () => {
    const h = harness();
    const { i } = await submit(h, IDS.admin);
    handleInteraction(infoSubmit(i.id, "x".repeat(10), IDS.admin), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]!.status).toBe("pending");
  });
});

describe("12-month retention purge", () => {
  it("deletes log rows older than 12 months and their #vip-log mirror messages; keeps newer rows", async () => {
    const h = harness({ now: new Date("2025-09-01T00:00:00Z") });
    const { i: oldReq } = await submit(h);
    handleInteraction(button(`vip:approve:${oldReq.id}`), h.deps, h.ctx);
    await h.flush();
    const oldLogId = h.sb.rows[0]!.log_message_id;
    expect(oldLogId).toMatch(/^\d+$/);
    h.setNow(new Date("2026-10-01T00:00:00Z"));
    const { i: newReq } = await submit(h, IDS.admin2);
    handleInteraction(rejectSubmit(newReq.id, "unclear"), h.deps, h.ctx);
    await h.flush();
    expect(await purgeOldLogs(h.deps)).toBe(1);
    expect(h.sb.rows.map((r) => r.request_id)).toEqual([newReq.id]);
    expect(h.dc.find("DELETE", new RegExp(`/channels/${IDS.logs}/messages/${oldLogId}$`))).toHaveLength(1);
    expect(await purgeOldLogs(h.deps)).toBe(0); // idempotent
  });

  it("never purges pending rows and never removes @VIP", async () => {
    const h = harness({ now: new Date("2025-01-01T00:00:00Z") });
    await submit(h);
    h.setNow(new Date("2026-10-01T00:00:00Z"));
    // maintenance first expires the stale pending row (7 days), which is then only purged 12 months after its decision
    await maintenance(h.deps);
    expect(h.sb.rows[0]!.status).toBe("expired");
    expect(h.dc.calls.filter((c) => /\/roles\//.test(c.path) && c.method !== "PUT")).toHaveLength(0);
    expect(h.dc.calls.filter((c) => c.method === "DELETE" && /\/members\//.test(c.path))).toHaveLength(0);
  });

  it("cutoff is 12 calendar months", () => {
    expect(retentionCutoff(new Date("2026-10-18T04:00:00Z")).toISOString()).toBe("2025-10-18T04:00:00.000Z");
  });

  it("keeps the row when deleting its #vip-log line fails (non-404) and retries next run", async () => {
    const h = harness({ now: new Date("2025-09-01T00:00:00Z") });
    const { i } = await submit(h);
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    h.setNow(new Date("2026-10-01T00:00:00Z"));
    h.dc.logDeleteFails = true;
    expect(await purgeOldLogs(h.deps)).toBe(0);
    expect(h.sb.rows).toHaveLength(1);
    h.dc.logDeleteFails = false;
    expect(await purgeOldLogs(h.deps)).toBe(1);
    expect(h.sb.rows).toHaveLength(0);
  });
});

describe("leftover approval card (screenshot) when the card delete fails", () => {
  const alerts = (h: ReturnType<typeof harness>) =>
    h.dc.find("POST", new RegExp(`/channels/${IDS.logs}/messages$`)).map((c) => (c.json as { content: string }).content).filter((t) => t.startsWith("⚠️"));

  it("delete fails once → approve keeps the card id + alerts #vip-log once with a link → cron retries and deletes it", async () => {
    const h = harness();
    const { i } = await submit(h);
    const cardId = h.sb.rows[0]!.approval_message_id!;
    h.dc.cardDeleteFailures = 1;
    handleInteraction(button(`vip:approve:${i.id}`), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]).toMatchObject({ status: "approved", approval_message_id: cardId });
    expect(h.sb.rows[0]!.card_alert_at).not.toBeNull();
    const a = alerts(h);
    expect(a).toHaveLength(1);
    expect(a[0]).toContain(`https://discord.com/channels/${IDS.guild}/${IDS.approvals}/${cardId}`);
    expect(a[0]).not.toContain(IDS.member); // no member details in the alert

    expect(await retryLeftoverCards(h.deps)).toBe(1);
    expect(h.sb.rows[0]!.approval_message_id).toBeNull();
    expect(h.dc.find("DELETE", new RegExp(`/channels/${IDS.approvals}/messages/${cardId}$`))).toHaveLength(2);
    expect(alerts(h)).toHaveLength(1);
    expect(await retryLeftoverCards(h.deps)).toBe(0); // nothing left
  });

  it("keeps retrying hourly while it fails, but alerts only once per card; a 404 counts as gone", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.cardDeleteFailures = 99;
    handleInteraction(rejectSubmit(i.id, "too_old"), h.deps, h.ctx);
    await h.flush();
    await maintenance(h.deps);
    await maintenance(h.deps);
    expect(alerts(h)).toHaveLength(1);
    expect(h.sb.rows[0]!.approval_message_id).not.toBeNull();
    // purge skips rows with a leftover card
    h.setNow(new Date("2028-01-01T00:00:00Z"));
    expect(await purgeOldLogs(h.deps)).toBe(0);
    h.dc.cardDeleteFailures = 0; // card now deletable (fake returns 204; real 404 is also treated as success)
    await maintenance(h.deps);
    expect(h.sb.rows.length === 0 || h.sb.rows[0]!.approval_message_id === null).toBe(true);
    expect(alerts(h)).toHaveLength(1);
  });

  it("needs_info rows are retried too", async () => {
    const h = harness();
    const { i } = await submit(h);
    h.dc.cardDeleteFailures = 1;
    handleInteraction(infoSubmit(i.id, "clearer please"), h.deps, h.ctx);
    await h.flush();
    expect(h.sb.rows[0]!.approval_message_id).not.toBeNull();
    expect(await retryLeftoverCards(h.deps)).toBe(1);
    expect(h.sb.rows[0]!.approval_message_id).toBeNull();
  });
});

describe("cron subrequest budget (Workers Free: 50 per invocation)", () => {
  it("worst-case run makes at most 48 real fetch calls", async () => {
    const h = harness();
    // More work than the caps allow, every card delete failing (each needs an alert):
    for (let k = 0; k < 6; k++) seed(h, { approval_message_id: nextId(), created_at: "2026-10-01T00:00:00.000Z" }); // stale pending
    for (let k = 0; k < 6; k++) seed(h, { status: "rejected", reason_code: "unclear", approval_message_id: nextId() }); // leftover cards
    for (let k = 0; k < 20; k++) seed(h, { status: "approved", log_message_id: nextId(), decided_at: "2025-01-01T00:00:00.000Z" }); // purge
    h.dc.cardDeleteFailures = 999;
    h.counter.fetches = 0;
    await maintenance(h.deps);
    expect(h.counter.fetches).toBeLessThanOrEqual(48);
    expect(h.counter.fetches).toBe(48); // 21 expiry + 13 card retry + 14 purge
  });

  it("on a 429 the cron does not retry in-request: it stops and leaves the rest for the next run", async () => {
    const h = harness();
    for (let k = 0; k < 3; k++) seed(h, { approval_message_id: nextId() });
    seed(h, { status: "rejected", reason_code: "unclear", approval_message_id: nextId() });
    seed(h, { status: "approved", log_message_id: nextId(), decided_at: "2025-01-01T00:00:00.000Z" });
    h.dc.rateLimitNext = 1;
    await maintenance(h.deps);
    expect(h.dc.calls).toHaveLength(1); // the 429'd card delete; no retry, no further Discord calls
    expect(h.sb.rows.filter((r) => r.status === "expired")).toHaveLength(1);
    expect(h.sb.rows.filter((r) => r.status === "pending")).toHaveLength(2);
    expect(h.sb.rows.every((r) => r.card_alert_at === null)).toBe(true); // a 429 is not an alert
    expect(h.sb.rows).toHaveLength(5); // purge row kept
    // Next run (not rate-limited) finishes the work.
    await maintenance(h.deps);
    expect(h.sb.rows.filter((r) => r.status === "pending")).toHaveLength(0);
    expect(h.sb.rows.every((r) => r.approval_message_id === null)).toBe(true);
    expect(h.sb.rows).toHaveLength(4);
  });
});

describe("leftover-card retry rotation", () => {
  it("8 cards, the 4 oldest always 403: after enough runs all 8 have been tried and the newer 4 deleted", async () => {
    const h = harness();
    const cards = Array.from({ length: 8 }, (_, k) =>
      seed(h, { status: "approved", approval_message_id: nextId(), decided_at: `2026-10-0${k + 1}T00:00:00.000Z` }),
    );
    const ids = cards.map((c) => c.approval_message_id!);
    ids.slice(0, 4).forEach((id) => h.dc.cardDeleteFailIds.add(id));
    const tried = new Set<string>();
    for (let run = 0; run < 3; run++) {
      h.setNow(new Date(Date.UTC(2026, 9, 18, 4 + run)));
      await retryLeftoverCards(h.deps);
      h.dc.find("DELETE", new RegExp(`^/channels/${IDS.approvals}/messages/`)).forEach((c) => tried.add(c.path.split("/").pop()!));
    }
    expect([...tried].sort()).toEqual([...ids].sort());
    expect(cards.slice(4).every((c) => c.approval_message_id === null)).toBe(true);
    expect(cards.slice(0, 4).every((c) => c.approval_message_id !== null && c.card_tried_at !== null)).toBe(true);
    // One alert per failing card, not per run.
    const alerts = h.dc.find("POST", new RegExp(`/channels/${IDS.logs}/messages$`)).filter((c) => (c.json as { content: string }).content.startsWith("⚠️"));
    expect(alerts).toHaveLength(4);
  });
});

describe("cron expiry", () => {
  it("expires pending requests older than 7 days and deletes their cards", async () => {
    const h = harness({ now: new Date("2026-10-01T00:00:00Z") });
    await submit(h);
    h.setNow(new Date("2026-10-09T00:00:00Z"));
    expect(await expireStale(h.deps)).toBe(1);
    expect(h.sb.rows[0]).toMatchObject({ status: "expired", admin_id: null, approval_message_id: null });
    expect(h.dc.find("DELETE", /\/messages\//)).toHaveLength(1);
  });
});

describe("/verify-status", () => {
  it("answers ephemerally with the latest status", async () => {
    const h = harness();
    await submit(h);
    const cmd = { id: nextId(), application_id: IDS.app, type: 2, token: "tok-status", guild_id: IDS.guild, channel_id: IDS.verify, member: member(IDS.member), data: { name: "verify-status" } };
    expect(handleInteraction(cmd, h.deps, h.ctx)).toEqual({ type: 5, data: { flags: 64 } });
    await h.flush();
    expect(editedAck(h).at(-1)).toMatch(/Pending/);
  });
});

void CDN_URL;
