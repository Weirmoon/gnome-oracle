"use client";

import type { Appearance } from "@/lib/persona";
import type { PartProps } from "./types";
import type { PersonaMaterials } from "./materials";

/** Mirrors the 2D `hasStaff` check: wizard + gnome carry a staff. */
export function hasStaff(a: Appearance): boolean {
  return a.hat === "wizard" || a.hat === "gnome";
}

/**
 * Gold band round the base of the crown. Sheet 05 puts one on every hat, so it
 * lives here rather than being redrawn per case.
 */
function Band({ mats, r, y, tube = 0.03 }: { mats: PersonaMaterials; r: number; y: number; tube?: number }) {
  return (
    <mesh material={mats.accent} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r, tube, 5, 22]} />
    </mesh>
  );
}

/**
 * The gold-framed diamond gem on the front of the crown — the other motif
 * shared by all five hats on sheet 05.
 */
function HatGem({ mats, y, z, s = 1 }: { mats: PersonaMaterials; y: number; z: number; s?: number }) {
  return (
    <group position={[0, y, z]}>
      <mesh material={mats.accent} rotation={[0, 0, Math.PI / 4]} scale={[s, s * 1.5, s * 0.55]}>
        <octahedronGeometry args={[0.11, 0]} />
      </mesh>
      <mesh
        material={mats.accentCore}
        position={[0, 0, 0.02]}
        rotation={[0, 0, Math.PI / 4]}
        scale={[s * 0.62, s * 0.95, s * 0.4]}
      >
        <octahedronGeometry args={[0.11, 0]} />
      </mesh>
    </group>
  );
}

/** HatStyle -> faceted crystal headwear. Sits in the head's `hat` group. */
export function Hat({ appearance, mats }: PartProps) {
  switch (appearance.hat) {
    case "wizard":
      // Tall cone, gold band at the base, gem on the front, brim sloping down.
      return (
        <group>
          <mesh material={mats.hatDark} position={[0, 0.06, 0]}>
            <coneGeometry args={[0.58, 0.2, 18, 1, true]} />
          </mesh>
          <Band mats={mats} r={0.575} y={-0.04} />
          <mesh material={mats.hat} position={[0, 0.44, 0]}>
            <coneGeometry args={[0.37, 0.82, 11]} />
          </mesh>
          <Band mats={mats} r={0.37} y={0.05} tube={0.035} />
          <HatGem mats={mats} y={0.22} z={0.27} />
        </group>
      );
    case "gnome":
      // Floppy cap with a drooping tip — sheet 05 has no pom-pom on it.
      return (
        <group>
          <mesh material={mats.hat} position={[0, 0.34, 0]}>
            <coneGeometry args={[0.47, 0.72, 12]} />
          </mesh>
          <mesh material={mats.hat} position={[0.1, 0.74, 0]} rotation={[0, 0, -0.55]}>
            <coneGeometry args={[0.15, 0.34, 9]} />
          </mesh>
          <mesh material={mats.hat} position={[0.24, 0.88, 0]} rotation={[0, 0, -1.15]}>
            <coneGeometry args={[0.075, 0.24, 8]} />
          </mesh>
          <Band mats={mats} r={0.46} y={0.0} tube={0.038} />
          <HatGem mats={mats} y={0.2} z={0.31} />
        </group>
      );
    case "fedora":
      // Brim rests just above the brow; crown rises a full head-height above it.
      // The brim is a FLAT horizontal disc — a Y-axis cylinder needs no rotation.
      return (
        <group position={[0, -0.12, 0]}>
          <mesh material={mats.hatDark} position={[0, 0.03, 0]} scale={[1, 1, 0.88]}>
            <cylinderGeometry args={[0.6, 0.6, 0.06, 20]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.34, 0.4, 0.42, 14]} />
          </mesh>
          {/* pinched crown */}
          <mesh material={mats.hatDark} position={[0, 0.44, 0]} scale={[0.4, 0.32, 1]}>
            <sphereGeometry args={[0.34, 12, 8]} />
          </mesh>
          <Band mats={mats} r={0.4} y={0.09} tube={0.05} />
          <HatGem mats={mats} y={0.13} z={0.33} s={0.85} />
        </group>
      );
    case "cork":
      // Sheet 05 draws this as a TOP HAT, not the corked bush hat in the prompt.
      return (
        <group position={[0, -0.11, 0]}>
          <mesh material={mats.hatDark} position={[0, 0.03, 0]} scale={[1, 1, 0.92]}>
            <cylinderGeometry args={[0.56, 0.56, 0.06, 20]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.37, 0.35, 0.7, 16]} />
          </mesh>
          <Band mats={mats} r={0.37} y={0.1} tube={0.05} />
          <HatGem mats={mats} y={0.2} z={0.33} s={0.85} />
        </group>
      );
    case "cowboy":
      // Brim curls UP at the sides — an apex-down cone gives that lift.
      return (
        <group position={[0, -0.11, 0]}>
          <mesh
            material={mats.hatDark}
            position={[0, 0.06, 0]}
            rotation={[Math.PI, 0, 0]}
            scale={[1, 1, 0.78]}
          >
            <coneGeometry args={[0.66, 0.22, 20, 1, true]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.34, 0.4, 0.44, 14]} />
          </mesh>
          <mesh material={mats.hatDark} position={[0, 0.47, 0]} scale={[0.38, 0.3, 1]}>
            <sphereGeometry args={[0.34, 12, 8]} />
          </mesh>
          <Band mats={mats} r={0.4} y={0.09} tube={0.05} />
          <HatGem mats={mats} y={0.14} z={0.34} s={0.85} />
        </group>
      );
    case "none":
    default:
      // Sheet 05 shows a plain bare head here — no floating sparkles.
      return null;
  }
}
