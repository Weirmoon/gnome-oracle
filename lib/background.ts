/** Public, credential-free Background Studio document. */
export type BackgroundEffect = "gradient" | "matrix" | "constellations" | "particles";
export type BackgroundQuality = "auto" | "low" | "high";

export interface BackgroundConfig {
  effect: BackgroundEffect;
  backgroundColor: string;
  accentColor: string;
  speed: number;
  density: number;
  brightness: number;
  interactionStrength: number;
  quality: BackgroundQuality;
  glyphs: string;
  connectionDistance: number;
  particleInteraction: "attract" | "repel";
}

export interface BackgroundPreset {
  id: string;
  name: string;
  config: BackgroundConfig;
}

export interface BackgroundDocument {
  version: 1;
  config: BackgroundConfig;
  presets: BackgroundPreset[];
}

export const BACKGROUND_STORAGE_KEY = "gnome.background.v1";
export const BACKGROUND_CHANGE_EVENT = "gnome:background-change";
export const BACKGROUND_PULSE_EVENT = "gnome:background-pulse";

const shared: BackgroundConfig = {
  effect: "gradient", backgroundColor: "#1a1033", accentColor: "#c9a6ff",
  speed: 0.7, density: 0.5, brightness: 0.4, interactionStrength: 0.5,
  quality: "auto", glyphs: "01アイウエオカキクケコサシスセソ", connectionDistance: 125,
  particleInteraction: "repel",
};

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  { id: "gradient", name: "Original Gradient", config: { ...shared, accentColor: "#2a1a4a" } },
  { id: "matrix", name: "Matrix Rain", config: { ...shared, effect: "matrix", backgroundColor: "#07100d", accentColor: "#7efca0", speed: 1, density: 0.65, brightness: 0.5 } },
  { id: "constellations", name: "Constellations", config: { ...shared, effect: "constellations", backgroundColor: "#11152d", accentColor: "#b3c7ff", density: 0.4, brightness: 0.35 } },
  { id: "particles", name: "Enchanted Particles", config: { ...shared, effect: "particles", backgroundColor: "#1b1230", accentColor: "#e3b8ff", brightness: 0.5, speed: 0.6 } },
];

export function defaultBackgroundDocument(existingInstallation: boolean): BackgroundDocument {
  return { version: 1, config: { ...BACKGROUND_PRESETS[existingInstallation ? 0 : 2].config }, presets: [] };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function bounded(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function color(value: unknown): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Colors must use six-digit hex values.");
  return value;
}

export function parseBackgroundConfig(value: unknown): BackgroundConfig {
  const data = object(value, "Background settings");
  if (!["gradient", "matrix", "constellations", "particles"].includes(String(data.effect))) throw new Error("Unknown background effect.");
  if (!["auto", "low", "high"].includes(String(data.quality))) throw new Error("Unknown background quality.");
  if (typeof data.glyphs !== "string" || !data.glyphs.trim() || [...data.glyphs].length > 80 || /[\u0000-\u001f\u007f]/.test(data.glyphs)) throw new Error("Use 1–80 printable glyphs.");
  if (data.particleInteraction !== "attract" && data.particleInteraction !== "repel") throw new Error("Choose attract or repel for particles.");
  // Construct explicitly: extra properties cannot enter exports, styles, or state.
  return {
    effect: data.effect as BackgroundEffect,
    backgroundColor: color(data.backgroundColor), accentColor: color(data.accentColor),
    speed: bounded(data.speed, 0, 2, "Speed"), density: bounded(data.density, 0.1, 1, "Density"),
    brightness: bounded(data.brightness, 0, 1, "Brightness"),
    interactionStrength: bounded(data.interactionStrength, 0, 1, "Interaction strength"),
    quality: data.quality as BackgroundQuality, glyphs: data.glyphs,
    connectionDistance: bounded(data.connectionDistance, 40, 240, "Connection distance"),
    particleInteraction: data.particleInteraction,
  };
}

export function parseBackgroundDocument(value: unknown): BackgroundDocument {
  const data = object(value, "Background file");
  if (data.version !== 1) throw new Error("This background file version is not supported.");
  if (!Array.isArray(data.presets) || data.presets.length > 40) throw new Error("A background file can contain up to 40 custom presets.");
  const ids = new Set<string>();
  const presets = data.presets.map((value) => {
    const item = object(value, "Preset");
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || BACKGROUND_PRESETS.some((preset) => preset.id === item.id)) throw new Error("Custom preset IDs must be unique.");
    if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 60) throw new Error("Preset names must contain 1–60 characters.");
    ids.add(item.id);
    return { id: item.id, name: item.name.trim(), config: parseBackgroundConfig(item.config) };
  });
  return { version: 1, config: parseBackgroundConfig(data.config), presets };
}

export function parseBackgroundFile(text: string): BackgroundDocument {
  if (text.length > 100_000) throw new Error("Choose a background JSON file smaller than 100 KB.");
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("The background file is not valid JSON."); }
  return parseBackgroundDocument(data);
}

/** Coordinates are viewport coordinates. With no position the pulse starts centrally. */
export function emitBackgroundPulse(x?: number, y?: number): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BACKGROUND_PULSE_EVENT, { detail: { x, y } }));
}
