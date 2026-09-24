import { normalizeMeta } from "../persona";
import type { NewCharacter } from "./types";

export function validateCharacter(raw: unknown): NewCharacter {
  if (!raw || typeof raw !== "object") throw new Error("Expected a persona object.");
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim() || typeof o.system_prompt !== "string" || !o.system_prompt.trim()) throw new Error("Name and personality instructions are required.");
  if (o.name.length > 60 || o.system_prompt.length > 16000) throw new Error("Name or personality instructions are too long.");
  const temperature = typeof o.temperature === "number" && Number.isFinite(o.temperature) ? Math.max(0.1, Math.min(1.4, o.temperature)) : 0.9;
  return { name: o.name.trim(), emoji: typeof o.emoji === "string" ? o.emoji.slice(0, 12) : "✨", description: typeof o.description === "string" ? o.description.slice(0, 400) : "", system_prompt: o.system_prompt.trim(), temperature, meta: normalizeMeta(o.meta ?? o, o.name, temperature) };
}
