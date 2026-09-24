import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ProviderError, validateProfile, type ProviderConnection, type ProviderProfile } from "./types";

interface EncryptedKey { iv: string; tag: string; ciphertext: string }
interface StoredProfile extends Omit<ProviderProfile, "hasApiKey"> { secret?: EncryptedKey }
interface ProviderStore { version: 1; activeProfileId: string; profiles: StoredProfile[] }

function storePath() { return path.join(process.env.GNOME_DATA_DIR || path.join(process.cwd(), "data"), "providers.json"); }

function deploymentKey(): Buffer {
  const secret = process.env.GNOME_DEPLOYMENT_SECRET;
  if (!secret || secret.length < 32) throw new ProviderError("Set GNOME_DEPLOYMENT_SECRET to a persistent secret of at least 32 characters before saving API keys.", 503);
  return createHash("sha256").update(secret).digest();
}

function encrypt(apiKey: string, id: string): EncryptedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deploymentKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

function decrypt(secret: EncryptedKey, id: string): string {
  const key = deploymentKey();
  try {
    const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"));
    cipher.setAAD(Buffer.from(id));
    cipher.setAuthTag(Buffer.from(secret.tag, "base64"));
    return Buffer.concat([cipher.update(Buffer.from(secret.ciphertext, "base64")), cipher.final()]).toString("utf8");
  } catch { throw new ProviderError("The saved API key could not be unlocked. Restore the deployment secret or re-enter the API key.", 503); }
}

function initialStore(): ProviderStore {
  const value = Number.parseInt(process.env.OLLAMA_NUM_CTX || "8192", 10);
  return {
    version: 1,
    activeProfileId: "ollama-default",
    profiles: [{
      id: "ollama-default", name: "Local Ollama", kind: "ollama",
      baseUrl: (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, ""),
      model: process.env.OLLAMA_MODEL || "gemma2:2b",
      contextBudget: Number.isFinite(value) && value >= 512 ? Math.min(value, 131072) : 8192,
    }],
  };
}

function readStore(): ProviderStore {
  const file = storePath();
  if (!fs.existsSync(file)) return initialStore();
  try {
    const store = JSON.parse(fs.readFileSync(file, "utf8")) as ProviderStore;
    if (store.version !== 1 || !Array.isArray(store.profiles) || !store.profiles.length || !store.profiles.some(p => p.id === store.activeProfileId)) throw new Error();
    return store;
  } catch { throw new ProviderError("The saved connections could not be read. Restore the provider configuration from a server backup.", 503); }
}

function writeStore(store: ProviderStore) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
  } catch {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw new ProviderError("The server could not save connections. Check data-directory write permissions.", 503);
  }
}

function redact(profile: StoredProfile): ProviderProfile {
  return { id: profile.id, name: profile.name, kind: profile.kind, baseUrl: profile.baseUrl, model: profile.model, contextBudget: profile.contextBudget, hasApiKey: !!profile.secret };
}

export function listProfiles(): { profiles: ProviderProfile[]; activeProfileId: string } {
  const store = readStore();
  return { activeProfileId: store.activeProfileId, profiles: store.profiles.map(redact) };
}

export function captureProvider(id?: string): Readonly<ProviderConnection> {
  const store = readStore();
  const profile = store.profiles.find(value => value.id === (id || store.activeProfileId));
  if (!profile) throw new ProviderError("That connection no longer exists. Choose another connection.", 404);
  const { secret, ...details } = profile;
  return Object.freeze({ ...details, ...(secret ? { apiKey: decrypt(secret, profile.id) } : {}) });
}

function secretFor(input: Record<string, unknown>, profile: ReturnType<typeof validateProfile> & { id: string }, prior?: StoredProfile): EncryptedKey | undefined {
  if (input.apiKey !== undefined && (typeof input.apiKey !== "string" || input.apiKey.length > 8192 || /[\r\n]/.test(input.apiKey))) {
    throw new ProviderError("The API key is invalid.", 400);
  }
  const key = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  if (key) return encrypt(key, profile.id);
  if (input.clearApiKey === true) return undefined;
  if (prior?.secret && (profile.baseUrl !== prior.baseUrl || profile.kind !== prior.kind)) {
    throw new ProviderError("Re-enter or clear the API key when changing a connection’s provider or base URL.", 400);
  }
  return prior?.secret;
}

export function saveProfile(input: unknown): ProviderProfile {
  const profile = validateProfile(input);
  const store = readStore();
  const prior = profile.id ? store.profiles.find(value => value.id === profile.id) : undefined;
  if (profile.id && !prior) throw new ProviderError("That connection no longer exists.", 404);
  if (!prior && store.profiles.length >= 32) throw new ProviderError("At most 32 connections can be saved.", 400);
  const details = { ...profile, id: prior?.id || randomUUID() };
  const updated: StoredProfile = { ...details, secret: secretFor(input as Record<string, unknown>, details, prior) };
  if (updated.kind === "openrouter" && !updated.secret) throw new ProviderError("OpenRouter requires an API key.", 400);
  store.profiles = prior ? store.profiles.map(value => value.id === prior.id ? updated : value) : [...store.profiles, updated];
  // Saving never activates a new provider. Activation is a separate explicit action.
  writeStore(store);
  return redact(updated);
}

/** Resolve transient test fields without writing them or exposing a stored key. */
export function previewConnection(input: unknown): ProviderConnection {
  const profile = validateProfile(input);
  const store = readStore();
  const prior = profile.id ? store.profiles.find(value => value.id === profile.id) : undefined;
  const details = { ...profile, id: prior?.id || randomUUID() };
  const value = input as Record<string, unknown>;
  const explicitKey = typeof value.apiKey === "string" ? value.apiKey.trim() : "";
  if (explicitKey && (explicitKey.length > 8192 || /[\r\n]/.test(explicitKey))) throw new ProviderError("The API key is invalid.", 400);
  if (!explicitKey && prior?.secret && value.clearApiKey !== true && (profile.baseUrl !== prior.baseUrl || profile.kind !== prior.kind)) {
    throw new ProviderError("Re-enter or clear the API key when changing a connection’s destination.", 400);
  }
  const apiKey = explicitKey || (prior?.secret && value.clearApiKey !== true ? decrypt(prior.secret, prior.id) : undefined);
  if (profile.kind === "openrouter" && !apiKey) throw new ProviderError("OpenRouter requires an API key.", 400);
  return { ...details, apiKey };
}

export function activateProfile(id: unknown) {
  const store = readStore();
  if (typeof id !== "string" || !store.profiles.some(value => value.id === id)) throw new ProviderError("Choose an existing connection.", 400);
  store.activeProfileId = id;
  writeStore(store);
}

export function deleteProfile(id: unknown) {
  const store = readStore();
  if (id === store.activeProfileId) throw new ProviderError("Activate another connection before deleting this one.", 400);
  if (typeof id !== "string" || !store.profiles.some(value => value.id === id)) throw new ProviderError("That connection no longer exists.", 404);
  store.profiles = store.profiles.filter(value => value.id !== id);
  writeStore(store);
}
