"use client";

import * as THREE from "three";
import { headZ } from "./body";
import type { PartProps } from "./types";

const DARK = new THREE.MeshStandardMaterial({ color: "#101116", roughness: 0.4, flatShading: true });
const STACHE = new THREE.MeshStandardMaterial({ color: "#8a8f98", roughness: 0.7, flatShading: true });

/**
 * Eye height, and the z at which a prop clears BOTH the skull and the eyeball
 * bulge in front of it.
 *
 * The old code used a flat `Z = 0.36` for every feature. The skull surface at
 * eye height is at z 0.42, so the rims sat ~0.06 INSIDE the head and only their
 * lower arc poked out — which, over a black eye, read as an under-eye smudge
 * rather than a pair of spectacles.
 */
const EYE_Y = 0.07;
const EYE_X = 0.15;
const LENS_Z = headZ(EYE_Y, EYE_X) + 0.055;

/** FaceFeature -> eyewear / mask / stache on the head front. */
export function FaceFeature({ appearance, mats }: PartProps) {
  switch (appearance.faceFeature) {
    case "goggles":
      return (
        <group position={[0, EYE_Y + 0.02, LENS_Z]}>
          {[-0.17, 0.17].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              <mesh material={mats.accent} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.105, 0.03, 7, 16]} />
              </mesh>
              <mesh material={mats.glass} position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.095, 0.095, 0.02, 14]} />
              </mesh>
            </group>
          ))}
          <mesh material={mats.accent} position={[0, 0, -0.03]}>
            <boxGeometry args={[0.16, 0.035, 0.035]} />
          </mesh>
        </group>
      );
    case "sunglasses":
      return (
        <group position={[0, EYE_Y, LENS_Z - 0.01]}>
          {[-0.17, 0.17].map((x, i) => (
            <mesh key={i} material={DARK} position={[x, 0, 0]} rotation={[0, 0, x < 0 ? 0.06 : -0.06]}>
              <boxGeometry args={[0.19, 0.125, 0.045]} />
            </mesh>
          ))}
          <mesh material={DARK}>
            <boxGeometry args={[0.12, 0.035, 0.035]} />
          </mesh>
        </group>
      );
    case "round-glasses":
      return (
        <group position={[0, EYE_Y, LENS_Z]}>
          {[-0.17, 0.17].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              <mesh material={DARK} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.1, 0.018, 7, 18]} />
              </mesh>
              <mesh material={mats.glass} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.092, 0.092, 0.015, 16]} />
              </mesh>
            </group>
          ))}
          <mesh material={DARK}>
            <boxGeometry args={[0.145, 0.018, 0.022]} />
          </mesh>
        </group>
      );
    case "mask":
      return (
        <mesh material={DARK} position={[0, EYE_Y + 0.01, headZ(EYE_Y) - 0.05]} scale={[1, 1, 0.9]}>
          <sphereGeometry args={[0.47, 14, 10, 0, Math.PI * 2, Math.PI * 0.34, Math.PI * 0.2]} />
        </mesh>
      );
    case "beard-stache":
      return (
        <group position={[0, -0.09, headZ(-0.09) - 0.03]}>
          <mesh material={STACHE} scale={[1, 0.5, 0.55]}>
            <sphereGeometry args={[0.16, 10, 8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={STACHE} position={[s * 0.15, 0.015, 0]} rotation={[0, 0, -s * 0.6]} scale={[1, 0.55, 0.5]}>
              <sphereGeometry args={[0.075, 8, 6]} />
            </mesh>
          ))}
        </group>
      );
    case "eye-patch":
      return (
        <group position={[0, EYE_Y, 0]}>
          <mesh material={DARK} position={[-EYE_X - 0.02, 0, headZ(EYE_Y, EYE_X) + 0.03]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.13, 10, 8]} />
          </mesh>
          <mesh material={DARK} position={[0.03, 0.14, headZ(0.14) - 0.06]} rotation={[0, 0, -0.42]}>
            <boxGeometry args={[0.95, 0.035, 0.035]} />
          </mesh>
        </group>
      );
    case "none":
    default:
      return null;
  }
}
