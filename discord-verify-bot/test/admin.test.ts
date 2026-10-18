import { describe, expect, it } from "vitest";
import { checkAdmin, hasPermission, PERMISSION } from "../src/admin";
import { ConfigError, loadConfig } from "../src/config";
import type { Env } from "../src/types";
import { button, config, IDS } from "./helpers";

const MANAGE_ROLES = String(1n << 28n);
const ADMINISTRATOR = String(1n << 3n);
const ALL = String((1n << 41n) - 1n);

describe("hasPermission", () => {
  it("reads decimal-string bitfields with BigInt", () => {
    expect(hasPermission(MANAGE_ROLES, PERMISSION.MANAGE_ROLES)).toBe(true);
    expect(hasPermission(String((1n << 28n) | (1n << 40n)), PERMISSION.MANAGE_ROLES)).toBe(true);
    expect(hasPermission(String(1n << 11n), PERMISSION.MANAGE_ROLES)).toBe(false);
    expect(hasPermission(undefined, PERMISSION.MANAGE_ROLES)).toBe(false);
    expect(hasPermission("abc", PERMISSION.MANAGE_ROLES)).toBe(false);
  });
});

describe("checkAdmin (every click and admin modal submit): configured admin role REQUIRED", () => {
  const cfg = config({ adminRoleIds: [IDS.adminRole] });

  it("allows a member with the admin role in #vip-approvals", () => {
    expect(checkAdmin(button("vip:approve:1", IDS.admin, "0", {}, [IDS.adminRole]), cfg)).toEqual({ ok: true, adminId: IDS.admin });
  });

  it("denies Manage Roles alone, Administrator alone, and even all permissions without the role", () => {
    for (const perms of [MANAGE_ROLES, ADMINISTRATOR, ALL]) {
      expect(checkAdmin(button("vip:approve:1", IDS.admin, perms, {}, []), cfg)).toEqual({ ok: false, reason: "not_admin" });
    }
  });

  it("denies other roles", () => {
    expect(checkAdmin(button("x", IDS.member, "0", {}, [IDS.vip]), cfg).ok).toBe(false);
  });

  it("denies clicks outside #vip-approvals and outside the guild, even with the role", () => {
    expect(checkAdmin(button("x", IDS.admin, "0", { channel_id: IDS.verify }), cfg)).toEqual({ ok: false, reason: "wrong_channel" });
    expect(checkAdmin(button("x", IDS.admin, "0", { guild_id: "999999999999999999" }), cfg)).toEqual({ ok: false, reason: "not_guild" });
  });

  it("fails closed if no admin role is configured", () => {
    expect(checkAdmin(button("x", IDS.admin, ADMINISTRATOR), config({ adminRoleIds: [] })).ok).toBe(false);
  });

  it("supports several admin roles", () => {
    const c = config({ adminRoleIds: [IDS.adminRole, "300000000000000099"] });
    expect(checkAdmin(button("x", IDS.admin, "0", {}, ["300000000000000099"]), c).ok).toBe(true);
  });
});

describe("loadConfig", () => {
  const env: Env = {
    DISCORD_APP_ID: IDS.app,
    GUILD_ID: IDS.guild,
    VIP_ROLE_ID: IDS.vip,
    ADMIN_ROLE_IDS: IDS.adminRole,
    VERIFY_CHANNEL_ID: IDS.verify,
    APPROVALS_CHANNEL_ID: IDS.approvals,
    LOG_CHANNEL_ID: IDS.logs,
    SUPABASE_URL: "https://example.supabase.co",
    MAX_UPLOAD_BYTES: "8388608",
    DISCORD_PUBLIC_KEY: "ab".repeat(32),
    DISCORD_BOT_TOKEN: "x",
    SUPABASE_SERVICE_ROLE_KEY: "y",
  };
  it("requires ADMIN_ROLE_IDS", () => {
    expect(loadConfig(env).adminRoleIds).toEqual([IDS.adminRole]);
    expect(() => loadConfig({ ...env, ADMIN_ROLE_IDS: "" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...env, ADMIN_ROLE_IDS: "REPLACE_WITH_ADMIN_ROLE_ID" })).toThrow(/ADMIN_ROLE_IDS/);
  });
});
