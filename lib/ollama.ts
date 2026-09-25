/** Compatibility exports for existing routes; new work should import providers/server. */
export { streamChat, generateJSON, captureActiveProvider } from "./providers/server";
export type { ChatMessage } from "./providers/types";

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct";
export const OLLAMA_NUM_CTX = Number.parseInt(process.env.OLLAMA_NUM_CTX ?? "4096", 10);

/** Provider transport now returns normalized plain text for all providers. */
export function ndjsonToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> { return body; }
