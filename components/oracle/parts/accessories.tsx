"use client";

import * as THREE from "three";
import { Star } from "./primitives";
import { HEAD_Y, frontZ, headZ } from "./body";
import type { PartProps } from "./types";

const solid = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true, ...opts });

const DARK = solid("#2a1a4a", { roughness: 0.4 });
const STEEL = solid("#d3dae4", { metalness: 0.6, roughness: 0.3 });
const WOOD = solid("#6b4a2b", { roughness: 0.85 });
const RED = solid("#b8192d");
const GREEN = solid("#3f9d3f");
const PAPER = solid("#fffdf5", { roughness: 0.7 });
const BADGE = solid("#d9b56d", { metalness: 0.3 });
const INK = solid("#101116", { roughness: 0.4 });
const GADGET = solid("#20242c");

// Anchors relative to the torso group origin (torso ~[-0.9..0.3] in y).
// These are computed against the real surfaces: the flat z values they used to
// carry put face props inside the skull and chest props inside the robe.
const FACE: [number, number, number] = [0, HEAD_Y + 0.07, headZ(0.07, 0.17) + 0.06];
const CHEST: [number, number, number] = [0, -0.1, frontZ(-0.1, 0.16)];
const HAND_L: [number, number, number] = [-0.52, -0.42, 0.4];

/**
 * CostumeAccessory -> body-worn or hand-held extra. `cape` is intentionally a
 * no-op here — `BackItem` owns the cape mesh for both the accessory and the
 * star-cape back item.
 */
export function Accessory({ appearance, mats }: PartProps) {
  switch (appearance.accessory) {
    case "glasses":
    case "lab-goggles": {
      const m = appearance.accessory === "lab-goggles" ? mats.accent : DARK;
      return (
        <group position={FACE}>
          {[-0.15, 0.15].map((x, i) => (
            <mesh key={i} material={m} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.085, 0.016, 6, 14]} />
            </mesh>
          ))}
          <mesh material={m}>
            <boxGeometry args={[0.13, 0.016, 0.02]} />
          </mesh>
        </group>
      );
    }
    case "pirate-sash":
      return (
        <mesh material={RED} position={CHEST} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.95, 0.14, 0.05]} />
        </mesh>
      );
    case "martial-belt":
      return (
        <group position={[0, -0.4, 0]}>
          <mesh material={DARK} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.47, 0.055, 6, 22]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0, frontZ(-0.4, 0.09)]}>
            <boxGeometry args={[0.17, 0.17, 0.05]} />
          </mesh>
        </group>
      );
    case "fossil-badge":
      return (
        <mesh material={BADGE} position={[0.22, 0.05, 0.34]}>
          <cylinderGeometry args={[0.09, 0.09, 0.04, 10]} />
        </mesh>
      );
    case "star-map":
      return (
        <group position={CHEST}>
          <mesh material={mats.robeDark}>
            <boxGeometry args={[0.3, 0.22, 0.03]} />
          </mesh>
          <Star r={0.05} material={mats.accent} position={[-0.05, 0.03, 0.03]} />
          <Star r={0.035} material={mats.accent} position={[0.07, -0.04, 0.03]} />
        </group>
      );
    case "mask":
      return (
        <mesh material={INK} position={[0, HEAD_Y, 0]} scale={[1.1, 1, 1.02]}>
          <sphereGeometry args={[0.5, 14, 10, 0, Math.PI * 2, Math.PI * 0.34, Math.PI * 0.2]} />
        </mesh>
      );
    case "sword":
      return (
        <group position={HAND_L} rotation={[0, 0, 0.4]}>
          <mesh material={STEEL} position={[0, 0.32, 0]}>
            <boxGeometry args={[0.06, 0.62, 0.02]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.02, 0]}>
            <boxGeometry args={[0.22, 0.05, 0.05]} />
          </mesh>
        </group>
      );
    case "spatula":
      return (
        <group position={HAND_L} rotation={[0, 0, 0.3]}>
          <mesh material={WOOD} position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.34, 6]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.36, 0]}>
            <boxGeometry args={[0.16, 0.14, 0.03]} />
          </mesh>
        </group>
      );
    case "telescope":
      return (
        <mesh material={GADGET} position={HAND_L} rotation={[0, 0, -0.5]}>
          <cylinderGeometry args={[0.05, 0.07, 0.42, 8]} />
        </mesh>
      );
    case "microphone":
      return (
        <group position={HAND_L} rotation={[0, 0, -0.2]}>
          <mesh material={GADGET} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.24, 6]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        </group>
      );
    case "book":
      return (
        <group position={HAND_L} rotation={[0.3, 0, 0]}>
          <mesh material={mats.robeDark}>
            <boxGeometry args={[0.32, 0.24, 0.08]} />
          </mesh>
          <mesh material={PAPER} position={[0, 0, 0.045]}>
            <boxGeometry args={[0.28, 0.2, 0.02]} />
          </mesh>
        </group>
      );
    case "wrench":
      return (
        <group position={HAND_L} rotation={[0, 0, 0.4]}>
          <mesh material={STEEL} position={[0, 0.16, 0]}>
            <boxGeometry args={[0.06, 0.34, 0.04]} />
          </mesh>
          <mesh material={STEEL} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.08, 0.03, 6, 10, Math.PI * 1.4]} />
          </mesh>
        </group>
      );
    case "plant":
      return (
        <group position={HAND_L}>
          <mesh material={WOOD}>
            <cylinderGeometry args={[0.09, 0.07, 0.14, 6]} />
          </mesh>
          <mesh material={GREEN} position={[0, 0.16, 0]}>
            <icosahedronGeometry args={[0.12, 0]} />
          </mesh>
        </group>
      );
    case "portal-gadget":
      return (
        <group position={HAND_L} rotation={[0, 0, 0.2]}>
          <mesh material={STEEL}>
            <boxGeometry args={[0.12, 0.26, 0.12]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.18, 0]}>
            <coneGeometry args={[0.09, 0.14, 6]} />
          </mesh>
        </group>
      );
    case "cape":
    case "none":
    default:
      return null;
  }
}
