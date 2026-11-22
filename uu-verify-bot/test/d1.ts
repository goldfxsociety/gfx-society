/**
 * Minimal Cloudflare D1 adapter over a REAL in-memory SQLite (better-sqlite3), running migrations/0001_init.sql.
 * Implements the subset of D1Database the bot uses: prepare().bind().first()/all()/run(), batch(), exec().
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MIGRATION = readFileSync(fileURLToPath(new URL("../migrations/0001_init.sql", import.meta.url)), "utf8");
export const readSql = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

type Sqlite = InstanceType<typeof Database>;

class Stmt {
  constructor(
    private db: TestD1,
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Stmt(this.db, this.sql, args);
  }
  private params(): unknown[] {
    const a = this.args.map((v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v));
    if (/\?\d+/.test(this.sql)) return [Object.fromEntries(a.map((v, i) => [i + 1, v]))];
    return a;
  }
  private prep() {
    this.db.queries++;
    return this.db.sqlite.prepare(this.sql);
  }
  async first<T>(col?: string): Promise<T | null> {
    const st = this.prep();
    if (!st.reader) {
      st.run(...this.params());
      return null;
    }
    const row = st.get(...this.params()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (col ? row[col] : row) as T;
  }
  async all<T>(): Promise<{ results: T[]; success: true; meta: Record<string, unknown> }> {
    const st = this.prep();
    if (!st.reader) {
      const r = st.run(...this.params());
      return { results: [], success: true, meta: { changes: r.changes } };
    }
    return { results: st.all(...this.params()) as T[], success: true, meta: {} };
  }
  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    const st = this.prep();
    if (st.reader) {
      const rows = st.all(...this.params());
      return { success: true, meta: { changes: rows.length, last_row_id: 0 } };
    }
    const r = st.run(...this.params());
    return { success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } };
  }
}

export class TestD1 {
  sqlite: Sqlite;
  queries = 0;
  constructor(migrate = true) {
    this.sqlite = new Database(":memory:");
    this.sqlite.pragma("foreign_keys = ON"); // D1 enforces foreign keys
    if (migrate) this.sqlite.exec(MIGRATION);
  }
  prepare(sql: string) {
    return new Stmt(this, sql);
  }
  async batch(stmts: Stmt[]) {
    const out: unknown[] = [];
    this.sqlite.transaction(() => undefined)();
    for (const s of stmts) out.push(await s.run());
    return out;
  }
  async exec(sql: string) {
    this.sqlite.exec(sql);
    return { count: 1, duration: 0 };
  }
  asD1(): D1Database {
    return this as unknown as D1Database;
  }
  rows<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T[] {
    return this.sqlite.prepare(sql).all(...args) as T[];
  }
  one<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T {
    return this.sqlite.prepare(sql).get(...args) as T;
  }
}
