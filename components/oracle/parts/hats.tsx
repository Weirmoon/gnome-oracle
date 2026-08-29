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
      return (
        <group>
          <mesh material={mats.hatDark} position={[0, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.46, 0.46, 0.04, 8]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.42, 0]}>
            <coneGeometry args={[0.3, 0.86, 7]} />
          </mesh>
          <Star r={0.07} material={mats.accent} position={[0, 0.4, 0.26]} />
          <Star r={0.05} material={mats.accent} position={[0.08, 0.68, 0.2]} />
        </group>
      );
    case "gnome":
      return (
        <group>
          <mesh material={mats.hat} position={[0, 0.4, 0]}>
            <coneGeometry args={[0.44, 0.95, 6]} />
          </mesh>
          <mesh material={mats.light} position={[0, 0.86, 0]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        </group>
      );
    case "fedora":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh material={mats.hatDark} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 0.04, 10]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.34, 8]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.33, 0.03, 6, 12]} />
          </mesh>
        </group>
      );
    case "cork":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh material={mats.hatDark} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 0.05, 12]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
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
            <cylinderGeometry args={[0.62, 0.62, 0.05, 12]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.4, 8]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.33, 0.025, 6, 12]} />
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
