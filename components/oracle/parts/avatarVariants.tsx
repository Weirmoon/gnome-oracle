"use client";

import * as THREE from "three";
import type { AvatarVariant } from "@/lib/persona";

/**
 * Non-gnome body variants — additive silhouette accents layered on the shared
 * rig so animation, lip-sync and critter reactions keep working unchanged.
 *
 * Mounted TWICE by `GnomeModel`: once in the head group (`slot="head"`) and once
 * in the body group (`slot="body"`), each returning only the shapes that belong
 * in that coordinate space. Head-group origin is the head centre (radius ~0.46,
 * +z = face); body-group origin is the torso.
 *
 * These are still first-pass stubs — a few large faceted shapes each. Richer
 * geometry per variant is Part D2.
 */
const geo = {
  ball: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
};
const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true, ...opts });

const FUR = mat("#75616a");
const FUR_DK = mat("#3e3440");
const GOWN = mat("#d26a9a");
const GHOST = mat("#b9f4ef", { transparent: true, opacity: 0.6, roughness: 0.4 });
const STONE = mat("#737b87");
const STONE_DK = mat("#454b56");
const GOBLIN = mat("#79a94e");
const CORE = new THREE.MeshStandardMaterial({ color: "#ffd66b", emissive: "#ffd66b", emissiveIntensity: 1.3 });

export type VariantSlot = "head" | "body";

export function AvatarVariantBody({
  variant,
  slot,
}: {
  variant?: AvatarVariant;
  slot: VariantSlot;
}) {
  if (!variant || variant === "gnome") return null;

  switch (variant) {
    case "werewolf":
      return slot === "head" ? (
        <group>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geo.cone}
              material={FUR}
              position={[s * 0.34, 0.34, -0.02]}
              rotation={[0, 0, -s * 0.32]}
              scale={[0.11, 0.42, 0.09]}
            />
          ))}
          <mesh geometry={geo.ball} material={FUR_DK} position={[0, -0.13, 0.34]} scale={[0.2, 0.16, 0.2]} />
        </group>
      ) : (
        <mesh geometry={geo.ball} material={FUR_DK} position={[0, 0.3, 0.16]} scale={[0.48, 0.2, 0.36]} />
      );

    case "goblin":
      return slot === "head" ? (
        <group>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geo.cone}
              material={GOBLIN}
              position={[s * 0.44, 0.05, -0.05]}
              rotation={[0, 0, -s * 1.2]}
              scale={[0.1, 0.46, 0.08]}
            />
          ))}
          <mesh geometry={geo.cone} material={GOBLIN} position={[0, -0.05, 0.4]} rotation={[1.3, 0, 0]} scale={[0.09, 0.22, 0.09]} />
        </group>
      ) : null;

    case "lady":
      return slot === "head" ? (
        <group>
          <mesh geometry={geo.ball} material={GOWN} position={[0, 0.14, -0.16]} scale={[0.54, 0.52, 0.44]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.ball} material={GOWN} position={[s * 0.4, -0.3, -0.06]} scale={[0.16, 0.36, 0.16]} />
          ))}
        </group>
      ) : null;

    case "ghost":
      return slot === "body" ? (
        <mesh
          geometry={geo.cone}
          material={GHOST}
          position={[0, -0.78, 0.02]}
          rotation={[Math.PI, 0, 0]}
          scale={[0.64, 0.95, 0.64]}
        />
      ) : null;

    case "stone-golem":
      return slot === "head" ? (
        <mesh geometry={geo.box} material={STONE_DK} position={[0, 0.2, 0.28]} scale={[0.72, 0.14, 0.16]} />
      ) : (
        <group>
          <mesh geometry={geo.box} material={STONE} position={[0, 0.22, 0.12]} scale={[0.8, 0.68, 0.52]} />
          <mesh geometry={geo.ball} material={CORE} position={[0, 0.26, 0.42]} scale={0.11} />
        </group>
      );

    case "young-apprentice":
      return slot === "body" ? (
        <mesh geometry={geo.box} material={GOWN} position={[0, 0.34, 0.2]} scale={[0.5, 0.12, 0.14]} />
      ) : null;

    default:
      return null;
  }
}
