"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { shadeHex } from "@/lib/persona";
import type { Appearance } from "@/lib/persona";
import type { AvatarTier } from "../useAvatarCapability";

export interface PersonaMaterials {
  /** Main crystal costume body. */
  robe: THREE.Material;
  /** Darker crystal — linings, undersides, coat tails. */
  robeDark: THREE.Material;
  /** Crystal hat. */
  hat: THREE.Material;
  /** Darker crystal hat — brims, bands. */
  hatDark: THREE.Material;
  /** Skin (head, hands, nose) — faceted but matte-ish. */
  skin: THREE.Material;
  /** Beard / hair / cloth — matte + faceted so it reads against the crystal. */
  cloth: THREE.Material;
  /** Accent-coloured emissive — trims, gems, pattern lines. */
  accent: THREE.Material;
  /** Bright unlit accent core for the inner glow. */
  accentCore: THREE.Material;
  /** Dark near-black — pupils, mouth, boots, iron. */
  dark: THREE.Material;
  /** Rosy cheek blush — matte, never accent-coloured (sheet 01). */
  blush: THREE.Material;
  /** Violet iris ring inside the eye. */
  iris: THREE.Material;
  /** Unlit white specular dot in the eye. */
  glint: THREE.Material;
  /** Off-white — pom-poms, collars, teeth. */
  light: THREE.Material;
  /** Wood — staves, handles, hammer shafts. */
  wood: THREE.Material;
  /** Metal — blades, tools, buckles. */
  metal: THREE.Material;
  /** Translucent glass — flasks, goggles, orbs. */
  glass: THREE.Material;
}

/**
 * The faceted "crystal" costume material.
 *
 * NOTE: this deliberately does NOT use `transmission` / `clearcoat` /
 * `iridescence`. Those are environment-driven — with no env map in the scene
 * (`envMapIntensity: 0`) they cost real GPU time and contribute essentially
 * nothing, which is why the robe used to read as flat matte plastic. The
 * reference art is stylised painted crystal, not physically refractive, so the
 * facet read comes from `flatShading` + dense geometry + a high-contrast light
 * rig instead, with a low emissive lift standing in for the inner glow.
 */
function crystal(color: string, accent: string, tier: AvatarTier): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: tier === "low" ? 0.5 : 0.34,
    metalness: 0,
    emissive: accent,
    emissiveIntensity: tier === "low" ? 0.1 : 0.13,
  });
}

/**
 * Memoised bundle of materials derived from a persona's `Appearance`. All
 * materials + the toon gradient texture are disposed when the appearance
 * changes or the component unmounts, so cycling personas doesn't leak GPU
 * memory.
 */
export function usePersonaMaterials(
  appearance: Appearance,
  tier: AvatarTier
): PersonaMaterials {
  const { robeColor, hatColor, beardColor, skin, accent } = appearance;

  const mats = useMemo<PersonaMaterials>(() => {
    return {
      robe: crystal(robeColor, accent, tier),
      robeDark: crystal(shadeHex(robeColor, -0.16), accent, tier),
      hat: crystal(hatColor, accent, tier),
      hatDark: crystal(shadeHex(hatColor, -0.18), accent, tier),
      skin: new THREE.MeshStandardMaterial({
        color: skin,
        flatShading: true,
        roughness: 0.6,
        metalness: 0,
      }),
      // Flat-shaded rather than toon: MeshToonMaterial has no `flatShading`,
      // and without facets the beard read as one smooth blank triangle.
      cloth: new THREE.MeshStandardMaterial({
        color: beardColor,
        flatShading: true,
        roughness: 0.85,
        metalness: 0,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.5,
        flatShading: true,
        roughness: 0.3,
      }),
      accentCore: new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }),
      dark: new THREE.MeshStandardMaterial({ color: "#1c1526", roughness: 0.5, flatShading: true }),
      blush: new THREE.MeshStandardMaterial({
        color: "#ef9a95",
        roughness: 0.95,
        transparent: true,
        opacity: 0.85,
      }),
      iris: new THREE.MeshStandardMaterial({ color: "#6b3fb5", roughness: 0.35 }),
      glint: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
      light: new THREE.MeshStandardMaterial({ color: "#fffdf5", roughness: 0.6, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: "#6b4a2b", roughness: 0.85, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({
        color: "#d3dae4",
        metalness: 0.65,
        roughness: 0.28,
        flatShading: true,
      }),
      // Same reasoning as `crystal()`: `transmission` needs an env map to show
      // anything, so this is a plain alpha-blended surface instead.
      glass: new THREE.MeshStandardMaterial({
        color: "#dce7ef",
        roughness: 0.15,
        transparent: true,
        opacity: 0.45,
        emissive: "#9fc4de",
        emissiveIntensity: 0.15,
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robeColor, hatColor, beardColor, skin, accent, tier]);

  useEffect(() => {
    return () => {
      for (const m of Object.values(mats) as THREE.Material[]) {
        const withMap = m as THREE.Material & { gradientMap?: THREE.Texture | null };
        withMap.gradientMap?.dispose?.();
        m.dispose();
      }
    };
  }, [mats]);

  return mats;
}
