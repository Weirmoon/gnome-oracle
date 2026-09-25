import { PROFILE_TUNING_DEFAULTS, ProviderError, type ChatOptions, type ProviderConnection, type ProviderModel } from "./types";
import { REASONING_END, REASONING_START, ThinkTagParser, stripReasoning } from "./reasoning";

type FetchTransport = (input: string, init: RequestInit) => Promise<Response>;

function headers(profile: ProviderConnection): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {}),
    ...(profile.kind === "openrouter" ? { "X-OpenRouter-Title": "Gnome Oracle" } : {}),
  };
}

export function providerRequest(profile: ProviderConnection, options: ChatOptions, stream: boolean, json = false) {
  const ollama = profile.kind === "ollama";
  const tuning = { ...PROFILE_TUNING_DEFAULTS, ...profile };
  // Reasoning tokens count against the output limit, so thinking gets its own headroom.
  const maxTokens = (options.numPredict ?? tuning.replyLength) + (options.think ? tuning.thinkingBudget : 0);
  return {
    url: `${profile.baseUrl}${ollama ? "/api/chat" : "/chat/completions"}`,
    init: {
      method: "POST",
      headers: headers(profile),
      signal: options.signal,
      // Do not follow a redirect that might forward credentials to another origin.
      redirect: "error" as const,
      body: JSON.stringify({
        model: profile.model,
        messages: options.messages,
        stream,
        ...(ollama ? {
          keep_alive: tuning.keepAlive,
          ...(json ? { format: "json" } : {}),
          ...(options.think !== undefined ? { think: options.think } : {}),
          options: {
            temperature: options.temperature ?? 0.9, num_predict: maxTokens, top_p: 0.9, num_ctx: profile.contextBudget,
            ...(profile.numThread ? { num_thread: profile.numThread } : {}),
          },
        } : {
          temperature: options.temperature ?? 0.9,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: "json_object" } } : {}),
          ...(profile.kind === "openrouter" && options.think !== undefined ? { reasoning: { enabled: options.think } } : {}),
        }),
      }),
    } satisfies RequestInit,
  };
}

function responseError(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError("The provider rejected authentication. Check this connection’s API key and permissions.", status);
  if (status === 404) return new ProviderError("The provider could not find the endpoint or model. Check the base URL and model identifier.", 502);
  if (status === 429) return new ProviderError("The provider’s rate or usage limit was reached. Wait before retrying or check your provider balance.", 429);
  if (status === 400 || status === 422) return new ProviderError("The provider rejected the request. Check the model, context budget, and structured JSON support.", 502);
  return new ProviderError(`The provider returned HTTP ${status}. Check its server status and connection settings.`);
}

/** Turns Ollama's generic 404/400 answers into ones that name the fix. */
async function chatRequest(profile: ProviderConnection, url: string, init: RequestInit, transport: FetchTransport, think?: boolean): Promise<Response> {
  try { return await request(url, init, transport); }
  catch (error) {
    if (profile.kind === "ollama" && error instanceof ProviderError && error.message.startsWith("The provider could not find")) {
      throw new ProviderError(`The model “${profile.model}” isn’t downloaded in Ollama. Download it or switch models in Settings → AI connections, or run: ollama pull ${profile.model}`);
    }
    if (think && error instanceof ProviderError && error.message.startsWith("The provider rejected the request")) {
      throw new ProviderError("This model can’t think. Turn thinking off in AI connections, or choose a model marked 🧠.");
    }
    throw error;
  }
}

async function request(url: string, init: RequestInit, transport: FetchTransport): Promise<Response> {
  let result: Response;
  try { result = await transport(url, init); }
  catch (error) {
    if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ProviderError("Could not reach the provider. Check the base URL, network access, and whether the model server is running.");
  }
  if (!result.ok) {
    await result.body?.cancel();
    throw responseError(result.status);
  }
  return result;
}

/** Strict incremental NDJSON / SSE parser with cancellation and final-buffer handling. */
export function normalizeProviderStream(body: ReadableStream<Uint8Array>, format: "ndjson" | "sse", { reasoning = false } = {}): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let eventData: string[] = [];
  let complete = false;
  let cancelled = false;
  let emitted = false;
  let reasoned = false;
  let pending: string[] = [];
  const tags = new ThinkTagParser();
  function emit(part: { answer: string; reasoning: string }) {
    if (part.reasoning) {
      reasoned = true;
      // Merge with a reasoning frame still waiting to be sent, rather than framing every token.
      const last = pending.length - 1;
      if (reasoning && last >= 0 && pending[last].endsWith(REASONING_END)) pending[last] = pending[last].slice(0, -1) + part.reasoning + REASONING_END;
      else if (reasoning) pending.push(REASONING_START + part.reasoning + REASONING_END);
    }
    if (part.answer) { pending.push(part.answer); emitted = true; }
  }
  function parse(payload: string) {
    if (payload === "[DONE]") { complete = true; return; }
    let value: Record<string, any>;
    try { value = JSON.parse(payload); } catch { throw new ProviderError("The provider returned a malformed response stream. Please retry."); }
    if (!value || typeof value !== "object") throw new ProviderError("The provider returned an invalid response stream.");
    if (value.error) {
      const code = typeof value.error === "object" ? Number(value.error.code) : 0;
      throw Number.isFinite(code) && code >= 400 ? responseError(code) : new ProviderError("The provider reported an error while generating. Check the selected model and available context.");
    }
    const delta = format === "ndjson" ? value.message : value.choices?.[0]?.delta;
    const thought = delta?.thinking ?? delta?.reasoning ?? delta?.reasoning_content;
    if (typeof thought === "string" && thought) emit({ answer: "", reasoning: thought });
    if (typeof delta?.content === "string" && delta.content) emit(tags.push(delta.content));
    if ((format === "ndjson" && value.done === true) || (format === "sse" && value.choices?.[0]?.finish_reason)) {
      complete = true;
      emit(tags.flush());
    }
  }
  function line(raw: string) {
    const text = raw.replace(/\r$/, "");
    if (format === "ndjson") { if (text.trim()) parse(text.trim()); return; }
    if (!text) {
      if (eventData.length) parse(eventData.join("\n"));
      eventData = [];
    } else if (text.startsWith("data:")) {
      eventData.push(text.slice(5).trimStart());
    } // SSE comments, id, retry, and event fields carry no completion text.
  }
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!pending.length && !complete && !cancelled) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          let newline: number;
          while (!complete && (newline = buffer.indexOf("\n")) >= 0) {
            line(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
          }
          if (buffer.length > 1024 * 1024) throw new ProviderError("The provider returned an oversized stream frame.");
          if (done) {
            if (buffer.trim()) line(buffer);
            if (eventData.length) { parse(eventData.join("\n")); eventData = []; }
            if (!complete) throw new ProviderError("The provider’s response ended early. Retry this answer.");
          }
        }
        if (cancelled) return;
        if (pending.length) { controller.enqueue(encoder.encode(pending.join(""))); pending = []; }
        if (complete) {
          if (!emitted) throw new ProviderError(reasoned
            ? "The model spent its whole budget thinking. Raise the thinking budget or turn thinking off."
            : "The provider returned an empty answer. Check that the selected model supports chat.");
          controller.close();
          await reader.cancel();
          reader.releaseLock();
        }
      } catch (error) {
        if (!cancelled) controller.error(error);
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      cancelled = true;
      await reader.cancel(reason).catch(() => {});
      try { reader.releaseLock(); } catch { /* Pending read will release its lock. */ }
    },
  });
}

export type ThinkingSupport = "native" | "prompted";
const thinkingCache = new Map<string, ThinkingSupport>();

/** Whether the model reasons natively, or needs to be asked to write hidden <think> notes. */
export async function thinkingSupport(profile: ProviderConnection, transport: FetchTransport = fetch): Promise<ThinkingSupport> {
  if (profile.kind === "openrouter") return "native";
  if (profile.kind !== "ollama") return "prompted";
  const key = `${profile.baseUrl} ${profile.model}`;
  const cached = thinkingCache.get(key);
  if (cached) return cached;
  try {
    const info = await getModelInfo(profile, profile.model, undefined, transport);
    const support: ThinkingSupport = info?.capabilities.includes("thinking") ? "native" : "prompted";
    thinkingCache.set(key, support);
    return support;
  } catch { return "prompted"; }
}

/** First pass of emulated thinking: plain, joke-free working that the persona answer then relies on. */
export const WORKING_PROMPT = "Work out an accurate answer to the user's latest message. Think step by step in short numbered lines, " +
  "check any facts and arithmetic, then finish with a line starting 'Answer:'. No jokes, no role-play, be brief.";

/** Append text to the system message, adding one if there is none. */
function withSystem(messages: ChatOptions["messages"], extra?: string): ChatOptions["messages"] {
  if (!extra) return messages;
  const copy = [...messages];
  const system = copy.findIndex(message => message.role === "system");
  if (system >= 0) copy[system] = { ...copy[system], content: `${copy[system].content}\n\n${extra.trim()}` };
  else copy.unshift({ role: "system", content: extra.trim() });
  return copy;
}

async function openStream(profile: ProviderConnection, options: ChatOptions, transport: FetchTransport): Promise<ReadableStream<Uint8Array>> {
  const wire = providerRequest(profile, options, true);
  const result = await chatRequest(profile, wire.url, wire.init, transport, options.think);
  if (!result.body) throw new ProviderError("The provider returned no response body.");
  return normalizeProviderStream(result.body, profile.kind === "ollama" ? "ndjson" : "sse", { reasoning: options.reasoning });
}

/**
 * Models without native thinking answer in two passes: the working is streamed
 * as reasoning, then the in-character answer is written with it in hand. Asking
 * small models for hidden notes in one reply proved unreliable (stray tags,
 * answers contradicting their own notes).
 */
function twoPassStream(profile: ProviderConnection, options: ChatOptions, transport: FetchTransport): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const tuning = { ...PROFILE_TUNING_DEFAULTS, ...profile };
  const conversation = options.messages.filter(message => message.role !== "system");
  let current: ReadableStreamDefaultReader<Uint8Array> | undefined;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const working = await openStream(profile, { messages: withSystem([{ role: "system", content: WORKING_PROMPT }, ...conversation], options.grounding), temperature: 0.2, numPredict: tuning.thinkingBudget, think: false, signal: options.signal }, transport);
        current = working.getReader();
        let notes = "";
        for (;;) {
          const { done, value } = await current.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          notes += text;
          if (options.reasoning) controller.enqueue(encoder.encode(REASONING_START + text + REASONING_END));
        }
        const guidance = `Private working for this reply (rely on it for facts and numbers; never mention it):\n${notes.trim()}`;
        const messages = withSystem(withSystem(options.messages, options.grounding), guidance);
        current = (await openStream(profile, { ...options, messages, grounding: undefined, think: false }, transport)).getReader();
        for (;;) {
          const { done, value } = await current.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) { controller.error(error); }
    },
    async cancel(reason) { await current?.cancel(reason).catch(() => {}); },
  });
}

export async function streamProviderChat(profile: ProviderConnection, options: ChatOptions, transport: FetchTransport = fetch): Promise<Response> {
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (options.think && await thinkingSupport(profile, transport) === "prompted") {
    return new Response(twoPassStream(profile, { ...options, think: undefined }, transport), { headers });
  }
  return new Response(await openStream(profile, { ...options, messages: withSystem(options.messages, options.grounding) }, transport), { headers });
}

export async function generateProviderJSON(profile: ProviderConnection, prompt: string, requested: { signal?: AbortSignal; think?: boolean } = {}, transport: FetchTransport = fetch): Promise<unknown> {
  // Hidden notes would break strict JSON output, so only native thinking applies here.
  const options = { ...requested, think: requested.think && await thinkingSupport(profile, transport) === "native" };
  const wire = providerRequest(profile, { messages: [{ role: "user", content: prompt }], temperature: 0.8, numPredict: 1600, think: options.think, signal: options.signal }, false, true);
  const result = await chatRequest(profile, wire.url, wire.init, transport, options.think);
  let data: any;
  try { data = await result.json(); } catch { throw new ProviderError("The provider returned invalid JSON."); }
  const content = profile.kind === "ollama" ? data?.message?.content : data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new ProviderError("The provider did not return a structured answer.");
  try {
    const tags = new ThinkTagParser(), visible = tags.push(content).answer + tags.flush().answer;
    const parsed: unknown = JSON.parse(stripReasoning(visible).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new ProviderError("The model returned invalid structured JSON. Try again or choose a model with JSON support."); }
}

export async function listProviderModels(profile: ProviderConnection, signal?: AbortSignal, transport: FetchTransport = fetch): Promise<ProviderModel[]> {
  const result = await request(`${profile.baseUrl}${profile.kind === "ollama" ? "/api/tags" : "/models"}`, { method: "GET", headers: headers(profile), signal, redirect: "error" }, transport);
  let data: any;
  try { data = await result.json(); } catch { throw new ProviderError("The provider returned an invalid model list."); }
  const models = profile.kind === "ollama" ? data.models : data.data;
  if (!Array.isArray(models)) throw new ProviderError("This endpoint did not return a model list. Enter a model identifier manually.");
  return models.filter((model: any) => model && typeof (model.id ?? model.name) === "string")
    .map((model: any) => ({ id: String(model.id ?? model.name), name: String(model.name ?? model.id) }));
}

export async function testProviderConnection(profile: ProviderConnection, signal?: AbortSignal, transport: FetchTransport = fetch): Promise<void> {
  const wire = providerRequest(profile, { messages: [{ role: "user", content: "Reply with OK." }], numPredict: 8, temperature: 0, signal }, false);
  const result = await request(wire.url, wire.init, transport);
  let data: any;
  try { data = await result.json(); } catch { throw new ProviderError("The provider returned an invalid connection-test response."); }
  if (data?.error) throw new ProviderError("The provider rejected the test. Check the selected model and API permissions.");
  const message = profile.kind === "ollama" ? data?.message : data?.choices?.[0]?.message;
  if (!message || typeof message.content !== "string") throw new ProviderError("The selected model did not return a chat response.");
}

export interface ModelInfo { capabilities: string[]; contextLength?: number }

/** Ollama only: what a model can do (e.g. "thinking"). Other providers return null. */
export async function getModelInfo(profile: ProviderConnection, model: string, signal?: AbortSignal, transport: FetchTransport = fetch): Promise<ModelInfo | null> {
  if (profile.kind !== "ollama") return null;
  const result = await request(`${profile.baseUrl}/api/show`, { method: "POST", headers: headers(profile), body: JSON.stringify({ model }), signal, redirect: "error" }, transport);
  let data: any;
  try { data = await result.json(); } catch { throw new ProviderError("Ollama returned invalid model details."); }
  const capabilities = Array.isArray(data?.capabilities) ? data.capabilities.filter((c: unknown) => typeof c === "string") : [];
  const info = data?.model_info && typeof data.model_info === "object" ? data.model_info : {};
  const contextKey = Object.keys(info).find(key => key.endsWith(".context_length"));
  return { capabilities, ...(contextKey && Number.isFinite(info[contextKey]) ? { contextLength: Number(info[contextKey]) } : {}) };
}

export interface PullProgress { status: string; completed?: number; total?: number; error?: string }

/** Ollama only: download a model, re-emitting progress as NDJSON PullProgress lines. */
export async function pullModel(profile: ProviderConnection, model: string, signal?: AbortSignal, transport: FetchTransport = fetch): Promise<ReadableStream<Uint8Array>> {
  if (profile.kind !== "ollama") throw new ProviderError("Downloading models is only available for Ollama connections.", 400);
  const result = await request(`${profile.baseUrl}/api/pull`, { method: "POST", headers: headers(profile), body: JSON.stringify({ model, stream: true }), signal, redirect: "error" }, transport);
  if (!result.body) throw new ProviderError("Ollama returned no download progress.");
  const reader = result.body.getReader(), decoder = new TextDecoder(), encoder = new TextEncoder();
  let buffer = "";
  const forward = (line: string): string => {
    if (!line.trim()) return "";
    let value: any;
    try { value = JSON.parse(line); } catch { return ""; }
    const progress: PullProgress = value?.error
      ? { status: "error", error: String(value.error).slice(0, 300) }
      : { status: String(value?.status ?? ""), ...(Number.isFinite(value?.completed) ? { completed: value.completed } : {}), ...(Number.isFinite(value?.total) ? { total: value.total } : {}) };
    return JSON.stringify(progress) + "\n";
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let out = "", newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) { out += forward(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
        if (done) { out += forward(buffer); buffer = ""; }
        if (out) controller.enqueue(encoder.encode(out));
        if (done) controller.close();
      } catch (error) { controller.error(error); }
    },
    async cancel(reason) { await reader.cancel(reason).catch(() => {}); },
  });
}

/** Ollama only: names of the models currently loaded in memory. */
export async function listLoadedModels(profile: ProviderConnection, signal?: AbortSignal, transport: FetchTransport = fetch): Promise<string[]> {
  if (profile.kind !== "ollama") return [];
  const result = await request(`${profile.baseUrl}/api/ps`, { method: "GET", headers: headers(profile), signal, redirect: "error" }, transport);
  let data: any;
  try { data = await result.json(); } catch { throw new ProviderError("Ollama returned an invalid list of loaded models."); }
  return Array.isArray(data?.models) ? data.models.map((m: any) => String(m?.model ?? m?.name ?? "")).filter(Boolean) : [];
}

/** Ollama only: keep_alive 0 frees the model's memory; any other value loads it. */
async function setLoaded(profile: ProviderConnection, model: string, keepAlive: string | number, transport: FetchTransport): Promise<void> {
  const result = await request(`${profile.baseUrl}/api/generate`, { method: "POST", headers: headers(profile), body: JSON.stringify({ model, keep_alive: keepAlive }), redirect: "error" }, transport);
  await result.body?.cancel();
}

export interface ModelSwitch { unloaded: string[]; loading?: string }

/** Warm-ups still in flight; Ollama's /api/ps does not list a model until it finishes loading. */
const warming = new Map<string, Promise<void>>();
const warmKey = (profile: ProviderConnection, model: string) => `${profile.baseUrl} ${model}`;

/**
 * Called when the active model changes. Small servers cannot hold two models,
 * so everything loaded is closed first, then the new model is warmed in the
 * background so the first question does not pay the load time.
 */
export async function switchActiveModel(before: ProviderConnection | null, after: ProviderConnection, transport: FetchTransport = fetch, beforeTransport: FetchTransport = transport): Promise<ModelSwitch> {
  if (before && before.kind === after.kind && before.baseUrl === after.baseUrl && before.model === after.model) return { unloaded: [] };
  const unloaded: string[] = [];
  const close = async (profile: ProviderConnection, models: string[], via = transport) => {
    for (const model of models) {
      try { await setLoaded(profile, model, 0, via); unloaded.push(model); } catch { /* Already gone or server unreachable. */ }
    }
  };
  // A different Ollama server keeps its own memory; close the old model there too.
  if (before?.kind === "ollama" && (after.kind !== "ollama" || before.baseUrl !== after.baseUrl)) await close(before, [before.model], beforeTransport);
  if (after.kind !== "ollama") return { unloaded };
  const loaded = await listLoadedModels(after, undefined, transport).catch(() => [] as string[]);
  // Only close models that are loaded or loading: unloading an idle model would load it first.
  const loadingNow = [...warming.keys()].filter(key => key.startsWith(`${after.baseUrl} `)).map(key => key.slice(after.baseUrl.length + 1));
  await close(after, [...new Set([...loaded, ...loadingNow])].filter(model => model !== after.model));
  const keepAlive = after.keepAlive === "-1" ? -1 : after.keepAlive || "30m";
  const key = warmKey(after, after.model);
  const warm = setLoaded(after, after.model, keepAlive, transport)
    .catch(() => { /* The first question will load it instead. */ })
    .finally(() => { if (warming.get(key) === warm) warming.delete(key); });
  warming.set(key, warm);
  return { unloaded, loading: after.model };
}
