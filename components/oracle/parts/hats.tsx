"use client";

import type { Appearance } from "@/lib/persona";
import { Star } from "./primitives";
import type { PartProps } from "./types";

/** Mirrors the 2D `hasStaff` check: wizard + gnome carry a staff. */
export function hasStaff(a: Appearance): boolean {
  return a.hat === "wizard" || a.hat === "gnome";
}

/** HatStyle -> faceted crystal headwear. Sits in the head's `hat` group. */
export function Hat({ appearance, mats }: PartProps) {
  switch (appearance.hat) {
    case "wizard":
      // Sheet 01: brim hugs the skull just above the brows, the cone grows
      // straight out of it, and a gold diamond gem sits at the join.
      return (
        <group>
          {/* Dished brim: a shallow inverted cone slopes down at the edge the
              way the reference does. A flat cylinder disc read as a halo. */}
          <mesh material={mats.hatDark} position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.58, 0.2, 18, 1, true]} />
          </mesh>
          <mesh material={mats.hatDark} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.1, 14]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.41, 0]}>
            <coneGeometry args={[0.35, 0.78, 9]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.1, 0.3]} rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.085, 0]} />
          </mesh>
          <Star r={0.055} material={mats.accent} position={[0.1, 0.52, 0.17]} />
        </group>
      );
    case "gnome":
      return (
        <group>
          <mesh material={mats.hat} position={[0, 0.36, 0]}>
            <coneGeometry args={[0.5, 0.88, 10]} />
          </mesh>
          <mesh material={mats.light} position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.095, 9, 7]} />
          </mesh>
        </group>
      );
    case "fedora":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh material={mats.hatDark} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.56, 0.56, 0.05, 18]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.32, 0.36, 0.36, 14]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.035, 6, 18]} />
          </mesh>
        </group>
      );
    case "cork":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh material={mats.hatDark} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 0.05, 20]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {[-0.32, -0.11, 0.11, 0.32].map((x, i) => (
            <mesh key={i} material={mats.light} position={[x, -0.05, 0.34]}>
              <sphereGeometry args={[0.035, 6, 5]} />
            </mesh>
          ))}
        </group>
      );
    case "cowboy":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh material={mats.hat} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]}>
            <cylinderGeometry args={[0.64, 0.64, 0.05, 20]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.32, 0.36, 0.42, 14]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.03, 6, 18]} />
          </mesh>
        </group>
      );
    case "none":
    default:
      return (
        <group>
          <Star r={0.06} material={mats.accent} position={[-0.12, 0.15, 0.2]} />
          <Star r={0.05} material={mats.accent} position={[0.14, 0.28, 0.15]} />
        </group>
      );
  }
}
