/** Portable provider contracts. No credentials belong in persisted client state. */
export type ProviderKind = "ollama" | "openrouter" | "lmstudio" | "openai-compatible";

export interface ProviderProfile {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  contextBudget: number;
  /** Ask thinking-capable models to reason before answering (never used for quips). */
  thinking: ThinkingMode;
  /** Extra tokens allowed for reasoning; Ollama counts them against num_predict. */
  thinkingBudget: number;
  /** Default answer length in tokens. */
  replyLength: number;
  /** Ollama keep_alive: how long the model stays loaded ("-1" = forever). */
  keepAlive: string;
  /** Ollama num_thread; undefined lets Ollama choose. */
  numThread?: number;
  hasApiKey: boolean;
}

export type ThinkingMode = "off" | "on";

export const PROFILE_TUNING_DEFAULTS = { thinking: "off" as ThinkingMode, thinkingBudget: 1024, replyLength: 200, keepAlive: "30m" };

/** Exists only within the trusted server/native transport. Never return this to the UI. */
export interface ProviderConnection extends Omit<ProviderProfile, "hasApiKey"> {
  apiKey?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  numPredict?: number;
  /** true/false is sent explicitly; undefined leaves the model's own default. */
  think?: boolean;
  /** Facts to answer from (e.g. web results); every pass of the answer sees them. */
  grounding?: string;
  /** Forward reasoning text, framed by REASONING_START/END, instead of dropping it. */
  reasoning?: boolean;
  signal?: AbortSignal;
}

export interface ProviderModel { id: string; name: string }

export const PROVIDER_DEFAULTS: Record<ProviderKind, { name: string; baseUrl: string; model: string }> = {
  ollama: { name: "Ollama", baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b-instruct" },
  openrouter: { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "" },
  lmstudio: { name: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", model: "" },
  "openai-compatible": { name: "OpenAI-compatible", baseUrl: "http://127.0.0.1:8000/v1", model: "" },
};

export class ProviderError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "ProviderError";
  }
}

export function validateProfile(input: unknown): Omit<ProviderProfile, "hasApiKey" | "id"> & { id?: string } {
  if (!input || typeof input !== "object") throw new ProviderError("A connection profile is required.", 400);
  const value = input as Record<string, unknown>;
  const kind = value.kind;
  if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(PROVIDER_DEFAULTS, kind)) {
    throw new ProviderError("Choose a supported provider type.", 400);
  }
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  if (!name || name.length > 80) throw new ProviderError("Profile name must contain 1–80 characters.", 400);
  if (!model || model.length > 200) throw new ProviderError("Enter a model identifier (up to 200 characters).", 400);
  if (typeof value.baseUrl !== "string" || value.baseUrl.length > 2048) throw new ProviderError("Enter a valid base URL.", 400);
  let url: URL;
  try { url = new URL(value.baseUrl.trim()); } catch { throw new ProviderError("Enter a valid absolute base URL.", 400); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ProviderError("Use an HTTP or HTTPS base URL without credentials, query parameters, or a fragment.", 400);
  }
  if (kind === "openrouter" && url.protocol !== "https:") throw new ProviderError("OpenRouter connections require HTTPS.", 400);
  const contextBudget = value.contextBudget === undefined ? 4096 : Number(value.contextBudget);
  if (!Number.isInteger(contextBudget) || contextBudget < 512 || contextBudget > 131072) {
    throw new ProviderError("Context budget must be an integer from 512 to 131072 tokens.", 400);
  }
  const tuning = validateTuning(value);
  const id = value.id;
  if (id !== undefined && (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) {
    throw new ProviderError("Invalid connection identifier.", 400);
  }
  return { id: id as string | undefined, name, model, kind: kind as ProviderKind, baseUrl: url.toString().replace(/\/+$/, ""), contextBudget, ...tuning };
}

function integerIn(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new ProviderError(`${label} must be an integer from ${min} to ${max}.`, 400);
  return number;
}

/** Tuning fields are optional so profiles saved before they existed still load. */
export function validateTuning(value: Record<string, unknown>): Pick<ProviderProfile, "thinking" | "thinkingBudget" | "replyLength" | "keepAlive" | "numThread"> {
  const d = PROFILE_TUNING_DEFAULTS;
  if (value.thinking !== undefined && value.thinking !== "off" && value.thinking !== "on") throw new ProviderError("Thinking must be on or off.", 400);
  const keepAlive = value.keepAlive === undefined || value.keepAlive === "" ? d.keepAlive : String(value.keepAlive).trim();
  if (!/^(-1|0|\d{1,4}[smh])$/.test(keepAlive)) throw new ProviderError("Keep-loaded time must look like 30m, 2h, 0, or -1 (forever).", 400);
  const numThread = value.numThread === undefined || value.numThread === null || value.numThread === "" ? undefined : integerIn(value.numThread, 0, 1, 64, "CPU threads");
  return {
    thinking: (value.thinking as ThinkingMode | undefined) ?? d.thinking,
    thinkingBudget: integerIn(value.thinkingBudget, d.thinkingBudget, 256, 4096, "Thinking budget"),
    replyLength: integerIn(value.replyLength, d.replyLength, 64, 2048, "Reply length"),
    keepAlive,
    ...(numThread !== undefined ? { numThread } : {}),
  };
}
