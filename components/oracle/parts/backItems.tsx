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

/** BackItem -> gear worn on the back (backSlot group, sits behind the torso). */
export function BackItem({ appearance, mats }: PartProps) {
  const cape = wantsCape(appearance) ? (
    <Cape color={appearance.robeColor} starOnBack={appearance.backItem === "star-cape"} mats={mats} />
  ) : null;

  let item: React.ReactNode = null;
  switch (appearance.backItem) {
    case "turtle-shell":
      item = (
        <group position={[0, -0.1, -0.1]}>
          <mesh material={SHELL} scale={[0.9, 1.1, 0.6]}>
            <icosahedronGeometry args={[0.5, 1]} />
          </mesh>
          <mesh material={SHELL_RIM} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.04, 6, 6]} />
          </mesh>
        </group>
      );
      break;
    case "twin-swords":
      item = (
        <group>
          {[-0.45, 0.45].map((r, i) => (
            <group key={i} rotation={[0, 0, r]}>
              <mesh material={STEEL} position={[0, 0.35, -0.05]}>
                <boxGeometry args={[0.05, 0.8, 0.02]} />
              </mesh>
              <mesh material={CANVAS} position={[0, -0.05, -0.05]}>
                <boxGeometry args={[0.22, 0.05, 0.05]} />
              </mesh>
            </group>
          ))}
        </group>
      );
      break;
    case "dino-tail":
      item = (
        <group position={[0, -0.7, 0.1]} rotation={[0.5, 0, 0]}>
          <mesh material={mats.robeDark}>
            <coneGeometry args={[0.18, 0.9, 6]} />
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
        <group position={[0.3, 0.2, -0.1]}>
          <mesh material={STEEL}>
            <cylinderGeometry args={[0.02, 0.02, 1.4, 6]} />
          </mesh>
          <mesh material={mats.accent} position={[0, 0.5, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.08, 0.2, 4]} />
          </mesh>
          <Star r={0.08} material={mats.accent} position={[0, 0.75, 0]} />
        </group>
      );
      break;
    case "backpack":
      item = (
        <mesh material={mats.robeDark} position={[0, -0.1, -0.12]}>
          <boxGeometry args={[0.55, 0.7, 0.28]} />
        </mesh>
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
    <group position={[0, 0.1, -0.05]}>
      <mesh material={mat} position={[0, -0.4, 0]}>
        <coneGeometry args={[0.6, 1.4, 6, 1, true]} />
      </mesh>
      {starOnBack && <Star r={0.12} material={mats.accent} position={[0, -0.3, -0.1]} rotation={[0, Math.PI, 0]} />}
    </group>
  );
}
