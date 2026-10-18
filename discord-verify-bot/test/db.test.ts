import { describe, expect, it } from "vitest";
import { Db } from "../src/db";

/** Records requests and returns canned PostgREST responses. */
function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string>; body?: string }> = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", url: String(input), headers: init?.headers as Record<string, string>, body: init?.body as string | undefined });
    const r = responses.shift() ?? { status: 200, body: [] };
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { f, calls };
}

const row = { request_id: "800000000000000001", guild_id: "2", member_id: "3", status: "approved", admin_id: "4", reason_code: null, flags: [], approval_message_id: "5", created_at: "x", decided_at: "y" };

describe("Db.decide (atomic, idempotent)", () => {
  it("PATCHes only WHERE status=pending and returns representation; one row → won", async () => {
    const { f, calls } = mockFetch([{ status: 200, body: [row] }]);
    const db = new Db("https://p.supabase.co", "sb_secret_x", f);
    const r = await db.decide(row.request_id, "approved", "4", "2026-10-18T04:00:00.000Z");
    expect(r.won).toBe(true);
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.url).toBe(`https://p.supabase.co/rest/v1/discord_vip_requests?request_id=eq.${row.request_id}&status=eq.pending`);
    expect(calls[0]!.headers.Prefer).toBe("return=representation");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ status: "approved", admin_id: "4", decided_at: "2026-10-18T04:00:00.000Z", reason_code: null });
  });

  it("zero rows updated → lost, and reports who decided", async () => {
    const { f } = mockFetch([{ status: 200, body: [] }, { status: 200, body: [row] }]);
    const db = new Db("https://p.supabase.co", "sb_secret_x", f);
    const r = await db.decide(row.request_id, "approved", "9", "t");
    expect(r).toEqual({ won: false, row });
  });

  it("unique violation on insert → duplicate_pending", async () => {
    const { f } = mockFetch([{ status: 409, body: { code: "23505" } }, { status: 200, body: [] }]);
    const db = new Db("https://p.supabase.co", "sb_secret_x", f);
    expect(await db.createPending("1", "2", "3")).toEqual({ ok: false, reason: "duplicate_pending" });
  });

  it("sends Authorization only for legacy JWT keys", async () => {
    const a = mockFetch([{ status: 200, body: [] }]);
    await new Db("https://p.supabase.co", "sb_secret_x", a.f).get("1");
    expect(a.calls[0]!.headers.Authorization).toBeUndefined();
    expect(a.calls[0]!.headers.apikey).toBe("sb_secret_x");
    const b = mockFetch([{ status: 200, body: [] }]);
    await new Db("https://p.supabase.co", "eyJhbGciOi.fake", b.f).get("1");
    expect(b.calls[0]!.headers.Authorization).toBe("Bearer eyJhbGciOi.fake");
  });
});
