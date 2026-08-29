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
  /** Beard / hair / cloth — matte toon so it reads against the crystal. */
  cloth: THREE.Material;
  /** Accent-coloured emissive — trims, gems, pattern lines. */
  accent: THREE.Material;
  /** Bright unlit accent core for the inner glow. */
  accentCore: THREE.Material;
  /** Dark near-black — eyes, mouth, iron. */
  dark: THREE.Material;
  /** Off-white — pom-poms, collars, teeth. */
  light: THREE.Material;
  /** Wood — staves, handles, hammer shafts. */
  wood: THREE.Material;
  /** Metal — blades, tools, buckles. */
  metal: THREE.Material;
  /** Translucent glass — flasks, goggles, orbs. */
  glass: THREE.Material;
}

function toonGradient(): THREE.DataTexture {
  const data = new Uint8Array([90, 90, 90, 255, 160, 160, 160, 255, 230, 230, 230, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function crystal(color: string, accent: string, tier: AvatarTier): THREE.Material {
  if (tier === "low") {
    return new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.42,
      metalness: 0,
      emissive: accent,
      emissiveIntensity: 0.14,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color,
    flatShading: true,
    roughness: 0.28,
    metalness: 0,
    transmission: 0.18,
    thickness: 0.5,
    ior: 1.45,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    emissive: accent,
    emissiveIntensity: 0.16,
    envMapIntensity: 0,
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
    const gradientMap = toonGradient();
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
      cloth: new THREE.MeshToonMaterial({ color: beardColor, gradientMap }),
      accent: new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.5,
        flatShading: true,
        roughness: 0.3,
      }),
      accentCore: new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }),
      dark: new THREE.MeshStandardMaterial({ color: "#1c1526", roughness: 0.5, flatShading: true }),
      light: new THREE.MeshStandardMaterial({ color: "#fffdf5", roughness: 0.6, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: "#6b4a2b", roughness: 0.85, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({
        color: "#d3dae4",
        metalness: 0.65,
        roughness: 0.28,
        flatShading: true,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#dce7ef",
        transmission: tier === "low" ? 0 : 0.9,
        thickness: 0.3,
        roughness: 0.1,
        transparent: true,
        opacity: tier === "low" ? 0.4 : 1,
        envMapIntensity: 0,
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
