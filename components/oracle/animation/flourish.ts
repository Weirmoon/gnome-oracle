import type { Appearance } from "@/lib/persona";

// A one-shot "finish" move played when the oracle stops speaking, keyed off the
// persona's held item. GnomeModel reads `kind` to pick which rig channel to
// animate; `particles` / `origin` drive the sparkle pop.

export type FlourishKind = "staff" | "spin" | "raise" | "nod";

export interface Flourish {
  kind: FlourishKind;
  particles: number;
  origin: [number, number, number];
}

export function flourishFor(a: Appearance): Flourish {
  const held = a.heldItem ?? "none";

  // wizard/gnome with a free hand → staff tap + orb flare
  if (held === "none" && (a.hat === "wizard" || a.hat === "gnome")) {
    return { kind: "staff", particles: 22, origin: [0.62, 1.6, 0] };
  }

  switch (held) {
    case "spatula":
    case "compass":
    case "wrench":
      return { kind: "spin", particles: 8, origin: [0.45, 0.1, 0.3] };
    case "telescope":
    case "microphone":
    case "red-flashlight":
    case "sword":
      return { kind: "raise", particles: 10, origin: [0.5, 0.7, 0.3] };
    case "flask":
    case "book":
    case "portal-gun":
    case "rock-hammer":
    case "fossil-brush":
    case "plant-shears":
      return { kind: "raise", particles: 12, origin: [0.45, 0.3, 0.3] };
    case "none":
    default:
      return { kind: "nod", particles: 14, origin: [0, 0.5, 0.35] };
  }
}
