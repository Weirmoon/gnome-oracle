"use client";

import * as THREE from "three";
import type { PartProps } from "./types";

const DARK = new THREE.MeshStandardMaterial({ color: "#101116", roughness: 0.4, flatShading: true });
const STACHE = new THREE.MeshStandardMaterial({ color: "#8a8f98", roughness: 0.7, flatShading: true });
const Z = 0.36;

/** FaceFeature -> eyewear / mask / stache on the head front. */
export function FaceFeature({ appearance, mats }: PartProps) {
  switch (appearance.faceFeature) {
    case "goggles":
      return (
        <group position={[0, 0.05, Z]}>
          {[-0.15, 0.15].map((x, i) => (
            <mesh key={i} material={mats.accent} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.09, 0.025, 6, 12]} />
            </mesh>
          ))}
          <mesh material={mats.accent} position={[0, 0, -0.02]}>
            <boxGeometry args={[0.12, 0.03, 0.03]} />
          </mesh>
        </group>
      );
    case "sunglasses":
      return (
        <group position={[0, 0.05, Z]}>
          {[-0.15, 0.15].map((x, i) => (
            <mesh key={i} material={DARK} position={[x, 0, 0]}>
              <boxGeometry args={[0.17, 0.11, 0.04]} />
            </mesh>
          ))}
          <mesh material={DARK} position={[0, 0, 0]}>
            <boxGeometry args={[0.1, 0.03, 0.03]} />
          </mesh>
        </group>
      );
    case "round-glasses":
      return (
        <group position={[0, 0.05, Z]}>
          {[-0.15, 0.15].map((x, i) => (
            <mesh key={i} material={DARK} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.085, 0.015, 6, 14]} />
            </mesh>
          ))}
          <mesh material={DARK} position={[0, 0, 0]}>
            <boxGeometry args={[0.13, 0.015, 0.02]} />
          </mesh>
        </group>
      );
    case "mask":
      return (
        <mesh material={DARK} position={[0, 0.06, Z - 0.02]}>
          <boxGeometry args={[0.5, 0.24, 0.06]} />
        </mesh>
      );
    case "beard-stache":
      return (
        <mesh material={STACHE} position={[0, -0.08, Z - 0.02]}>
          <boxGeometry args={[0.28, 0.06, 0.06]} />
        </mesh>
      );
    case "eye-patch":
      return (
        <group position={[0, 0.05, Z]}>
          <mesh material={DARK} position={[-0.15, 0, 0]}>
            <boxGeometry args={[0.16, 0.14, 0.04]} />
          </mesh>
          <mesh material={DARK} position={[0.05, 0.12, -0.05]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.5, 0.03, 0.03]} />
          </mesh>
        </group>
      );
    case "none":
    default:
      return null;
  }
}
