"use client";

import * as THREE from "three";
import type { PartProps } from "./types";

const solid = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true, ...opts });

const STEEL = solid("#d3dae4", { metalness: 0.6, roughness: 0.3 });
const WOOD = solid("#6b4a2b", { roughness: 0.85 });
const DARK = solid("#20242c");
const RED = solid("#ff4f5e", { emissive: "#ff4f5e", emissiveIntensity: 0.4 });
const BRASS = solid("#b8863b", { metalness: 0.5, roughness: 0.4 });
const PAPER = solid("#fffdf5", { roughness: 0.7 });

/** HeldItem -> prop held in a hand group (origin = hand). */
export function HeldItem({ appearance, mats }: PartProps) {
  switch (appearance.heldItem) {
    case "portal-gun":
      return (
        <group rotation={[0, 0, 0.2]}>
          <mesh material={STEEL}>
            <boxGeometry args={[0.14, 0.3, 0.14]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.2, 0]}>
            <coneGeometry args={[0.1, 0.16, 6]} />
          </mesh>
        </group>
      );
    case "flask":
      return (
        <group>
          <mesh material={mats.glass} position={[0, 0.1, 0]}>
            <coneGeometry args={[0.12, 0.28, 7]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
        </group>
      );
    case "fossil-brush":
      return (
        <group rotation={[0, 0, 0.3]}>
          <mesh material={WOOD} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.3, 6]} />
          </mesh>
          <mesh material={mats.light} position={[0, 0.32, 0]}>
            <coneGeometry args={[0.06, 0.14, 6]} />
          </mesh>
        </group>
      );
    case "rock-hammer":
      return (
        <group rotation={[0, 0, 0.4]}>
          <mesh material={WOOD} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.32, 6]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.32, 0]}>
            <boxGeometry args={[0.24, 0.08, 0.08]} />
          </mesh>
        </group>
      );
    case "telescope":
      return (
        <mesh material={DARK} rotation={[0, 0, -0.5]} position={[0.05, 0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.42, 8]} />
          <mesh material={mats.accent} position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 8]} />
          </mesh>
        </mesh>
      );
    case "red-flashlight":
      return (
        <group rotation={[0, 0, -0.7]}>
          <mesh material={DARK} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
          </mesh>
          <mesh material={RED} position={[0, 0.3, 0]}>
            <coneGeometry args={[0.08, 0.1, 8]} />
          </mesh>
        </group>
      );
    case "spatula":
      return (
        <group rotation={[0, 0, 0.3]}>
          <mesh material={WOOD} position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.34, 6]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.36, 0]}>
            <boxGeometry args={[0.16, 0.14, 0.03]} />
          </mesh>
        </group>
      );
    case "compass":
      return (
        <group>
          <mesh material={BRASS}>
            <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0.6]}>
            <coneGeometry args={[0.03, 0.16, 4]} />
          </mesh>
        </group>
      );
    case "sword":
      return (
        <group rotation={[0, 0, -0.3]}>
          <mesh material={STEEL} position={[0, 0.3, 0]}>
            <boxGeometry args={[0.06, 0.6, 0.02]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.02, 0]}>
            <boxGeometry args={[0.24, 0.05, 0.05]} />
          </mesh>
          <mesh material={WOOD} position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.16, 6]} />
          </mesh>
        </group>
      );
    case "wrench":
      return (
        <group rotation={[0, 0, 0.4]}>
          <mesh material={STEEL} position={[0, 0.16, 0]}>
            <boxGeometry args={[0.06, 0.34, 0.04]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.08, 0.03, 6, 10, Math.PI * 1.4]} />
          </mesh>
        </group>
      );
    case "book":
      return (
        <group rotation={[0.3, 0, 0]}>
          <mesh material={mats.robeDark}>
            <boxGeometry args={[0.34, 0.26, 0.08]} />
          </mesh>
          <mesh material={PAPER} position={[0, 0, 0.045]}>
            <boxGeometry args={[0.3, 0.22, 0.02]} />
          </mesh>
        </group>
      );
    case "microphone":
      return (
        <group rotation={[0, 0, -0.2]}>
          <mesh material={DARK} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.24, 6]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        </group>
      );
    case "plant-shears":
      return (
        <group rotation={[0, 0, 0.3]}>
          {[-0.04, 0.04].map((x, i) => (
            <mesh key={i} material={STEEL} position={[x, 0.2, 0]} rotation={[0, 0, x * 3]}>
              <boxGeometry args={[0.04, 0.3, 0.02]} />
            </mesh>
          ))}
          <mesh material={mats.accent} position={[0, 0.02, 0]}>
            <sphereGeometry args={[0.05, 6, 5]} />
          </mesh>
        </group>
      );
    case "none":
    default:
      return null;
  }
}
