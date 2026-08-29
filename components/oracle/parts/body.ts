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
export const HEM_Y = -0.9;
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
  [0.47, HEM_Y + 0.01],
  [0.46, -0.62],
  [0.44, -0.34],
  [0.42, -0.08],
  [0.38, 0.05],
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

/**
 * A costume shell: a copy of the tunic profile, slightly inflated, so a coat
 * or shirt wraps the body instead of floating in front of it as a flat panel.
 *
 * `phiLength < 2π` leaves a gap at the FRONT (the lathe is rotated so the gap
 * is centred on +Z), which is how the open coats on sheet 06 show the crystal
 * robe underneath.
 */
export function makeShellGeometry(
  inflate = 1.04,
  phiLength = Math.PI * 2,
  yFrom = -Infinity,
  yTo = Infinity
): THREE.LatheGeometry {
  const pts = ROBE_PROFILE.filter(([, y]) => y >= yFrom && y <= yTo).map(
    ([r, y]) => new THREE.Vector2(Math.max(0.015, r * inflate), y)
  );
  if (pts.length < 2) pts.push(new THREE.Vector2(0.02, yFrom));
  // three's LatheGeometry puts phi=0 on +Z, so starting at gap/2 centres the
  // opening on the FRONT of the body.
  const gap = Math.PI * 2 - phiLength;
  return new THREE.LatheGeometry(pts, ROBE_SEGMENTS, gap / 2, phiLength);
}

/** Shared, appearance-independent shells. Module scope so cycling personas allocates nothing. */
export const SHELL = {
  /** Full wrap — closed shirts, suits, coveralls. */
  closed: makeShellGeometry(1.04),
  /** Open front — coats and vests that reveal the robe beneath. */
  open: makeShellGeometry(1.05, Math.PI * 2 - 0.95),
  /** Upper body only (shirt half of a shirt+shorts pairing). */
  upper: makeShellGeometry(1.04, Math.PI * 2, -0.3, Infinity),
  /** Lower body only (shorts / trousers). */
  lower: makeShellGeometry(1.05, Math.PI * 2, -Infinity, -0.24),
};
