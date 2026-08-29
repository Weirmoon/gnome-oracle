"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { shadeHex } from "@/lib/persona";
import { Star } from "./primitives";
import type { PartProps } from "./types";

const solid = (color: string, roughness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

const SHELL = solid("#4f8d45");
const SHELL_RIM = solid("#2f5f2a");
const STEEL = new THREE.MeshStandardMaterial({ color: "#d3dae4", metalness: 0.6, roughness: 0.3, flatShading: true });
const CANVAS = solid("#8c7449", 0.8);

/** Should a cape render? (accessory "cape" or the star-cape back item.) */
function wantsCape(p: PartProps["appearance"]): boolean {
  return p.accessory === "cape" || p.backItem === "star-cape";
}

/**
 * BackItem -> gear worn on the back (backSlot group, sits behind the torso).
 *
 * The stage only ever shows the gnome from the front, so anything that stays
 * strictly behind the torso is invisible in play no matter how good it looks
 * on the reference sheet's 3/4 rear view. Every item here is therefore sized
 * or placed to break the body silhouette — wider than the robe, above the
 * shoulders, or curling out to one side.
 */
export function BackItem({ appearance, mats }: PartProps) {
  const cape = wantsCape(appearance) ? (
    <Cape color={appearance.robeColor} starOnBack={appearance.backItem === "star-cape"} mats={mats} />
  ) : null;

  let item: React.ReactNode = null;
  switch (appearance.backItem) {
    case "turtle-shell":
      item = (
        <group position={[0, -0.16, -0.06]}>
          <mesh material={SHELL} scale={[1.42, 1.25, 0.62]}>
            <icosahedronGeometry args={[0.5, 1]} />
          </mesh>
          <mesh material={SHELL_RIM} rotation={[Math.PI / 2, 0, 0]} scale={[1.42, 1.42, 1]}>
            <torusGeometry args={[0.44, 0.045, 6, 10]} />
          </mesh>
        </group>
      );
      break;
    case "twin-swords":
      item = (
        <group>
          {[-0.5, 0.5].map((r, i) => (
            <group key={i} position={[0, 0.24, -0.02]} rotation={[0, 0, r]}>
              <mesh material={STEEL} position={[0, 0.5, -0.05]}>
                <boxGeometry args={[0.07, 1.1, 0.03]} />
              </mesh>
              <mesh material={CANVAS} position={[0, 0.02, -0.05]}>
                <boxGeometry args={[0.28, 0.07, 0.07]} />
              </mesh>
            </group>
          ))}
        </group>
      );
      break;
    case "dino-tail":
      item = (
        <group position={[0.5, -0.5, 0.02]} rotation={[0.35, 0, -1.15]}>
          <mesh material={mats.robeDark}>
            <coneGeometry args={[0.2, 1.05, 7]} />
          </mesh>
          {[0.1, -0.05, -0.2].map((y, i) => (
            <mesh key={i} material={mats.accent} position={[0, y, 0.12]} rotation={[0.4, 0, 0]}>
              <coneGeometry args={[0.05, 0.12, 4]} />
            </mesh>
          ))}
        </group>
      );
      break;
    case "weather-vane":
      item = (
        <group position={[0.46, 0.62, -0.06]}>
          <mesh material={STEEL}>
            <cylinderGeometry args={[0.025, 0.025, 1.9, 6]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.72, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.1, 0.26, 4]} />
          </mesh>
          <Star r={0.1} material={mats.accent} position={[0, 0.98, 0]} />
        </group>
      );
      break;
    case "backpack":
      item = (
        <group>
          <mesh material={mats.robeDark} position={[0, -0.12, -0.1]}>
            <boxGeometry args={[1.0, 0.86, 0.3]} />
          </mesh>
          {/* shoulder straps, so it reads from the front too */}
          {[-0.26, 0.26].map((x) => (
            <mesh key={x} material={CANVAS} position={[x, 0.14, 0.72]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.12, 0.72, 0.07]} />
            </mesh>
          ))}
        </group>
      );
      break;
    default:
      item = null;
  }

  if (!cape && !item) return null;
  return (
    <group>
      {cape}
      {item}
    </group>
  );
}

function Cape({
  color,
  starOnBack,
  mats,
}: {
  color: string;
  starOnBack: boolean;
  mats: PartProps["mats"];
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: shadeHex(color, -0.22),
        roughness: 0.7,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    [color]
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group position={[0, 0.16, -0.04]}>
      <mesh material={mat} position={[0, -0.3, 0]}>
        <coneGeometry args={[0.74, 1.24, 9, 1, true]} />
      </mesh>
      {starOnBack && <Star r={0.12} material={mats.accent} position={[0, -0.3, -0.1]} rotation={[0, Math.PI, 0]} />}
    </group>
  );
}
