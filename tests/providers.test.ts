import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderStream, providerRequest, streamProviderChat, listProviderModels } from "../lib/providers/protocol";
import type { ProviderConnection } from "../lib/providers/types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const profile = (kind: ProviderConnection["kind"]): ProviderConnection => ({ id: "test", name: "Test", kind, baseUrl: "http://localhost:1234/v1", model: "test-model", contextBudget: 4096, apiKey: "secret" });
async function text(stream: ReadableStream<Uint8Array>) { const reader = stream.getReader(); let out = ""; for (;;) { const part = await reader.read(); if (part.done) return out; out += decoder.decode(part.value); } }

test("normalizes Ollama NDJSON and OpenAI SSE into plain text", async () => {
  const ollama = normalizeProviderStream(new ReadableStream({ start(c) { c.enqueue(encoder.encode('{"message":{"content":"Hello"}}\n{"message":{"content":" world"},"done":true}\n')); c.close(); } }), "ndjson");
  assert.equal(await text(ollama), "Hello world");
  const sse = normalizeProviderStream(new ReadableStream({ start(c) { c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\n\n')); c.close(); } }), "sse");
  assert.equal(await text(sse), "Hi!");
});

test("rejects malformed provider frames and preserves cancellation", async () => {
  const stream = normalizeProviderStream(new ReadableStream({ start(c) { c.enqueue(encoder.encode("not-json\n")); c.close(); } }), "ndjson");
  await assert.rejects(text(stream), /malformed/);
  const controller = new AbortController();
  const wire = providerRequest(profile("openrouter"), { messages: [{ role: "user", content: "x" }], signal: controller.signal }, true);
  assert.equal(wire.url, "http://localhost:1234/v1/chat/completions");
  assert.equal((wire.init.headers as Record<string, string>).Authorization, "Bearer secret");
  controller.abort();
});

test("uses provider-shaped model lists and sends the normalized endpoint", async () => {
  const calls: string[] = [];
  const transport = async (url: string) => { calls.push(url); return new Response(JSON.stringify({ data: [{ id: "one" }, { id: "two", name: "Two" }] }), { status: 200 }); };
  assert.deepEqual(await listProviderModels(profile("openrouter"), undefined, transport), [{ id: "one", name: "one" }, { id: "two", name: "Two" }]);
  assert.deepEqual(calls, ["http://localhost:1234/v1/models"]);
  const response = await streamProviderChat(profile("openrouter"), { messages: [{ role: "user", content: "x" }] }, async (url, init) => { calls.push(url); assert.match(String(init.body), /test-model/); return new Response('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n'); });
  assert.equal(await response.text(), "ok");
});
