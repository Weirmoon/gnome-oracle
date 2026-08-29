"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { PartProps } from "./types";

const solid = (color: string, roughness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

const WHITE = solid("#fffdf5");
const CREAM = solid("#fff4dc");
const RED = solid("#c8322f", 0.5);
const TAN = solid("#8c7449", 0.7);
const BLACK = solid("#1b1d22", 0.5);
const SHIRT_YELLOW = solid("#f2d64b", 0.5);
const PANTS_BLUE = solid("#3456a3", 0.5);
const BEACH = solid("#e0a04f", 0.55);
const DETECTIVE = solid("#5a4734", 0.7);

/** A flat-ish panel on the front of the torso. */
function Panel({
  w, h, material, position, rotation,
}: {
  w: number; h: number; material: THREE.Material;
  position: [number, number, number]; rotation?: [number, number, number];
}) {
  return (
    <mesh material={material} position={position} rotation={rotation}>
      <boxGeometry args={[w, h, 0.06]} />
    </mesh>
  );
}

/** TorsoStyle -> costume overlay on top of the base crystal robe. */
export function Torso({ appearance, mats }: PartProps) {
  const beltGeo = useMemo(() => new THREE.BoxGeometry(0.7, 0.09, 0.5), []);

  switch (appearance.torsoStyle ?? "robe") {
    case "lab-coat":
    case "chef-coat": {
      const m = appearance.torsoStyle === "chef-coat" ? CREAM : WHITE;
      return (
        <group>
          <Panel w={0.24} h={1.0} material={m} position={[-0.16, -0.35, 0.32]} rotation={[0, 0, 0.06]} />
          <Panel w={0.24} h={1.0} material={m} position={[0.16, -0.35, 0.32]} rotation={[0, 0, -0.06]} />
          <mesh geometry={beltGeo} material={mats.accent} position={[0, -0.36, 0]} scale={[1, 0.5, 1]} />
        </group>
      );
    }
    case "yellow-shirt":
      return (
        <group>
          <Panel w={0.6} h={0.5} material={SHIRT_YELLOW} position={[0, 0.0, 0.3]} />
          <Panel w={0.66} h={0.6} material={PANTS_BLUE} position={[0, -0.6, 0.3]} />
        </group>
      );
    case "martial-gi":
      return (
        <group>
          <mesh material={mats.accent} position={[0, -0.15, 0.32]} rotation={[0, 0, 0.6]}>
            <boxGeometry args={[0.7, 0.08, 0.04]} />
          </mesh>
          <mesh material={mats.accent} position={[0, -0.15, 0.32]} rotation={[0, 0, -0.6]}>
            <boxGeometry args={[0.7, 0.08, 0.04]} />
          </mesh>
          <mesh geometry={beltGeo} material={mats.accent} position={[0, -0.4, 0]} />
        </group>
      );
    case "beach-shirt":
    case "detective-coat": {
      const m = appearance.torsoStyle === "beach-shirt" ? BEACH : DETECTIVE;
      return (
        <group>
          <Panel w={0.22} h={1.0} material={m} position={[-0.2, -0.35, 0.31]} rotation={[0, 0, 0.16]} />
          <Panel w={0.22} h={1.0} material={m} position={[0.2, -0.35, 0.31]} rotation={[0, 0, -0.16]} />
        </group>
      );
    }
    case "collared-shirt":
      return (
        <group>
          <Panel w={0.55} h={0.9} material={WHITE} position={[0, -0.3, 0.3]} />
          <mesh material={WHITE} position={[0, 0.16, 0.34]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.16, 0.16, 0.05]} />
          </mesh>
          <mesh material={BLACK} position={[0, -0.05, 0.35]}>
            <boxGeometry args={[0.09, 0.5, 0.04]} />
          </mesh>
        </group>
      );
    case "fry-cook":
      return (
        <group>
          <Panel w={0.55} h={0.9} material={WHITE} position={[0, -0.3, 0.3]} />
          <mesh material={RED} position={[0, -0.1, 0.35]}>
            <coneGeometry args={[0.12, 0.5, 4]} />
          </mesh>
        </group>
      );
    case "pirate-coat":
      return (
        <group>
          <Panel w={0.26} h={1.0} material={mats.robeDark} position={[-0.18, -0.35, 0.31]} rotation={[0, 0, 0.12]} />
          <Panel w={0.26} h={1.0} material={mats.robeDark} position={[0.18, -0.35, 0.31]} rotation={[0, 0, -0.12]} />
          <mesh material={RED} position={[0, -0.25, 0.33]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.9, 0.12, 0.04]} />
          </mesh>
        </group>
      );
    case "tactical-suit":
      return (
        <group>
          <Panel w={0.62} h={1.0} material={BLACK} position={[0, -0.3, 0.3]} />
          <Panel w={0.14} h={0.14} material={mats.accent} position={[-0.16, -0.05, 0.34]} />
          <Panel w={0.14} h={0.14} material={mats.accent} position={[0.16, -0.05, 0.34]} />
        </group>
      );
    case "field-vest":
      return (
        <group>
          <Panel w={0.24} h={0.9} material={TAN} position={[-0.18, -0.35, 0.31]} />
          <Panel w={0.24} h={0.9} material={TAN} position={[0.18, -0.35, 0.31]} />
          {[[-0.18, -0.1], [0.18, -0.1], [-0.18, -0.5], [0.18, -0.5]].map(([x, y], i) => (
            <Panel key={i} w={0.16} h={0.14} material={CREAM} position={[x, y, 0.35]} />
          ))}
        </group>
      );
    case "space-robe":
      return (
        <group>
          <mesh material={mats.accent} position={[0, -0.1, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.28, 0.02, 6, 16, Math.PI]} />
          </mesh>
        </group>
      );
    case "mechanic-coveralls":
      return (
        <group>
          <Panel w={0.62} h={1.0} material={mats.robeDark} position={[0, -0.3, 0.3]} />
          <mesh geometry={beltGeo} material={BLACK} position={[0, -0.4, 0]} />
          <Panel w={0.16} h={0.13} material={mats.accent} position={[-0.14, 0.0, 0.34]} />
          <Panel w={0.16} h={0.13} material={mats.accent} position={[0.14, 0.0, 0.34]} />
        </group>
      );
    case "robe":
    default:
      return null;
  }
}
