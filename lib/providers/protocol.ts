import { ProviderError, type ChatOptions, type ProviderConnection, type ProviderModel } from "./types";

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
          keep_alive: "30m",
          ...(json ? { format: "json" } : {}),
          options: { temperature: options.temperature ?? 0.9, num_predict: options.numPredict ?? 200, top_p: 0.9, num_ctx: profile.contextBudget },
        } : {
          temperature: options.temperature ?? 0.9,
          max_tokens: options.numPredict ?? 200,
          ...(json ? { response_format: { type: "json_object" } } : {}),
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
export function normalizeProviderStream(body: ReadableStream<Uint8Array>, format: "ndjson" | "sse"): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let eventData: string[] = [];
  let complete = false;
  let cancelled = false;
  let emitted = false;
  let pending: string[] = [];
  function parse(payload: string) {
    if (payload === "[DONE]") { complete = true; return; }
    let value: Record<string, any>;
    try { value = JSON.parse(payload); } catch { throw new ProviderError("The provider returned a malformed response stream. Please retry."); }
    if (!value || typeof value !== "object") throw new ProviderError("The provider returned an invalid response stream.");
    if (value.error) {
      const code = typeof value.error === "object" ? Number(value.error.code) : 0;
      throw Number.isFinite(code) && code >= 400 ? responseError(code) : new ProviderError("The provider reported an error while generating. Check the selected model and available context.");
    }
    const piece = format === "ndjson" ? value.message?.content : value.choices?.[0]?.delta?.content;
    if (typeof piece === "string" && piece) { pending.push(piece); emitted = true; }
    if (format === "ndjson" && value.done === true) complete = true;
    if (format === "sse" && value.choices?.[0]?.finish_reason) complete = true;
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
          if (!emitted) throw new ProviderError("The provider returned an empty answer. Check that the selected model supports chat.");
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

export async function streamProviderChat(profile: ProviderConnection, options: ChatOptions, transport: FetchTransport = fetch): Promise<Response> {
  const wire = providerRequest(profile, options, true);
  const result = await request(wire.url, wire.init, transport);
  if (!result.body) throw new ProviderError("The provider returned no response body.");
  return new Response(normalizeProviderStream(result.body, profile.kind === "ollama" ? "ndjson" : "sse"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function generateProviderJSON(profile: ProviderConnection, prompt: string, options: { signal?: AbortSignal } = {}, transport: FetchTransport = fetch): Promise<unknown> {
  const wire = providerRequest(profile, { messages: [{ role: "user", content: prompt }], temperature: 0.8, numPredict: 1600, signal: options.signal }, false, true);
  const result = await request(wire.url, wire.init, transport);
  let data: any;
  try { data = await result.json(); } catch { throw new ProviderError("The provider returned invalid JSON."); }
  const content = profile.kind === "ollama" ? data?.message?.content : data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new ProviderError("The provider did not return a structured answer.");
  try {
    const parsed: unknown = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
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
