import { describe, expect, it } from "vitest";
import { checkAdmin, hasPermission, PERMISSION } from "../src/admin";
import { button, config, IDS } from "./helpers";

const MANAGE_ROLES = String(1n << 28n);
const ADMINISTRATOR = String(1n << 3n);
const SEND_ONLY = String(1n << 11n);

describe("hasPermission", () => {
  it("reads decimal-string bitfields with BigInt", () => {
    expect(hasPermission(MANAGE_ROLES, PERMISSION.MANAGE_ROLES)).toBe(true);
    expect(hasPermission(String((1n << 28n) | (1n << 40n)), PERMISSION.MANAGE_ROLES)).toBe(true);
    expect(hasPermission(SEND_ONLY, PERMISSION.MANAGE_ROLES)).toBe(false);
    expect(hasPermission(undefined, PERMISSION.MANAGE_ROLES)).toBe(false);
    expect(hasPermission("abc", PERMISSION.MANAGE_ROLES)).toBe(false);
  });
});

describe("checkAdmin (every button click)", () => {
  const cfg = config();
  it("allows Manage Roles in #vip-approvals when no admin role is configured", () => {
    expect(checkAdmin(button("vip:approve:1", IDS.admin, MANAGE_ROLES), cfg)).toEqual({ ok: true, adminId: IDS.admin });
  });
  it("denies members without Manage Roles", () => {
    expect(checkAdmin(button("vip:approve:1", IDS.member, SEND_ONLY), cfg)).toEqual({ ok: false, reason: "not_admin" });
  });
  it("denies clicks outside #vip-approvals and outside the guild", () => {
    expect(checkAdmin(button("x", IDS.admin, MANAGE_ROLES, { channel_id: IDS.verify }), cfg).ok).toBe(false);
    expect(checkAdmin(button("x", IDS.admin, MANAGE_ROLES, { guild_id: "999999999999999999" }), cfg)).toEqual({ ok: false, reason: "not_guild" });
  });
  it("with ADMIN_ROLE_IDS set, requires that role (Manage Roles alone is not enough); Administrator always passes", () => {
    const c = config({ adminRoleIds: [IDS.adminRole] });
    expect(checkAdmin(button("x", IDS.admin, MANAGE_ROLES), c).ok).toBe(false);
    const withRole = button("x", IDS.admin, SEND_ONLY);
    withRole.member!.roles = [IDS.adminRole];
    expect(checkAdmin(withRole, c).ok).toBe(true);
    expect(checkAdmin(button("x", IDS.admin, ADMINISTRATOR), c).ok).toBe(true);
  });
});
