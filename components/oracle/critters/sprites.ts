import type { CritterId } from "./catalog";

/**
 * 2D critter sprites — the "Sprite" avatar mode.
 *
 * Drop `<id>.png` (transparent background, one clean side/profile pose cropped
 * from the reference sheets) into `public/critters-2d/` and add an entry here.
 * In "Sprite" mode `OracleCanvas` draws the image instead of the faceted
 * `drawCritter` trace; a missing or unloaded file falls back to the trace, so
 * this fills in one critter at a time.
 *
 * Source sheets: `assets/critter-reference-lowpoly/` (original 12) and
 * `assets/critter-reference-lowpoly-2/` (wolf … chameleon). Face the critter the
 * same way the trace does — the pose is mirrored automatically when the critter
 * is on the gnome's other side.
 */
export interface SpriteCfg {
  file: string;
  /** Drawn height in canvas units (a critter reads at ~40–60 tall vs the ~52 gnome head). */
  h: number;
  /** Vertical anchor point in the image, 0 (top) … 1 (bottom), placed at the
   *  critter's hold position. Default 0.5 (centre) matches how the traces sit;
   *  raise toward ~0.7 for a tall standing pose so it doesn't float. */
  anchorY?: number;
}

export const CRITTER_SPRITES: Partial<Record<CritterId, SpriteCfg>> = {
  // Fill in as PNGs land in public/critters-2d/, e.g.:
  //   fox: { file: "fox.png", h: 54 },
};

const cache = new Map<string, HTMLImageElement | "error">();

/** The loaded sprite for a critter, or null if none configured / not ready / errored. */
export function getCritterSprite(id: CritterId): HTMLImageElement | null {
  const cfg = CRITTER_SPRITES[id];
  if (!cfg || typeof Image === "undefined") return null;

  let entry = cache.get(cfg.file);
  if (entry === "error") return null;
  if (!entry) {
    const img = new Image();
    img.onerror = () => cache.set(cfg.file, "error");
    img.src = `/critters-2d/${cfg.file}`;
    cache.set(cfg.file, img);
    entry = img;
  }
  return entry.complete && entry.naturalWidth > 0 ? entry : null;
}
