"use client";

import * as THREE from "three";
import type { PartProps } from "./types";

const solid = (color: string, roughness = 0.65) =>
  new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

const BLUE = solid("#9be7ff");
const BROWN = solid("#7a4a28");
const ORANGE = solid("#f47b20");
const SPONGE = solid("#f5d242");
const DREAD = solid("#2c1a12");
const BAND = solid("#b8192d");

/** HairStyle -> hair meshes attached around the head (head radius ≈ 0.42). */
export function Hair({ appearance }: PartProps) {
  switch (appearance.hair) {
    case "spiky-blue":
      return (
        <group position={[0, 0.28, 0]}>
          {[-0.26, -0.13, 0, 0.13, 0.26].map((x, i) => (
            <mesh key={i} material={BLUE} position={[x, (i % 2) * 0.06, -0.02]} rotation={[0, 0, x * 0.6]}>
              <coneGeometry args={[0.08, 0.28, 4]} />
            </mesh>
          ))}
        </group>
      );
    case "nervous-brown":
      return (
        <mesh material={BROWN} position={[0, 0.2, -0.02]}>
          <sphereGeometry args={[0.44, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      );
    case "orange-ears":
      return (
        <group>
          {[-0.42, 0.42].map((x, i) => (
            <mesh key={i} material={ORANGE} position={[x, 0.12, -0.02]} rotation={[0, 0, x < 0 ? -0.4 : 0.4]}>
              <capsuleGeometry args={[0.09, 0.24, 2, 6]} />
            </mesh>
          ))}
        </group>
      );
    case "square-porous":
      return (
        <mesh material={SPONGE} position={[0, 0.32, 0]}>
          <boxGeometry args={[0.7, 0.34, 0.6]} />
        </mesh>
      );
    case "pirate-dreads":
      return (
        <group position={[0, 0.16, 0]}>
          {[-0.28, -0.14, 0, 0.14, 0.28].map((x, i) => (
            <mesh key={i} material={DREAD} position={[x, -0.18, -0.05]}>
              <capsuleGeometry args={[0.035, 0.4, 2, 5]} />
            </mesh>
          ))}
          <mesh material={BAND} position={[0, 0.16, 0.0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.03, 6, 14]} />
          </mesh>
        </group>
      );
    case "bald":
    case "none":
    default:
      return null;
  }
}
