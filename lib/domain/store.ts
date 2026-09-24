import { SEED_PERSONAS } from "../seeds";
import { normalizeMeta } from "../persona";
import type { Character, NewCharacter } from "./types";

export interface SqlStore {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ lastInsertRowid: number; changes: number }>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export async function initStore(s: SqlStore) {
  await s.exec(`CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT UNIQUE NOT NULL,name TEXT NOT NULL,emoji TEXT NOT NULL DEFAULT '✨',description TEXT NOT NULL DEFAULT '',system_prompt TEXT NOT NULL,temperature REAL NOT NULL DEFAULT 0.9,created_at TEXT NOT NULL DEFAULT (datetime('now')),is_seed INTEGER NOT NULL DEFAULT 0,meta TEXT);
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT,character_id INTEGER,persona_name TEXT NOT NULL DEFAULT '',persona_emoji TEXT NOT NULL DEFAULT '✨',question TEXT NOT NULL,answer TEXT NOT NULL DEFAULT '',favorite INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS consultations (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'single',character_snapshot TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);`);
  const cols = await s.all<{ name: string }>("PRAGMA table_info(history)");
  for (const [name, type] of [["consultation_id", "INTEGER"], ["status", "TEXT NOT NULL DEFAULT 'complete'"], ["character_snapshot", "TEXT"], ["phase", "TEXT NOT NULL DEFAULT 'answer'"], ["error", "TEXT"]]) {
    if (!cols.some(c => c.name === name)) await s.exec(`ALTER TABLE history ADD COLUMN ${name} ${type}`);
  }
  await s.exec("CREATE INDEX IF NOT EXISTS history_consultation ON history(consultation_id,id)");
  await s.transaction(async () => {
    for (const seed of SEED_PERSONAS) {
      const slug = slugify(seed.name);
      if (!(await s.all("SELECT id FROM characters WHERE slug=?", [slug])).length) await insertCharacter(s, seed, true);
    }
    if (!(await s.all("SELECT version FROM schema_migrations WHERE version=1")).length) {
      const rows = await s.all<any>("SELECT h.*,c.meta,c.system_prompt,c.temperature FROM history h LEFT JOIN characters c ON h.character_id=c.id WHERE consultation_id IS NULL ORDER BY h.id");
      for (const row of rows) {
        const snapshot = { id: row.character_id, name: row.persona_name, emoji: row.persona_emoji, system_prompt: row.system_prompt ?? "You are a whimsical oracle.", temperature: row.temperature ?? 0.9, meta: normalizeMeta(parse(row.meta), row.persona_name, row.temperature) };
        const result = await s.run("INSERT INTO consultations(title,character_snapshot,created_at) VALUES(?,?,?)", [row.question.slice(0, 100), JSON.stringify(snapshot), row.created_at]);
        await s.run("UPDATE history SET consultation_id=?,character_snapshot=?,status=? WHERE id=?", [result.lastInsertRowid, JSON.stringify(snapshot), row.answer ? "complete" : "incomplete", row.id]);
      }
      await s.run("INSERT INTO schema_migrations(version) VALUES(1)");
    }
  });
}
export function parse(text: unknown): any { try { return typeof text === "string" ? JSON.parse(text) : text; } catch { return null; } }
export function slugify(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "persona"; }
export function hydrate(row: any): Character { return { ...row, meta: normalizeMeta(parse(row.meta), row.slug, row.temperature) }; }
export async function getCharacter(s: SqlStore, id: number) { const [row] = await s.all("SELECT * FROM characters WHERE id=?", [id]); return row ? hydrate(row) : undefined; }
export async function insertCharacter(s: SqlStore, value: NewCharacter, seed = false) {
  const base = slugify(value.name); let slug = base, n = 2;
  while ((await s.all("SELECT id FROM characters WHERE slug=?", [slug])).length) slug = `${base}-${n++}`;
  const result = await s.run("INSERT INTO characters(slug,name,emoji,description,system_prompt,temperature,is_seed,meta) VALUES(?,?,?,?,?,?,?,?)", [slug, value.name, value.emoji, value.description, value.system_prompt, value.temperature ?? 0.9, seed ? 1 : 0, JSON.stringify(normalizeMeta(value.meta, slug, value.temperature))]);
  return (await getCharacter(s, result.lastInsertRowid))!;
}
