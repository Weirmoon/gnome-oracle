import { getDb } from "../db";
import { initStore, type SqlStore } from "./store";
import { handleApi, type AiService } from "./service";
import { captureActiveProvider, streamChat, generateJSON } from "../providers/server";
import { webSearch } from "../search/searxng";

const store: SqlStore = {
  async all<T>(sql: string, params: unknown[] = []) { return getDb().prepare(sql).all(...params) as T[]; },
  async run(sql, params = []) { const r = getDb().prepare(sql).run(...params); return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.changes }; },
  async exec(sql) { getDb().exec(sql); },
  async transaction(fn) {
    getDb().exec("BEGIN IMMEDIATE");
    try { const result = await fn(); getDb().exec("COMMIT"); return result; }
    catch (error) { getDb().exec("ROLLBACK"); throw error; }
  },
};
const ai: AiService = {
  async capture() { return captureActiveProvider(); },
  async stream(messages, opts) { return (await streamChat({ ...opts, messages, profile: opts.profile as Awaited<ReturnType<typeof captureActiveProvider>> })).body!; },
  async json(prompt, signal) { return generateJSON(prompt, { signal }); },
  search: webSearch,
};
let initialized: Promise<void> | undefined;
let queue = Promise.resolve();
/** Serialize database setup/short handlers; release before streaming tokens. */
export async function webApi(req: Request) {
  const previous = queue; let release!: () => void;
  queue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    initialized ??= initStore(store).catch(error => { initialized = undefined; throw error; });
    await initialized;
    return await handleApi(req.url, { method: req.method, body: req.method === "GET" ? undefined : await req.text(), signal: req.signal }, { store, ai });
  } finally { release(); }
}
