/**
 * Ambient critter roster — the fields the CLIENT needs.
 *
 * The per-critter prompt text and offline fallback lines deliberately live in
 * `prompts.server.ts` instead: `app/page.tsx` imports this module for the slash
 * command and the summon buttons, and shipping that prose to the browser cost
 * ~3 kB of the "/" First Load JS budget for strings only the API route reads.
 *
 * Must stay free of `three` and of any browser/node-only API.
 */

export type CritterId =
  | "fairy" | "dragon" | "deer" | "wisp" | "imp" | "raincloud"
  | "moth" | "snail" | "crow" | "fireflies" | "gust" | "toad";

export type CritterReaction =
  | "zap"      // turn, cast bolts at it, shoo — brows down, muttering
  | "swat"     // big sweeping hand waves, head shake, lean back
  | "startle"  // jump + scale pop + eyes wide, settle into a glare
  | "calm"     // slow down, head tracks it gently, soft smile, no attack
  | "guard"    // staff raised and HELD, weight back, tense stillness
  | "grab-hat" // hat rides off with the critter; hand to bare head; fist shake
  | "wait";    // foot/hand tap loop, eye-roll, one big exasperated sigh

export type CritterPath = "flit" | "swoop" | "walk" | "drift" | "burst" | "descend";
export type CritterSide = "left" | "right" | "top" | "front";
export type CritterSfx = "sparkle" | "rumble" | "soft" | "buzz" | "gust" | "caw";

export interface Critter {
  id: CritterId;
  name: string;
  emoji: string;
  reaction: CritterReaction;
  path: CritterPath;
  side: CritterSide;
  /** Whole event: enter + react + exit. */
  durationMs: number;
  /** Critter glow + its particle colour. */
  tint: string;
  sfx: CritterSfx;
  /** Ambient random-picker weight. */
  weight: number;
}

export const CRITTERS: Record<CritterId, Critter> = {
  fairy: {
    id: "fairy", name: "Fairy", emoji: "🧚", reaction: "zap", path: "flit", side: "left",
    durationMs: 9000, tint: "#8ef0d0", sfx: "sparkle", weight: 12,
  },
  imp: {
    id: "imp", name: "Imp", emoji: "😈", reaction: "zap", path: "burst", side: "right",
    durationMs: 9000, tint: "#ff8a5c", sfx: "buzz", weight: 9,
  },
  raincloud: {
    id: "raincloud", name: "Raincloud", emoji: "🌧️", reaction: "swat", path: "drift", side: "top",
    durationMs: 8500, tint: "#7fa8d8", sfx: "soft", weight: 8,
  },
  dragon: {
    id: "dragon", name: "Dragon", emoji: "🐉", reaction: "guard", path: "descend", side: "front",
    durationMs: 10000, tint: "#ff6b4a", sfx: "rumble", weight: 6,
  },
  crow: {
    id: "crow", name: "Crow", emoji: "🐦‍⬛", reaction: "grab-hat", path: "swoop", side: "top",
    durationMs: 9000, tint: "#9aa7c7", sfx: "caw", weight: 7,
  },
  gust: {
    id: "gust", name: "Dust gust", emoji: "🍃", reaction: "startle", path: "burst", side: "left",
    durationMs: 7000, tint: "#cfd6b8", sfx: "gust", weight: 8,
  },
  deer: {
    id: "deer", name: "Deer", emoji: "🦌", reaction: "calm", path: "walk", side: "right",
    durationMs: 9500, tint: "#d8b98a", sfx: "soft", weight: 9,
  },
  moth: {
    id: "moth", name: "Luna moth", emoji: "🦋", reaction: "calm", path: "flit", side: "top",
    durationMs: 8000, tint: "#b6f2c9", sfx: "soft", weight: 9,
  },
  fireflies: {
    id: "fireflies", name: "Fireflies", emoji: "✨", reaction: "calm", path: "drift", side: "front",
    durationMs: 8500, tint: "#ffe08a", sfx: "sparkle", weight: 9,
  },
  toad: {
    id: "toad", name: "Toad", emoji: "🐸", reaction: "calm", path: "walk", side: "front",
    durationMs: 8000, tint: "#8fbf6a", sfx: "soft", weight: 8,
  },
  snail: {
    id: "snail", name: "Snail", emoji: "🐌", reaction: "wait", path: "walk", side: "front",
    durationMs: 11000, tint: "#e0a86a", sfx: "soft", weight: 7,
  },
  wisp: {
    id: "wisp", name: "Will-o'-wisp", emoji: "🔮", reaction: "startle", path: "drift", side: "right",
    durationMs: 8000, tint: "#8fe6e0", sfx: "sparkle", weight: 8,
  },
};

export const CRITTER_LIST: Critter[] = Object.values(CRITTERS);

export function isCritterId(v: unknown): v is CritterId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CRITTERS, v);
}

/** Weighted pick, optionally excluding ids already seen this session. */
export function pickCritter(exclude: ReadonlySet<CritterId> = new Set()): Critter {
  const pool = CRITTER_LIST.filter((c) => !exclude.has(c.id));
  const list = pool.length ? pool : CRITTER_LIST;
  const total = list.reduce((n, c) => n + c.weight, 0);
  let r = Math.random() * total;
  for (const c of list) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return list[list.length - 1];
}

