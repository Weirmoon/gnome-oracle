"use client";

import * as THREE from "three";

/**
 * The base body silhouette, shared by `GnomeModel` and every part builder.
 *
 * Reference sheet 01 shows a chibi gnome with a SHORT tunic ending mid-shin and
 * two stubby boots below it — not a floor-length cone. These constants are the
 * single source of truth for that shape so costume overlays, patterns and
 * accessories can be placed against the real surface instead of guessing.
 */

/** World-space y of the ground / bottom of the boots. */
export const GROUND_Y = -1.12;
/** World-space y of the tunic hem. Boots + legs live below this. */
export const HEM_Y = -0.78;
/** World-space y of the shoulder line (top of the tunic lathe). */
export const SHOULDER_Y = 0.16;
/** Head centre, world space. */
export const HEAD_Y = 0.62;
/** Head radius. */
export const HEAD_R = 0.46;

/**
 * Tunic profile as `[radius, y]` pairs, bottom to top. Feeds both the
 * `LatheGeometry` and `frontZ()`.
 */
export const ROBE_PROFILE: [number, number][] = [
  [0.02, HEM_Y],
  [0.44, HEM_Y + 0.01],
  [0.46, -0.60],
  [0.45, -0.34],
  [0.43, -0.08],
  [0.39, 0.05],
  [0.30, SHOULDER_Y],
  [0.15, SHOULDER_Y + 0.05],
];

/** Radial segment count for the tunic — high enough that it never reads as a polygon. */
export const ROBE_SEGMENTS = 14;

export function makeRobeGeometry(): THREE.LatheGeometry {
  const pts = ROBE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, ROBE_SEGMENTS);
}

/**
 * Radius of the tunic at world height `y`, linearly interpolated along
 * `ROBE_PROFILE`. Clamped outside the profile's range.
 */
export function robeRadius(y: number): number {
  const p = ROBE_PROFILE;
  if (y <= p[0][1]) return p[0][0];
  if (y >= p[p.length - 1][1]) return p[p.length - 1][0];
  for (let i = 0; i < p.length - 1; i++) {
    const [r0, y0] = p[i];
    const [r1, y1] = p[i + 1];
    if (y >= y0 && y <= y1) {
      const k = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * k;
    }
  }
  return p[p.length - 1][0];
}

/**
 * Z at which a flat overlay sits just PROUD of the tunic surface at height `y`.
 *
 * A lathe is round, so its front face recedes as you move off centre; anything
 * placed at a fixed z (the old code used a flat 0.30–0.35 everywhere) sinks
 * into the body. Pass the overlay's half-width as `halfWidth` to keep its outer
 * corners clear too.
 */
export function frontZ(y: number, halfWidth = 0, lift = 0.02): number {
  const r = robeRadius(y);
  const inner = Math.max(0, r * r - halfWidth * halfWidth);
  return Math.sqrt(inner) + lift;
}

/** Same idea for the head sphere: z just proud of the skull at head-local `y`/`x`. */
export function headZ(y: number, x = 0, lift = 0.01): number {
  const inner = Math.max(0.01, HEAD_R * HEAD_R - x * x - y * y);
  return Math.sqrt(inner) + lift;
}
