import { invoke, Channel } from "@tauri-apps/api/core";
import { handleApi, type AiService } from "../domain/service";
import { initStore, type SqlStore } from "../domain/store";
import { streamProviderChat, generateProviderJSON, listProviderModels, testProviderConnection } from "../providers/protocol";
import type { ProviderProfile } from "../providers/types";

type Snapshot = { profile: ProviderProfile; token: string; contextBudget?: number };
type ProfileList = { profiles: ProviderProfile[]; activeProfileId: string | null };
type HttpEvent = { type: "headers"; status: number } | { type: "chunk"; bytes: number[] };
declare const __GNOME_MUSIC__: string[];

const store: SqlStore = {
  all: <T,>(sql: string, params: unknown[] = []) => invoke<T[]>("db_query", { sql, params }),
  run: (sql: string, params: unknown[] = []) => invoke("db_execute", { sql, params }),
  exec: (sql: string) => invoke("db_exec", { sql }),
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec("BEGIN IMMEDIATE");
    try { const value = await fn(); await this.exec("COMMIT"); return value; }
    catch (error) { await this.exec("ROLLBACK"); throw error; }
  },
};

function transport(snapshot: Snapshot) {
  return (_url: string, init: RequestInit): Promise<Response> => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let closed = false;
    let headersReceived = false;
    const signal = init.signal;
    const abort = () => {
      void invoke("provider_cancel", { requestId });
      if (!closed) { closed = true; controller.error(new DOMException("Request cancelled", "AbortError")); }
      if (!headersReceived) reject(new DOMException("Request cancelled", "AbortError"));
    };
    const body = new ReadableStream<Uint8Array>({
      start(value) { controller = value; },
      cancel() { closed = true; void invoke("provider_cancel", { requestId }); },
    });
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    const channel = new Channel<HttpEvent>();
    channel.onmessage = event => {
      if (closed) return;
      if (event.type === "headers") { headersReceived = true; resolve(new Response(body, { status: event.status })); }
      else controller.enqueue(new Uint8Array(event.bytes));
    };
    invoke("provider_http", {
      token: snapshot.token,
      operation: init.method === "GET" ? "models" : "chat",
      body: typeof init.body === "string" ? JSON.parse(init.body) : null,
      requestId, channel,
    }).then(() => {
      if (!headersReceived) reject(new Error("The provider returned no response"));
      if (!closed) { closed = true; controller.close(); }
    }).catch(error => {
      const failure = new Error(String(error));
      if (!headersReceived) reject(failure);
      if (!closed) { closed = true; controller.error(failure); }
    }).finally(() => signal?.removeEventListener("abort", abort));
  });
}
const ai: AiService = {
  async capture() { const snapshot = await invoke<Snapshot>("provider_snapshot", { profileId: null, draft: null }); return { ...snapshot, contextBudget: snapshot.profile.contextBudget }; },
  async stream(messages, options) {
    const snapshot = (options.profile ?? await this.capture()) as Snapshot;
    const response = await streamProviderChat(snapshot.profile, { ...options, messages }, transport(snapshot));
    return response.body!;
  },
  async json(prompt, signal) {
    const snapshot = await this.capture() as Snapshot;
    return generateProviderJSON(snapshot.profile, prompt, { signal }, transport(snapshot));
  },
};

async function providerRoute(path: string, init: RequestInit): Promise<Response> {
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  if (path === "/api/providers/status") {
    const saved = await invoke<ProfileList>("provider_list");
    const profile = saved.profiles.find(profile => profile.id === saved.activeProfileId);
    return Response.json({ native: true, configured: !!profile, managementEnabled: true, activeProfile: profile ? { id: profile.id, name: profile.name, kind: profile.kind, model: profile.model } : null });
  }
  if (path.endsWith("/models") || path.endsWith("/test")) {
    const snapshot = await invoke<Snapshot>("provider_snapshot", { profileId: body.profileId ?? null, draft: body.profile ?? null });
    if (path.endsWith("/models")) return Response.json({ models: await listProviderModels(snapshot.profile, init.signal ?? undefined, transport(snapshot)) });
    await testProviderConnection(snapshot.profile, init.signal ?? undefined, transport(snapshot));
    return Response.json({ ok: true });
  }
  if (method === "GET") return Response.json(await invoke("provider_list"));
  if (method === "POST") return Response.json(await invoke("provider_save", { profile: body.profile }));
  if (method === "PATCH") { await invoke("provider_activate", { id: body.activeProfileId }); return Response.json({ ok: true }); }
  if (method === "DELETE") { await invoke("provider_delete", { id: body.id }); return Response.json({ ok: true }); }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

let initialized: Promise<void> | undefined;
let pending: Promise<void> = Promise.resolve();
/** Hold the request gate through stream persistence so a transaction cannot mix callers. */
export async function nativeFetch(path: string, init: RequestInit): Promise<Response> {
  if (path.startsWith("/api/providers")) {
    try { return await providerRoute(path, init); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
  }
  if (path === "/api/music") return Response.json(typeof __GNOME_MUSIC__ === "undefined" ? [] : __GNOME_MUSIC__);
  let release!: () => void;
  const previous = pending;
  pending = new Promise<void>(resolve => { release = resolve; });
  await previous;
  let handedOff = false;
  try {
    if (init.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    initialized ??= initStore(store).catch(error => { initialized = undefined; throw error; });
    await initialized;
    const response = await handleApi(path, init, { store, ai });
    if (!response.body || !response.headers.get("content-type")?.startsWith("text/plain")) return response;
    const reader = response.body.getReader();
    handedOff = true;
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try { const chunk = await reader.read(); if (chunk.done) { controller.close(); release(); } else controller.enqueue(chunk.value); }
        catch (error) { controller.error(error); release(); }
      },
      async cancel(reason) { try { await reader.cancel(reason); } finally { release(); } },
    }), { status: response.status, headers: response.headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally { if (!handedOff) release(); }
}
