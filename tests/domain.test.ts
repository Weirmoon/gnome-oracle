import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { initStore, insertCharacter, type SqlStore } from "../lib/domain/store";
import { handleApi, type AiService } from "../lib/domain/service";
import { consultationContext, type ChatMessage } from "../lib/domain/context";
import { validateCharacter } from "../lib/domain/characters";

function temporaryStore() {
  const db = new Database(":memory:");
  const store: SqlStore = {
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...params) as T[]; },
    async run(sql, params = []) { const result = db.prepare(sql).run(...params); return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes }; },
    async exec(sql) { db.exec(sql); },
    async transaction(fn) { db.exec("BEGIN IMMEDIATE"); try { const value = await fn(); db.exec("COMMIT"); return value; } catch (error) { db.exec("ROLLBACK"); throw error; } },
  };
  return { db, store };
}

const encoder = new TextEncoder();
const textStream = (text: string) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } });
type Options = Parameters<AiService["stream"]>[1];
function fakeAi(factory: (index: number, messages: ChatMessage[], options: Options) => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>> = (index) => textStream(`Answer ${index + 1}`)) {
  const calls: { messages: ChatMessage[]; options: Options }[] = [];
  let captures = 0;
  const profile = { id: "captured-profile", contextBudget: 6000 };
  const ai: AiService = {
    async capture() { captures++; return profile; },
    async stream(messages, options) { const index = calls.length; calls.push({ messages, options }); return factory(index, messages, options); },
    async json() { return { name: "Generated Oracle", system_prompt: "Answer thoughtfully." }; },
  };
  return { ai, calls, profile, get captures() { return captures; } };
}
async function setup() {
  const fixture = temporaryStore();
  await initStore(fixture.store);
  const characters = await fixture.store.all<{ id: number }>("SELECT id FROM characters ORDER BY id LIMIT 3");
  return { ...fixture, ids: characters.map((character) => character.id) };
}
const post = (value: unknown, signal?: AbortSignal): RequestInit => ({ method: "POST", body: JSON.stringify(value), signal });
const events = async (response: Response) => (await response.text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const backup = async (store: SqlStore, ai = fakeAi().ai) => (await handleApi("/api/backup", {}, { store, ai })).json();

test("legacy answers migrate once, preserving favorites, timestamps, and missing-character snapshots", async () => {
  const { store, db } = temporaryStore();
  try {
    await store.exec("CREATE TABLE history(id INTEGER PRIMARY KEY AUTOINCREMENT,character_id INTEGER,persona_name TEXT NOT NULL,persona_emoji TEXT NOT NULL,question TEXT NOT NULL,answer TEXT NOT NULL DEFAULT '',favorite INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)");
    await store.run("INSERT INTO history(character_id,persona_name,persona_emoji,question,answer,favorite,created_at) VALUES(?,?,?,?,?,?,?)", [99999, "Former Oracle", "✨", "Legacy question?", "Legacy answer.", 1, "2025-01-02 03:04:05"]);
    await store.run("INSERT INTO history(character_id,persona_name,persona_emoji,question,answer,favorite,created_at) VALUES(?,?,?,?,?,?,?)", [null, "Missing Oracle", "🧙", "Interrupted?", "", 0, "2025-02-03 04:05:06"]);
    await initStore(store);
    await initStore(store);
    const rows = await store.all<any>("SELECT * FROM history ORDER BY id");
    const consultations = await store.all<any>("SELECT * FROM consultations ORDER BY id");
    assert.equal(consultations.length, 2);
    assert.equal(rows[0].favorite, 1);
    assert.equal(rows[0].created_at, "2025-01-02 03:04:05");
    assert.equal(consultations[0].created_at, rows[0].created_at);
    assert.equal(rows[0].status, "complete");
    assert.equal(rows[1].status, "incomplete");
    assert.equal(JSON.parse(rows[0].character_snapshot).name, "Former Oracle");
    assert.equal(rows[0].consultation_id, consultations[0].id);
    assert.doesNotThrow(() => validateCharacter(JSON.parse(rows[1].character_snapshot)));
  } finally { db.close(); }
});

test("follow-ups persist into one consultation and use its original persona snapshot", async () => {
  const { store, db } = await setup(); const fake = fakeAi();
  try {
    const character = await insertCharacter(store, { name: "Snapshot Sage", emoji: "🪄", description: "The original", system_prompt: "ORIGINAL PERSONALITY" });
    const first = await handleApi("/api/ask", post({ characterId: character.id, question: "First question?" }), { store, ai: fake.ai });
    assert.equal(first.status, 200); await first.text();
    const consultationId = Number(first.headers.get("X-Consultation-Id"));
    await store.run("UPDATE characters SET system_prompt='CHANGED PERSONALITY' WHERE id=?", [character.id]);
    await store.run("DELETE FROM characters WHERE id=?", [character.id]);
    const followup = await handleApi("/api/ask", post({ consultationId, question: "Why?" }), { store, ai: fake.ai });
    assert.equal(followup.headers.get("X-Consultation-Id"), String(consultationId)); await followup.text();
    assert.match(fake.calls[1].messages[0].content, /ORIGINAL PERSONALITY/);
    assert.deepEqual(fake.calls[1].messages.slice(1), [{ role: "user", content: "First question?" }, { role: "assistant", content: "Answer 1" }, { role: "user", content: "Why?" }]);
    assert.equal((await store.all("SELECT id FROM consultations")).length, 1);
    assert.equal((await store.all("SELECT id FROM history WHERE status='complete'")).length, 2);
    assert.equal(fake.calls[0].options.profile, fake.profile);
  } finally { db.close(); }
});

test("context keeps six recent completed exchanges and trims oldest pairs to budget", () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({ question: `Q${index}`, answer: `A${index}`, status: "complete" }));
  rows.push({ question: "Cancelled", answer: "Partial", status: "incomplete" });
  const context = consultationContext("System", "Now?", rows, 6000);
  assert.equal(context.length, 14);
  assert.deepEqual(context[1], { role: "user", content: "Q3" });
  assert.equal(context.some((message) => message.content === "Partial"), false);
  const trimmed = consultationContext("System", "Now?", rows, 406);
  assert.deepEqual(trimmed.slice(1, -1).map((message) => message.content), ["Q7", "A7", "Q8", "A8"]);
  assert.equal(consultationContext("System", "Now?", rows, 1).length, 2);
});

test("cancelling a response preserves partial text as incomplete and excludes it from follow-ups", async () => {
  const { store, db, ids } = await setup();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const fake = fakeAi((index) => index === 0 ? new ReadableStream({ start(controller) { streamController = controller; controller.enqueue(encoder.encode("Partial wisdom")); } }) : textStream("Completed"));
  try {
    const signal = new AbortController();
    const response = await handleApi("/api/ask", post({ characterId: ids[0], question: "Will this finish?" }, signal.signal), { store, ai: fake.ai });
    const reader = response.body!.getReader(); await reader.read();
    // Abort plus upstream EOF reproduces a provider interrupted after a chunk.
    signal.abort(); streamController!.close(); await reader.read();
    const [row] = await store.all<any>("SELECT * FROM history");
    assert.equal(row.answer, "Partial wisdom"); assert.equal(row.status, "incomplete");
    const followup = await handleApi("/api/ask", post({ consultationId: row.consultation_id, question: "Try again?" }), { store, ai: fake.ai }); await followup.text();
    assert.equal(fake.calls[1].messages.length, 2);
    assert.equal(fake.calls[1].messages.some((message) => message.content.includes("Partial wisdom")), false);
  } finally { db.close(); }
});

test("Council keeps sequential turns, captured profile and successful replies after a speaker fails", async () => {
  const { store, db, ids } = await setup();
  const fake = fakeAi((index) => { if (index === 1) throw new Error("Model unavailable"); return textStream(`Council answer ${index}`); });
  try {
    const response = await handleApi("/api/council", post({ characterIds: ids, question: "Should we sail?" }), { store, ai: fake.ai });
    const output = await events(response);
    assert.deepEqual(output.filter((event) => event.type === "speaker").map((event) => event.index), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(output.filter((event) => event.type === "error").map((event) => event.index), [1]);
    assert.equal(fake.calls.length, 6); assert.equal(fake.captures, 1);
    assert.equal(fake.calls.every((call) => call.options.profile === fake.profile), true);
    assert.match(fake.calls[3].messages[1].content, /Council answer 0/);
    assert.match(fake.calls[3].messages[1].content, /Council answer 2/);
    const rows = await store.all<any>("SELECT * FROM history ORDER BY id");
    assert.equal(rows.length, 6); assert.equal(rows.filter((row) => row.status === "complete").length, 5);
    assert.equal(rows[1].status, "incomplete");
    const retry = await handleApi("/api/council", post({ consultationId: Number(response.headers.get("X-Consultation-Id")), retryIndex: 1 }), { store, ai: fake.ai });
    const retried = await events(retry);
    assert.deepEqual(retried.filter((event) => event.type === "speaker").map((event) => event.index), [1]);
    assert.equal(fake.calls.length, 7);
    const duplicate = await handleApi("/api/council", post({ consultationId: Number(response.headers.get("X-Consultation-Id")), retryIndex: 1 }), { store, ai: fake.ai });
    assert.equal(duplicate.status, 409);
  } finally { db.close(); }
});

test("Council requires three distinct normalized character identifiers", async () => {
  const { store, db, ids } = await setup(); const fake = fakeAi();
  try {
    const response = await handleApi("/api/council", post({ characterIds: [ids[0], String(ids[0]), ids[1]], question: "A duplicate seat?" }), { store, ai: fake.ai });
    await response.text();
    assert.equal(response.status, 400);
    assert.equal(fake.calls.length, 0);
  } finally { db.close(); }
});

test("backup round-trip preserves consultations, favorites and custom personas using new IDs", async () => {
  const source = await setup(); const destination = await setup(); const fake = fakeAi();
  try {
    const original = await insertCharacter(source.store, { name: "Backup Sage", emoji: "🌙", description: "Saved", system_prompt: "Keep this character." });
    const answer = await handleApi("/api/ask", post({ characterId: original.id, question: "Remember this?" }), { store: source.store, ai: fake.ai }); await answer.text();
    await source.store.run("UPDATE history SET favorite=1,created_at='2025-04-05 06:07:08'");
    const archive = await backup(source.store);
    // Occupy the source custom character ID in the destination before restoring.
    await insertCharacter(destination.store, { name: "Already Here", emoji: "✨", description: "Existing", system_prompt: "Stay." });
    const response = await handleApi("/api/backup", post(archive), { store: destination.store, ai: fake.ai });
    assert.equal(response.status, 200);
    const [row] = await destination.store.all<any>("SELECT * FROM history");
    assert.equal(row.favorite, 1); assert.equal(row.created_at, "2025-04-05 06:07:08");
    assert.notEqual(row.character_id, original.id);
    const [consultation] = await destination.store.all<any>("SELECT * FROM consultations");
    assert.equal(JSON.parse(consultation.character_snapshot).id, row.character_id);
    assert.equal(row.answer, "Answer 1");
    assert.equal(JSON.stringify(archive).includes("captured-profile"), false);
  } finally { source.db.close(); destination.db.close(); }
});

test("malformed backup references and SQL failures leave existing data untouched", async () => {
  const { store, db, ids } = await setup(); const fake = fakeAi();
  try {
    const response = await handleApi("/api/ask", post({ characterId: ids[0], question: "Keep me" }), { store, ai: fake.ai }); await response.text();
    const archive = await backup(store);
    const before = await backup(store);
    const broken = structuredClone(archive); broken.history[0].consultation_id = 987654;
    assert.equal((await handleApi("/api/backup", post(broken), { store, ai: fake.ai })).status, 400);
    assert.deepEqual(await backup(store), before);
    const badBinding = structuredClone(archive); badBinding.history[0].created_at = { invalid: true };
    assert.equal((await handleApi("/api/backup", post(badBinding), { store, ai: fake.ai })).status, 400);
    assert.deepEqual(await backup(store), before);
  } finally { db.close(); }
});

test("backup imports strip unknown snapshot properties so credential fields cannot be retained", async () => {
  const { store, db, ids } = await setup(); const fake = fakeAi();
  try {
    const response = await handleApi("/api/ask", post({ characterId: ids[0], question: "A clean archive" }), { store, ai: fake.ai }); await response.text();
    const archive = await backup(store);
    for (const item of [...archive.consultations, ...archive.history]) {
      const snapshot = JSON.parse(item.character_snapshot); snapshot.apiKey = "private-key-must-not-survive";
      item.character_snapshot = JSON.stringify(snapshot);
    }
    const restored = await handleApi("/api/backup", post(archive), { store, ai: fake.ai });
    assert.equal(restored.status, 200);
    assert.equal(JSON.stringify(await backup(store)).includes("private-key-must-not-survive"), false);
  } finally { db.close(); }
});

test("ambient critters use canned lines without requesting AI unless explicitly enabled", async () => {
  const { store, db, ids } = await setup(); const fake = fakeAi();
  try {
    const response = await handleApi("/api/quip", post({ critterId: "fairy", characterId: ids[0] }), { store, ai: fake.ai });
    assert.equal(response.status, 200); assert.ok((await response.text()).length > 5);
    assert.equal(fake.calls.length, 0);
    assert.equal((await store.all("SELECT id FROM history")).length, 0);
  } finally { db.close(); }
});
