/** Portable provider contracts. No credentials belong in persisted client state. */
export type ProviderKind = "ollama" | "openrouter" | "lmstudio" | "openai-compatible";

export interface ProviderProfile {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  contextBudget: number;
  hasApiKey: boolean;
}

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
  signal?: AbortSignal;
}

export interface ProviderModel { id: string; name: string }

export const PROVIDER_DEFAULTS: Record<ProviderKind, { name: string; baseUrl: string; model: string }> = {
  ollama: { name: "Ollama", baseUrl: "http://127.0.0.1:11434", model: "gemma2:2b" },
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
  const contextBudget = value.contextBudget === undefined ? 8192 : Number(value.contextBudget);
  if (!Number.isInteger(contextBudget) || contextBudget < 512 || contextBudget > 131072) {
    throw new ProviderError("Context budget must be an integer from 512 to 131072 tokens.", 400);
  }
  const id = value.id;
  if (id !== undefined && (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) {
    throw new ProviderError("Invalid connection identifier.", 400);
  }
  return { id: id as string | undefined, name, model, kind: kind as ProviderKind, baseUrl: url.toString().replace(/\/+$/, ""), contextBudget };
}
