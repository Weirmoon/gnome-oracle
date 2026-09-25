import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderStream, providerRequest, streamProviderChat, listProviderModels, getModelInfo, pullModel, switchActiveModel } from "../lib/providers/protocol";
import { PROFILE_TUNING_DEFAULTS, validateProfile, type ProviderConnection } from "../lib/providers/types";
import { ReasoningSplitter, REASONING_END, REASONING_START, stripReasoning } from "../lib/providers/reasoning";
import { decodeSources, encodeSources, searchContext } from "../lib/search/format";
import { requireProviderAdmin, usingDefaultPassword } from "../lib/providers/http";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const profile = (kind: ProviderConnection["kind"]): ProviderConnection => ({ id: "test", name: "Test", kind, baseUrl: "http://localhost:1234/v1", model: "test-model", contextBudget: 4096, ...PROFILE_TUNING_DEFAULTS, apiKey: "secret" });
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

const lines = (...frames: string[]) => new ReadableStream<Uint8Array>({ start(c) { for (const f of frames) c.enqueue(encoder.encode(f)); c.close(); } });
const bodyOf = (wire: { init: RequestInit }) => JSON.parse(String(wire.init.body));

test("sends think and budgets reasoning tokens for Ollama", () => {
  const ollama = { ...profile("ollama"), replyLength: 150, thinkingBudget: 512, keepAlive: "-1", numThread: 4 };
  const thinking = bodyOf(providerRequest(ollama, { messages: [], think: true }, true));
  assert.equal(thinking.think, true);
  assert.equal(thinking.options.num_predict, 662);
  assert.equal(thinking.options.num_thread, 4);
  assert.equal(thinking.keep_alive, "-1");
  const quip = bodyOf(providerRequest(ollama, { messages: [], think: false, numPredict: 60 }, true));
  assert.equal(quip.think, false);
  assert.equal(quip.options.num_predict, 60);
  assert.equal("think" in bodyOf(providerRequest(ollama, { messages: [] }, true)), false);
  assert.deepEqual(bodyOf(providerRequest(profile("openrouter"), { messages: [], think: true }, true)).reasoning, { enabled: true });
});

test("frames Ollama thinking only when reasoning is requested", async () => {
  const frames = ['{"message":{"thinking":"hmm"}}\n', '{"message":{"content":"Yes."},"done":true}\n'];
  assert.equal(await text(normalizeProviderStream(lines(...frames), "ndjson")), "Yes.");
  assert.equal(await text(normalizeProviderStream(lines(...frames), "ndjson", { reasoning: true })), `${REASONING_START}hmm${REASONING_END}Yes.`);
});

test("reads SSE reasoning_content and inline think tags split across chunks", async () => {
  const sse = lines('data: {"choices":[{"delta":{"reasoning_content":"plan"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"Go."},"finish_reason":"stop"}]}\n\n');
  assert.equal(await text(normalizeProviderStream(sse, "sse", { reasoning: true })), `${REASONING_START}plan${REASONING_END}Go.`);
  const tagged = lines('{"message":{"content":"<thi"}}\n', '{"message":{"content":"nk>secret</th"}}\n', '{"message":{"content":"ink>Hi"},"done":true}\n');
  assert.equal(await text(normalizeProviderStream(tagged, "ndjson")), "Hi");
});

test("explains an answer lost to the thinking budget", async () => {
  const stream = normalizeProviderStream(lines('{"message":{"thinking":"long"}}\n', '{"message":{"content":""},"done":true}\n'), "ndjson");
  await assert.rejects(text(stream), /thinking budget/);
});

test("splits and strips framed reasoning", () => {
  const framed = `${REASONING_START}why${REASONING_END}Because.`;
  assert.equal(stripReasoning(framed), "Because.");
  const splitter = new ReasoningSplitter();
  assert.deepEqual(splitter.push(framed.slice(0, 3)), { answer: "", reasoning: "wh" });
  assert.deepEqual(splitter.push(framed.slice(3)), { answer: "Because.", reasoning: "y" });
});

test("old profiles validate with tuning defaults and bad tuning is rejected", () => {
  const base = { name: "Old", kind: "ollama", baseUrl: "http://127.0.0.1:11434", model: "gemma3:4b", contextBudget: 4096 };
  assert.deepEqual(
    (({ thinking, thinkingBudget, replyLength, keepAlive }) => ({ thinking, thinkingBudget, replyLength, keepAlive }))(validateProfile(base)),
    PROFILE_TUNING_DEFAULTS);
  assert.throws(() => validateProfile({ ...base, keepAlive: "forever" }), /Keep-loaded/);
  assert.throws(() => validateProfile({ ...base, thinkingBudget: 99999 }), /Thinking budget/);
  assert.equal(validateProfile({ ...base, numThread: "" }).numThread, undefined);
});

test("reads model capabilities and relays pull progress", async () => {
  const ollama = { ...profile("ollama"), baseUrl: "http://localhost:11434" };
  const info = await getModelInfo(ollama, "qwen3:4b", undefined, async url => {
    assert.equal(url, "http://localhost:11434/api/show");
    return Response.json({ capabilities: ["completion", "thinking"], model_info: { "qwen3.context_length": 40960 } });
  });
  assert.deepEqual(info, { capabilities: ["completion", "thinking"], contextLength: 40960 });
  assert.equal(await getModelInfo(profile("openrouter"), "x"), null);
  const progress = await pullModel(ollama, "qwen3:0.6b", undefined, async () => new Response('{"status":"pulling","digest":"sha","completed":5,"total":10}\n{"status":"success"}\n'));
  assert.equal(await text(progress), '{"status":"pulling","completed":5,"total":10}\n{"status":"success"}\n');
});

test("switching the active model closes every loaded model, then warms the new one", async () => {
  const before = { ...profile("ollama"), baseUrl: "http://o:11434", model: "gemma3:1b" };
  const after = { ...before, model: "qwen3:0.6b", keepAlive: "-1" };
  const calls: string[] = [];
  const transport = async (url: string, init: RequestInit) => {
    calls.push(`${url.replace("http://o:11434", "")} ${init.body ?? ""}`);
    return url.endsWith("/api/ps") ? Response.json({ models: [{ model: "gemma3:1b" }, { model: "llama3.2:3b" }] }) : new Response("{}");
  };
  assert.deepEqual(await switchActiveModel(before, after, transport), { unloaded: ["gemma3:1b", "llama3.2:3b"], loading: "qwen3:0.6b" });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, [
    "/api/ps ",
    '/api/generate {"model":"gemma3:1b","keep_alive":0}',
    '/api/generate {"model":"llama3.2:3b","keep_alive":0}',
    '/api/generate {"model":"qwen3:0.6b","keep_alive":-1}',
  ]);
  assert.deepEqual(await switchActiveModel(after, after, transport), { unloaded: [] });
});

test("models without native thinking answer in two passes, streaming the working as reasoning", async () => {
  const ollama = { ...profile("ollama"), baseUrl: "http://o:11434", model: "gemma3:4b" };
  const bodies: any[] = [];
  const transport = async (url: string, init: RequestInit) => {
    if (url.endsWith("/api/show")) return Response.json({ capabilities: ["completion"] });
    const body = JSON.parse(String(init.body)); bodies.push(body);
    const reply = bodies.length === 1 ? "1. 3-1=2\nAnswer: 4" : "Four, obviously.";
    return new Response(`{"message":{"content":${JSON.stringify(reply)}},"done":true}\n`);
  };
  const response = await streamProviderChat(ollama, { messages: [{ role: "system", content: "Be a gnome." }, { role: "user", content: "Apples?" }], think: true, reasoning: true, grounding: "Today is 2026-09-24." }, transport);
  assert.equal(await response.text(), `${REASONING_START}1. 3-1=2\nAnswer: 4${REASONING_END}Four, obviously.`);
  assert.equal(bodies.length, 2);
  assert.match(bodies[0].messages[0].content, /step by step[\s\S]*Today is 2026-09-24/);
  assert.equal(bodies[0].messages.some((m: any) => m.content === "Be a gnome."), false);
  assert.match(bodies[1].messages[0].content, /^Be a gnome\.[\s\S]*Today is 2026-09-24[\s\S]*Answer: 4/);
  assert.equal("think" in bodies[0] && bodies[0].think, false);
});

test("search results become dated grounding and safe source links", () => {
  const found = [{ title: "Final", url: "https://example.com/final", snippet: "Spain 1-0 Argentina" }];
  const context = searchContext(found, new Date("2026-09-24T12:00:00Z"));
  assert.match(context, /Today is 2026-09-24/);
  assert.match(context, /\[1\] Final: Spain 1-0 Argentina/);
  assert.equal(searchContext([]), "");
  assert.deepEqual(decodeSources(encodeSources(found)), [{ title: "Final", url: "https://example.com/final" }]);
  assert.deepEqual(decodeSources(encodeURIComponent(JSON.stringify([{ title: "x", url: "javascript:alert(1)" }]))), []);
  assert.deepEqual(decodeSources("not json"), []);
});

test("settings use the default password Gnome until GNOME_ADMIN_TOKEN is set", () => {
  const saved = process.env.GNOME_ADMIN_TOKEN;
  const call = (password: string) => requireProviderAdmin(new Request("http://app.local/api/providers", { headers: { Authorization: `Bearer ${password}` } }));
  try {
    delete process.env.GNOME_ADMIN_TOKEN;
    assert.equal(usingDefaultPassword(), true);
    assert.doesNotThrow(() => call("Gnome"));
    assert.throws(() => call("gnome"), /password/);
    process.env.GNOME_ADMIN_TOKEN = "my-own-password";
    assert.equal(usingDefaultPassword(), false);
    assert.throws(() => call("Gnome"), /password/);
    assert.doesNotThrow(() => call("my-own-password"));
  } finally {
    if (saved === undefined) delete process.env.GNOME_ADMIN_TOKEN; else process.env.GNOME_ADMIN_TOKEN = saved;
  }
});
