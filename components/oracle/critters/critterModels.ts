import type { CritterId } from "./catalog";

/**
 * Authored 3D critter models.
 *
 * Drop a `.glb` into `public/critters/` and add an entry here to swap that
 * critter from the all-primitive `ProceduralCritter` to the real model. Anything
 * NOT listed here keeps rendering procedurally, and if a listed file fails to
 * load the procedural model is used as the fallback — so this can be filled in
 * one critter at a time.
 *
 * See `public/critters/README.md` for how the files should be authored
 * (orientation, scale, origin, format).
 */
export interface CritterModelCfg {
  /** File name inside `public/critters/`. */
  file: string;
  /** Uniform scale applied after load, to match the procedural sizing. */
  scale: number;
  /** Y-rotation (radians) so the model faces +x (ground critters) or +z
   *  (fliers) the same way the procedural version does. */
  yaw?: number;
  /** Local Y offset so the feet land on the group origin (the ground plane). */
  y?: number;
  /** Name of an animation clip in the glb to play on loop, if any. */
  clip?: string;
}

export const CRITTER_MODELS: Partial<Record<CritterId, CritterModelCfg>> = {
  // Fill in one at a time as the .glb files land in public/critters/, e.g.:
  //   wolf: { file: "wolf.glb", scale: 1, yaw: 0, y: 0 },
};
