import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { type PersonaMeta, deriveMeta, normalizeMeta } from "./persona";

export type { Character, NewCharacter, HistoryRow } from "./domain/types";
import type { Character, NewCharacter, HistoryRow } from "./domain/types";
import { SEED_PERSONAS } from "./seeds";

// The sqlite file lives in ./data next to the app. In the standalone build the
// service sets the working directory to the install path, so a relative ./data
// resolves correctly there too.
const DATA_DIR = process.env.GNOME_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "gnome.db");

// Keep one connection alive across Next.js hot-reloads / route invocations.
declare global {
  // eslint-disable-next-line no-var
  var __gnomeDb: Database.Database | undefined;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "persona"
  );
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      emoji         TEXT NOT NULL DEFAULT '✨',
      description   TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL,
      temperature   REAL NOT NULL DEFAULT 0.9,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      is_seed       INTEGER NOT NULL DEFAULT 0
    );
  `);

  // --- Migration: add meta column for appearance + voice (additive). ---
  if (!hasColumn(db, "characters", "meta")) {
    db.exec("ALTER TABLE characters ADD COLUMN meta TEXT");
  }

  // --- History table ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id  INTEGER,
      persona_name  TEXT NOT NULL DEFAULT '',
      persona_emoji TEXT NOT NULL DEFAULT '✨',
      question      TEXT NOT NULL,
      answer        TEXT NOT NULL DEFAULT '',
      favorite      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insert = db.prepare(
    `INSERT INTO characters (slug, name, emoji, description, system_prompt, temperature, is_seed, meta)
     VALUES (@slug, @name, @emoji, @description, @system_prompt, @temperature, 1, @meta)`
  );
  const update = db.prepare(
    `UPDATE characters
     SET name = @name,
         emoji = @emoji,
         description = @description,
         system_prompt = @system_prompt,
         temperature = @temperature,
         is_seed = 1,
         meta = @meta
     WHERE slug = @slug AND is_seed = 1`
  );
  const exists = db.prepare("SELECT is_seed FROM characters WHERE slug = ?");
  const seedTx = db.transaction((rows: NewCharacter[]) => {
    for (const r of rows) {
      const slug = slugify(r.name);
      const payload = {
        slug,
        name: r.name,
        emoji: r.emoji,
        description: r.description,
        system_prompt: r.system_prompt,
        temperature: r.temperature ?? 0.9,
        meta: JSON.stringify(r.meta ?? deriveMeta(slug, r.temperature)),
      };
      const row = exists.get(slug) as { is_seed: number } | undefined;
      if (!row) insert.run(payload);
      else if (row.is_seed) update.run(payload);
    }
  });
  seedTx(SEED_PERSONAS);
}

export function getDb(): Database.Database {
  if (global.__gnomeDb) return global.__gnomeDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  init(db);
  global.__gnomeDb = db;
  return db;
}

// Raw row as stored (meta is a JSON string or null).
type CharacterRow = Omit<Character, "meta"> & { meta: string | null };

function hydrate(row: CharacterRow): Character {
  let parsed: unknown = null;
  if (row.meta) {
    try {
      parsed = JSON.parse(row.meta);
    } catch {
      parsed = null;
    }
  }
  const meta = normalizeMeta(parsed, row.slug, row.temperature);
  return { ...row, meta };
}

export function listCharacters(): Character[] {
  const rows = getDb()
    .prepare("SELECT * FROM characters ORDER BY is_seed DESC, name ASC")
    .all() as CharacterRow[];
  return rows.map(hydrate);
}

export function getCharacter(id: number): Character | undefined {
  const row = getDb().prepare("SELECT * FROM characters WHERE id = ?").get(id) as
    | CharacterRow
    | undefined;
  return row ? hydrate(row) : undefined;
}

export function createCharacter(c: NewCharacter): Character {
  const db = getDb();
  // Ensure a unique slug (append -2, -3, ... on collision).
  const base = slugify(c.name);
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM characters WHERE slug = ?").get(slug)) {
    slug = `${base}-${n++}`;
  }
  const meta = c.meta ?? deriveMeta(slug, c.temperature);
  const info = db
    .prepare(
      `INSERT INTO characters (slug, name, emoji, description, system_prompt, temperature, is_seed, meta)
       VALUES (@slug, @name, @emoji, @description, @system_prompt, @temperature, @is_seed, @meta)`
    )
    .run({
      slug,
      name: c.name,
      emoji: c.emoji || "✨",
      description: c.description || "",
      system_prompt: c.system_prompt,
      temperature: c.temperature ?? 0.9,
      is_seed: c.is_seed ? 1 : 0,
      meta: JSON.stringify(meta),
    });
  return getCharacter(Number(info.lastInsertRowid))!;
}

/** Returns 'deleted' | 'not_found' | 'protected'. Seed personas cannot be deleted. */
export function deleteCharacter(id: number): "deleted" | "not_found" | "protected" {
  const existing = getCharacter(id);
  if (!existing) return "not_found";
  if (existing.is_seed) return "protected";
  getDb().prepare("DELETE FROM characters WHERE id = ?").run(id);
  return "deleted";
}

// --------------------------- History helpers ---------------------------

export function addHistory(h: {
  characterId: number | null;
  personaName: string;
  personaEmoji: string;
  question: string;
}): number {
  const info = getDb()
    .prepare(
      `INSERT INTO history (character_id, persona_name, persona_emoji, question, answer)
       VALUES (@characterId, @personaName, @personaEmoji, @question, '')`
    )
    .run(h);
  return Number(info.lastInsertRowid);
}

export function setHistoryAnswer(id: number, answer: string): void {
  getDb().prepare("UPDATE history SET answer = ? WHERE id = ?").run(answer, id);
}

export function listHistory(opts?: { favoritesOnly?: boolean; limit?: number }): HistoryRow[] {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const where = opts?.favoritesOnly ? "WHERE favorite = 1" : "";
  return getDb()
    .prepare(`SELECT * FROM history ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as HistoryRow[];
}

/** Toggles favorite; returns the new state, or null if the row is missing. */
export function toggleFavorite(id: number): boolean | null {
  const row = getDb().prepare("SELECT favorite FROM history WHERE id = ?").get(id) as
    | { favorite: number }
    | undefined;
  if (!row) return null;
  const next = row.favorite ? 0 : 1;
  getDb().prepare("UPDATE history SET favorite = ? WHERE id = ?").run(next, id);
  return next === 1;
}

export function deleteHistory(id: number): boolean {
  const info = getDb().prepare("DELETE FROM history WHERE id = ?").run(id);
  return info.changes > 0;
}
