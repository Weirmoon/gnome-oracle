"use client";

import * as THREE from "three";
import type { PartProps } from "./types";

const solid = (color: string, roughness = 0.65) =>
  new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

const BLUE = solid("#4a7cf0");
const BLUE_LT = solid("#8fc0ff");
const BROWN = solid("#8a5228");
const ORANGE = solid("#e8681f");
const ORANGE_IN = solid("#f0b98a");
const SPONGE = solid("#f5d242");
const SPONGE_HOLE = solid("#c9a51e");
const DREAD = solid("#241812");
const BAND = solid("#c01a2e");
const BEAD = solid("#c9992f", 0.4);

const spikeGeo = new THREE.ConeGeometry(0.085, 0.52, 5);
const tuftGeo = new THREE.SphereGeometry(0.13, 7, 6);
const dreadGeo = new THREE.CapsuleGeometry(0.042, 0.42, 2, 6);
const beadGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 7);

/** HairStyle -> hair meshes attached around the head (head radius 0.46). */
export function Hair({ appearance }: PartProps) {
  switch (appearance.hair) {
    case "spiky-blue":
      // Sheet 08: a big fan of tall spikes, not a handful of small cones.
      return (
        <group position={[0, 0.36, -0.02]}>
          {[
            [-0.34, 0.02, -0.9, 0.85], [-0.24, 0.13, -0.62, 1.05], [-0.13, 0.2, -0.35, 1.15],
            [0, 0.23, -0.1, 1.2], [0.13, 0.2, -0.35, 1.15], [0.24, 0.13, -0.62, 1.05],
            [0.34, 0.02, -0.9, 0.85], [-0.19, 0.06, -0.5, 0.8], [0.19, 0.06, -0.5, 0.8],
            [-0.06, 0.12, -0.2, 0.9], [0.06, 0.12, -0.2, 0.9],
          ].map(([x, y, rz, s], i) => (
            <mesh
              key={i}
              geometry={spikeGeo}
              material={i % 3 === 0 ? BLUE_LT : BLUE}
              position={[x, y, i % 2 ? -0.06 : 0.04]}
              rotation={[-0.25, 0, rz * 0.45]}
              scale={s}
            />
          ))}
        </group>
      );
    case "nervous-brown":
      return (
        <group>
          <mesh material={BROWN} position={[0, 0.16, -0.02]} scale={[1.03, 0.95, 1.03]}>
            <sphereGeometry args={[0.47, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* fringe tufts + the cowlick at the crown */}
          {[-0.3, -0.1, 0.12, 0.32].map((x, i) => (
            <mesh key={i} geometry={tuftGeo} material={BROWN} position={[x, 0.2, 0.3]} scale={[1, 0.8, 0.8]} />
          ))}
          <mesh material={BROWN} position={[0.04, 0.5, -0.04]} rotation={[-0.3, 0, -0.4]}>
            <coneGeometry args={[0.09, 0.28, 6]} />
          </mesh>
        </group>
      );
    case "orange-ears":
      // Big upright animal ears on top of the head, with a lighter inner cone.
      return (
        <group>
          {([-1, 1] as const).map((s) => (
            <group key={s} position={[s * 0.28, 0.4, -0.02]} rotation={[0.1, 0, s * 0.35]}>
              <mesh material={ORANGE}>
                <coneGeometry args={[0.16, 0.46, 6]} />
              </mesh>
              <mesh material={ORANGE_IN} position={[0, -0.02, 0.05]} scale={0.6}>
                <coneGeometry args={[0.16, 0.46, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "square-porous":
      return (
        <group position={[0, 0.36, 0]}>
          <mesh material={SPONGE}>
            <boxGeometry args={[0.82, 0.4, 0.72]} />
          </mesh>
          {[[-0.22, 0.05, 0.37], [0.1, -0.08, 0.37], [0.26, 0.1, 0.37], [-0.05, 0.12, 0.37]].map(
            ([x, y, z], i) => (
              <mesh key={i} material={SPONGE_HOLE} position={[x, y, z]}>
                <sphereGeometry args={[0.055, 7, 6]} />
              </mesh>
            )
          )}
        </group>
      );
    case "pirate-dreads":
      // Bandana cap over the crown, dreads framing BOTH sides of the face.
      return (
        <group>
          <mesh material={BAND} position={[0, 0.16, 0]} scale={[1.04, 0.72, 1.04]}>
            <sphereGeometry args={[0.47, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={BAND} position={[-0.4, 0.14, -0.22]} rotation={[0, 0.5, 0.6]}>
            <coneGeometry args={[0.1, 0.34, 5]} />
          </mesh>
          {([-1, 1] as const).map((s) =>
            [0, 1, 2].map((j) => (
              <group key={`${s}-${j}`}>
                <mesh
                  geometry={dreadGeo}
                  material={DREAD}
                  position={[s * (0.4 + j * 0.03), -0.1 - j * 0.05, 0.26 - j * 0.24]}
                />
                {j === 1 && (
                  <mesh
                    geometry={beadGeo}
                    material={BEAD}
                    position={[s * 0.43, -0.22, 0.02]}
                  />
                )}
              </group>
            ))
          )}
        </group>
      );
    case "bald":
    case "none":
    default:
      return null;
  }
}
