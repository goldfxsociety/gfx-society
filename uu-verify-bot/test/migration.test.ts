import { describe, expect, it } from "vitest";
import { MIGRATION, readSql, TestD1 } from "./d1";
import { config, IDS } from "./helpers";
import { seedSql } from "../src/setup";

/** Runs each statement of a verify file (one SELECT per check, as D1 executes it). */
const results = (d: TestD1, file: string) =>
  readSql(file)
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => d.rows<{ check_name: string; result: string }>(s));

describe("D1 migration 0001 + verify + revert", () => {
  it("applies (twice, idempotent) and every verify check is ok", () => {
    const d = new TestD1();
    d.sqlite.exec(MIGRATION);
    const r = results(d, "sql/0001_verify.sql");
    expect(r.length).toBe(8);
    expect(r.filter((x) => x.result !== "ok")).toEqual([]);
  });

  it("constraints: 6-digit User ID, yes/no only for vip_above_min, one pending per member, single top line, emails lowercased", () => {
    const d = new TestD1();
    const bad = (sql: string) => expect(() => d.sqlite.exec(sql)).toThrow();
    bad(`INSERT INTO members (discord_user_id, accm_user_id) VALUES ('${IDS.member}', '12345')`);
    bad(`INSERT INTO members (discord_user_id, accm_user_id) VALUES ('${IDS.member}', '12345a')`);
    bad(`INSERT INTO members (discord_user_id, vip_above_min) VALUES ('${IDS.member}', '75.00')`);
    bad(`INSERT INTO members (discord_user_id, tier) VALUES ('${IDS.member}', 'gold')`);
    d.sqlite.exec(`INSERT INTO ib_lines (slug, display_name, discord_user_id) VALUES ('coach-mike', 'Coach Mike', '${IDS.coach1}')`);
    bad(`INSERT INTO ib_lines (slug, display_name, discord_user_id) VALUES ('other-top', 'Other', '${IDS.ben}')`);
    bad(`INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id) VALUES ('gfx', 'Ben', '${IDS.ben}', 'GoldFX.Society@gmail.com', 1)`);
    const app = (id: string, status = "pending") =>
      `INSERT INTO applications (id, applicant_discord_id, type, accm_user_id, status) VALUES ('${id}', '${IDS.member}', 'free', '123456', '${status}')`;
    d.sqlite.exec(app("700000000000000001"));
    bad(app("700000000000000002"));
    d.sqlite.exec(app("700000000000000003", "denied"));
    bad(`INSERT INTO applications (id, applicant_discord_id, type, status) VALUES ('700000000000000004', '${IDS.member2}', 'ib', 'pending')`); // IB needs email
    bad(`INSERT INTO applications (id, applicant_discord_id, type, accm_user_id, vip_above_min) VALUES ('700000000000000005', '${IDS.member2}', 'free', '123456', 'yes')`); // vip_above_min only for VIP
  });

  it("revert drops everything (verify then FAILs) and the migration re-applies cleanly", () => {
    const d = new TestD1();
    d.sqlite.exec(readSql("sql/0001_revert.sql"));
    expect(d.rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('ib_lines','members','applications','decision_logs','cron_runs','review_cards')")).toEqual([]);
    expect(results(d, "sql/0001_verify.sql").find((x) => x.check_name === "tables")?.result).toBe("FAIL");
    d.sqlite.exec(MIGRATION);
    expect(results(d, "sql/0001_verify.sql").every((x) => x.result === "ok")).toBe(true);
  });

  it("generated seed loads the two launch lines only and seed_verify passes; re-running is idempotent", () => {
    const d = new TestD1();
    const sql = seedSql(
      {
        roleIds: { "Line: Coach Mike": IDS.lineCoachRole, "Line: Ben": IDS.lineGfxRole },
        channelIds: { review_coach_mike: IDS.reviewCoach, review_gfx: IDS.reviewGfx },
        categoryIds: {},
        warnings: [],
      },
      { coachMikeUserIds: config().coachMikeUserIds, benUserId: IDS.ben, coachMikeIbEmail: null },
    );
    d.sqlite.exec(sql);
    d.sqlite.exec(sql);
    expect(results(d, "sql/seed_verify.sql").every((x) => x.result === "ok")).toBe(true);
    expect(d.rows("SELECT slug, display_name, discord_user_id, upline_line_id FROM ib_lines ORDER BY id")).toEqual([
      { slug: "coach-mike", display_name: "Coach Mike", discord_user_id: IDS.coach1, upline_line_id: null },
      { slug: "gfx", display_name: "Ben", discord_user_id: IDS.ben, upline_line_id: 1 },
    ]);
  });
});
