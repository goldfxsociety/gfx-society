import { describe, expect, it } from "vitest";
import { Perm } from "../src/discord";
import {
  BASE_ROLES,
  ChannelType,
  executePlan,
  type GuildRole,
  knownGuildState,
  permissionMatrix,
  planSetup,
  resolveOverwrites,
  roleOrderWarnings,
  type SetupApi,
  type SetupIds,
} from "../src/setup";

const ids: SetupIds = {
  guildId: "1572501982944559124",
  botUserId: "1573941065491152956",
  coachMikeUserIds: ["1317701669768925188", "1417055027121619004"],
  benUserId: "502826848812531712",
};

describe("setup-server --dry-run plan", () => {
  const plan = planSetup(knownGuildState(ids.guildId, ids.botUserId), ids);
  const matrix = Object.fromEntries(permissionMatrix(plan).map((m) => [m.channel, m]));

  it("creates every spec role and channel from scratch; the managed 'UU Bot' role is untouched", () => {
    expect(plan.roles.map((r) => [r.name, r.action])).toEqual(BASE_ROLES.map((n) => [n, "create"]));
    expect(BASE_ROLES).toEqual(["Unverified", "FREE", "VIP", "Sub-IB", "Coach", "Admin / Mod", "Line: Coach Mike", "Line: GFX"]);
    expect(plan.roles.some((r) => r.name === "UU Bot")).toBe(false);
    expect(plan.channels.map((c) => c.name)).toEqual([
      "start-here", "verify", "education", "community", "market-talk", "pro-indicator", "ai-signals", "sub-ib-leaders", "admin-log", "review-coach-mike", "review-gfx",
    ]);
    expect(plan.channels.every((c) => c.action === "create")).toBe(true);
  });

  it("existing default categories/channels are left in place and View is denied for @everyone + Unverified", () => {
    expect(plan.lockExisting.map((l) => l.name).sort()).toEqual(["General", "Text Channels", "Voice Channels", "general"].sort());
    for (const l of plan.lockExisting) {
      expect(l.access).toEqual([
        { target: { kind: "everyone" }, allow: "0", deny: (1n << 10n).toString() },
        { target: { kind: "role", name: "Unverified" }, allow: "0", deny: (1n << 10n).toString() },
      ]);
    }
    // Nothing in the plan deletes or renames them.
    expect(JSON.stringify(plan)).not.toMatch(/delete|rename/i);
  });

  it("Unverified sees ONLY #start-here and #verify", () => {
    const seen = Object.values(matrix).filter((m) => m.viewers.includes("Unverified") || m.viewers.includes("@everyone")).map((m) => m.channel);
    expect(seen).toEqual(["#start-here", "#verify"]);
  });

  it("permission matrix matches the spec", () => {
    expect(matrix["#verify"]!.viewers).toEqual(expect.arrayContaining(["Unverified", "FREE", "VIP"]));
    expect(matrix["#verify"]!.writers).toEqual(["bot"]); // buttons only
    for (const ch of ["#education", "#community", "#market-talk"]) {
      expect(matrix[ch]!.viewers).toEqual(expect.arrayContaining(["FREE", "VIP"]));
      expect(matrix[ch]!.viewers).not.toContain("Unverified");
    }
    for (const ch of ["#pro-indicator", "#ai-signals"]) {
      expect(matrix[ch]!.viewers).toContain("VIP");
      expect(matrix[ch]!.viewers).not.toContain("FREE");
      expect(plan.channels.find((c) => `#${c.name}` === ch)!.topic).toBe("Education lang, not financial advice. Max 1% risk per trade.");
    }
    expect(matrix["#sub-ib-leaders"]!.viewers.sort()).toEqual(["Admin / Mod", "Coach", "Sub-IB", "bot"].sort());
    expect(matrix["#admin-log"]!.viewers.sort()).toEqual(["Admin / Mod", "bot"]);
    expect(matrix["#review-coach-mike"]!.viewers.sort()).toEqual(["Admin / Mod", "Coach", "bot", "user:1317701669768925188", "user:1417055027121619004"].sort());
    expect(matrix["#review-gfx"]!.viewers.sort()).toEqual(["Admin / Mod", "Coach", "bot", "user:502826848812531712"].sort());
  });

  it("both Coach Mike accounts get Coach; Ben gets Admin / Mod; still ONE Coach Mike line/channel", () => {
    expect(plan.memberRoles).toEqual([
      { userId: "1317701669768925188", role: "Coach" },
      { userId: "1417055027121619004", role: "Coach" },
      { userId: "502826848812531712", role: "Admin / Mod" },
    ]);
    expect(plan.channels.filter((c) => c.name.startsWith("review-coach")).length).toBe(1);
    expect(plan.roles.filter((r) => r.name.startsWith("Line: Coach")).length).toBe(1);
  });

  it("is idempotent: a second plan against the created state creates nothing", () => {
    const state = knownGuildState(ids.guildId, ids.botUserId);
    let n = 0;
    const roles: GuildRole[] = [...state.roles, ...BASE_ROLES.map((name) => ({ id: String(900000000000000000n + BigInt(++n)), name, position: 1 }))];
    const channels = [...state.channels, ...plan.categories.map((c) => ({ id: String(910000000000000000n + BigInt(++n)), name: c.name, type: ChannelType.CATEGORY })), ...plan.channels.map((c) => ({ id: String(920000000000000000n + BigInt(++n)), name: c.name, type: ChannelType.TEXT }))];
    const again = planSetup({ roles, channels }, ids);
    expect(again.roles.every((r) => r.action === "exists")).toBe(true);
    expect(again.channels.every((c) => c.action === "exists")).toBe(true);
    expect(again.lockExisting.map((l) => l.name).sort()).toEqual(["General", "Text Channels", "Voice Channels", "general"].sort());
  });
});

describe("role order warning", () => {
  it("warns (never reorders) when 'UU Bot' sits below a role the bot must assign", () => {
    const roles: GuildRole[] = [
      { id: ids.guildId, name: "@everyone", position: 0 },
      { id: "1", name: "UU Bot", position: 2, managed: true, tags: { bot_id: ids.botUserId } },
      { id: "2", name: "FREE", position: 1 },
      { id: "3", name: "VIP", position: 3 },
      { id: "4", name: "Line: GFX", position: 4 },
    ];
    const w = roleOrderWarnings(roles, ids.botUserId);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("'UU Bot' sits below");
    expect(w[0]).toContain("VIP, Line: GFX");
    expect(w[0]).not.toContain("FREE,");
    expect(w[0]).toContain("drag 'UU Bot' ABOVE");
    expect(roleOrderWarnings(roles.map((r) => (r.name === "UU Bot" ? { ...r, position: 10 } : r)), ids.botUserId)).toEqual([]);
  });

  it("executePlan (fake API) creates everything, locks defaults, assigns member roles, and re-checks role order", async () => {
    const plan = planSetup(knownGuildState(ids.guildId, ids.botUserId), ids);
    let n = 0;
    const created: string[] = [];
    const puts: Array<{ channelId: string; id: string; deny: string }> = [];
    const memberRoles: string[] = [];
    const api: SetupApi = {
      createRole: async (name) => (created.push(`role:${name}`), { id: String(930000000000000000n + BigInt(++n)) }),
      createChannel: async (b) => (created.push(`${b.type === ChannelType.CATEGORY ? "cat" : "ch"}:${b.name}`), { id: String(940000000000000000n + BigInt(++n)) }),
      putOverwrite: async (channelId, o) => void puts.push({ channelId, id: o.id, deny: o.deny }),
      addMemberRole: async (u, r) => (memberRoles.push(`${u}:${r}`), u !== "1417055027121619004"), // second coach not joined yet
      // Simulate a misordered bot role after creation.
      listRoles: async () => [
        { id: "b", name: "UU Bot", position: 1, managed: true, tags: { bot_id: ids.botUserId } },
        { id: "v", name: "VIP", position: 5 },
      ],
    };
    const res = await executePlan(plan, ids, api);
    expect(created.filter((c) => c.startsWith("role:"))).toHaveLength(8);
    expect(created.filter((c) => c.startsWith("ch:"))).toHaveLength(11);
    expect(created.some((c) => /general|Text Channels|Voice Channels/.test(c))).toBe(false);
    for (const id of ["DEFAULT_TEXT_CATEGORY", "DEFAULT_VOICE_CATEGORY", "DEFAULT_GENERAL_TEXT", "DEFAULT_GENERAL_VOICE"]) {
      const p = puts.filter((x) => x.channelId === id);
      expect(p.map((x) => x.id)).toEqual([ids.guildId, res.roleIds.Unverified]);
      expect(p.every((x) => (BigInt(x.deny) & Perm.VIEW_CHANNEL) === Perm.VIEW_CHANNEL)).toBe(true);
    }
    expect(memberRoles).toEqual([
      `1317701669768925188:${res.roleIds.Coach}`,
      `1417055027121619004:${res.roleIds.Coach}`,
      `502826848812531712:${res.roleIds["Admin / Mod"]}`,
    ]);
    expect(res.warnings.some((w) => w.includes("1417055027121619004 is not in the server"))).toBe(true);
    expect(res.warnings.some((w) => w.includes("'UU Bot' sits below") && w.includes("VIP"))).toBe(true);
    // Review channel for Coach Mike lets BOTH accounts in.
    const ow = resolveOverwrites(plan.channels.find((c) => c.key === "review_coach_mike")!.access, res.roleIds, ids);
    expect(ow.filter((o) => o.type === 1).map((o) => o.id).sort()).toEqual(["1317701669768925188", "1417055027121619004", ids.botUserId].sort());
  });
});
