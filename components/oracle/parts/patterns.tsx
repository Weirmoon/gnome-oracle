"use client";

import { Star } from "./primitives";
import { frontZ } from "./body";
import type { PartProps } from "./types";

/**
 * Z for a motif at torso height `y` / offset `x`.
 *
 * These used a flat `Z = 0.34` against a robe whose radius runs 0.42-0.47, so
 * every pattern sat inside the body and none of them ever appeared.
 */
const pz = (y: number, x = 0) => frontZ(y, Math.abs(x) + 0.05, 0.03);

/** CostumePattern -> small accent-coloured motif on the torso front. */
export function Pattern({ appearance, mats }: PartProps) {
  const a = mats.accent;
  switch (appearance.pattern) {
    case "stars":
      return (
        <group>
          <Star r={0.07} material={a} position={[-0.16, -0.1, pz(-0.1, -0.16)]} />
          <Star r={0.05} material={a} position={[0.14, -0.35, pz(-0.35, 0.14)]} />
          <Star r={0.05} material={a} position={[-0.02, -0.6, pz(-0.6, -0.02)]} />
        </group>
      );
    case "fossil-bones":
      return (
        <group>
          {[-0.2, -0.5].map((y, i) => (
            <group key={i} position={[0, y, pz(y, 0)]}>
              <mesh material={a} rotation={[0, 0, 0.3]}>
                <boxGeometry args={[0.4, 0.04, 0.04]} />
              </mesh>
              {[-0.22, 0.22].map((x, j) => (
                <mesh key={j} material={a} position={[x, 0, 0]}>
                  <sphereGeometry args={[0.04, 6, 5]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case "scales":
      return (
        <group>
          {[-0.15, -0.35, -0.55].map((y, i) =>
            [-0.16, 0, 0.16].map((x, j) => (
              <mesh key={`${i}-${j}`} material={a} position={[x, y, pz(y, x)]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.06, 0.012, 4, 8, Math.PI]} />
              </mesh>
            ))
          )}
        </group>
      );
    case "bubbles":
      return (
        <group>
          {[[-0.15, -0.1, 0.05], [0.14, -0.32, 0.07], [-0.03, -0.55, 0.04]].map(([x, y, r], i) => (
            <mesh key={i} material={a} position={[x, y, pz(y, x)]}>
              <sphereGeometry args={[r, 8, 6]} />
            </mesh>
          ))}
        </group>
      );
    case "lightning":
      return (
        <mesh material={a} position={[0, -0.32, pz(-0.32, 0)]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.1, 0.6, 0.05]} />
        </mesh>
      );
    case "circuit-lines":
      return (
        <group position={[0, -0.3, pz(-0.3, 0)]}>
          <mesh material={a}>
            <boxGeometry args={[0.3, 0.03, 0.04]} />
          </mesh>
          <mesh material={a} position={[0.13, -0.12, 0]}>
            <boxGeometry args={[0.03, 0.24, 0.04]} />
          </mesh>
          {[[-0.15, 0], [0.13, -0.24]].map(([x, y], i) => (
            <mesh key={i} material={a} position={[x, y, 0]}>
              <sphereGeometry args={[0.035, 6, 5]} />
            </mesh>
          ))}
        </group>
      );
    case "leaf-veins":
      return (
        <group position={[0, -0.3, pz(-0.3, 0)]}>
          <mesh material={a}>
            <boxGeometry args={[0.03, 0.6, 0.04]} />
          </mesh>
          {[-0.18, 0, 0.18].map((y, i) => (
            <group key={i} position={[0, y, 0]}>
              <mesh material={a} rotation={[0, 0, 0.6]}>
                <boxGeometry args={[0.22, 0.02, 0.03]} />
              </mesh>
              <mesh material={a} rotation={[0, 0, -0.6]}>
                <boxGeometry args={[0.22, 0.02, 0.03]} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "none":
    default:
      return null;
  }
}
