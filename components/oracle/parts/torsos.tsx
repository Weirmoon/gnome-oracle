"use client";

import * as THREE from "three";
import { HEM_Y, SHELL, frontZ } from "./body";
import type { PartProps } from "./types";
import type { PersonaMaterials } from "./materials";

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
const DETECTIVE_BELT = solid("#3d3025", 0.7);
const GOLD_BTN = solid("#d8a94a", 0.35);

/** Belt geometries, cached per tube radius — never allocate one per render. */
const beltGeos = new Map<number, THREE.TorusGeometry>();
function beltGeometry(tube: number): THREE.TorusGeometry {
  let g = beltGeos.get(tube);
  if (!g) {
    g = new THREE.TorusGeometry(0.45, tube, 6, 22);
    beltGeos.set(tube, g);
  }
  return g;
}
const buttonGeo = new THREE.SphereGeometry(0.035, 8, 6);
const pocketGeo = new THREE.BoxGeometry(0.15, 0.13, 0.035);

/**
 * A garment wrapping the body. Sheet 06 shows costumes as real coats and
 * shirts, not decals — the old flat panels sat at a fixed z 0.30-0.35 and sank
 * into a robe whose radius is 0.42-0.47, so they read as floating rectangles.
 */
function Shell({
  geo,
  material,
}: {
  geo: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  return <mesh geometry={geo} material={material} />;
}

/** Belt / sash round the waist. */
function Belt({ material, y = -0.38, tube = 0.05 }: { material: THREE.Material; y?: number; tube?: number }) {
  return (
    <mesh
      geometry={beltGeometry(tube)}
      material={material}
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  );
}

/** Lapel strip running down one side of an open front. */
function Lapel({
  material,
  side,
  mats,
}: {
  material: THREE.Material;
  side: 1 | -1;
  mats: PersonaMaterials;
}) {
  void mats;
  return (
    <mesh
      material={material}
      position={[side * 0.17, -0.22, frontZ(-0.22, 0.2)]}
      rotation={[0, side * -0.4, side * 0.09]}
    >
      <boxGeometry args={[0.11, 0.72, 0.04]} />
    </mesh>
  );
}

/** TorsoStyle -> costume worn over the base crystal robe. */
export function Torso({ appearance, mats }: PartProps) {
  switch (appearance.torsoStyle ?? "robe") {
    case "lab-coat":
      return (
        <group>
          <Shell geo={SHELL.open} material={WHITE} />
          <Lapel material={WHITE} side={-1} mats={mats} />
          <Lapel material={WHITE} side={1} mats={mats} />
          <mesh geometry={pocketGeo} material={WHITE} position={[0.24, -0.36, frontZ(-0.36, 0.24)]} />
          <mesh material={mats.accent} position={[0.24, -0.29, frontZ(-0.29, 0.24)]}>
            <boxGeometry args={[0.03, 0.12, 0.03]} />
          </mesh>
        </group>
      );
    case "chef-coat":
      return (
        <group>
          <Shell geo={SHELL.closed} material={CREAM} />
          {[-0.14, -0.3, -0.46].map((y) => (
            <mesh key={y} geometry={buttonGeo} material={GOLD_BTN} position={[0.1, y, frontZ(y, 0.1)]} />
          ))}
          {[-0.14, -0.3, -0.46].map((y) => (
            <mesh key={`b${y}`} geometry={buttonGeo} material={GOLD_BTN} position={[-0.02, y, frontZ(y, 0.02)]} />
          ))}
          <Belt material={mats.robeDark} y={HEM_Y + 0.12} tube={0.045} />
        </group>
      );
    case "yellow-shirt":
      return (
        <group>
          <Shell geo={SHELL.upper} material={SHIRT_YELLOW} />
          <Shell geo={SHELL.lower} material={PANTS_BLUE} />
        </group>
      );
    case "martial-gi":
      return (
        <group>
          <Shell geo={SHELL.closed} material={WHITE} />
          {/* crossed wrap lapels */}
          {([-1, 1] as const).map((s) => (
            <mesh
              key={s}
              material={WHITE}
              position={[s * 0.13, -0.16, frontZ(-0.16, 0.17)]}
              rotation={[0, s * -0.35, s * 0.55]}
            >
              <boxGeometry args={[0.13, 0.62, 0.04]} />
            </mesh>
          ))}
          <Belt material={mats.accent} y={-0.36} tube={0.055} />
        </group>
      );
    case "beach-shirt":
      return (
        <group>
          <Shell geo={SHELL.open} material={BEACH} />
          <Lapel material={BEACH} side={-1} mats={mats} />
          <Lapel material={BEACH} side={1} mats={mats} />
          {/* flower print */}
          {[[-0.22, -0.1], [0.24, -0.3], [-0.26, -0.48], [0.2, -0.6]].map(([x, y], i) => (
            <mesh key={i} material={WHITE} position={[x, y, frontZ(y, Math.abs(x))]} scale={[1, 1, 0.4]}>
              <sphereGeometry args={[0.052, 7, 6]} />
            </mesh>
          ))}
        </group>
      );
    case "collared-shirt":
      return (
        <group>
          <Shell geo={SHELL.closed} material={WHITE} />
          <mesh material={mats.robeDark} position={[0, -0.28, frontZ(-0.28, 0.06)]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.12, 0.56, 0.04]} />
          </mesh>
          <mesh material={mats.robeDark} position={[0, 0.02, frontZ(0.02, 0.07)]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.11, 0.11, 0.05]} />
          </mesh>
          <mesh geometry={pocketGeo} material={WHITE} position={[0.24, -0.36, frontZ(-0.36, 0.24)]} />
        </group>
      );
    case "fry-cook":
      return (
        <group>
          <Shell geo={SHELL.closed} material={WHITE} />
          <mesh material={RED} position={[0, -0.14, frontZ(-0.14, 0.1)]}>
            <coneGeometry args={[0.13, 0.44, 5]} />
          </mesh>
          <Belt material={BLACK} y={-0.42} tube={0.04} />
        </group>
      );
    case "pirate-coat":
      return (
        <group>
          <Shell geo={SHELL.open} material={mats.robeDark} />
          <Lapel material={mats.robeDark} side={-1} mats={mats} />
          <Lapel material={mats.robeDark} side={1} mats={mats} />
          <mesh material={RED} position={[0, -0.3, frontZ(-0.3, 0.3)]} rotation={[0, 0, 0.52]}>
            <boxGeometry args={[1.0, 0.15, 0.05]} />
          </mesh>
        </group>
      );
    case "tactical-suit":
      return (
        <group>
          <Shell geo={SHELL.closed} material={BLACK} />
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} material={mats.accent} position={[x, -0.12, frontZ(-0.12, 0.2)]}>
              <boxGeometry args={[0.16, 0.16, 0.04]} />
            </mesh>
          ))}
          <Belt material={mats.accent} y={-0.4} tube={0.045} />
        </group>
      );
    case "detective-coat":
      return (
        <group>
          <Shell geo={SHELL.open} material={DETECTIVE} />
          <Lapel material={DETECTIVE} side={-1} mats={mats} />
          <Lapel material={DETECTIVE} side={1} mats={mats} />
          <Belt material={DETECTIVE_BELT} y={-0.4} tube={0.05} />
        </group>
      );
    case "field-vest":
      return (
        <group>
          <Shell geo={SHELL.open} material={TAN} />
          <Lapel material={TAN} side={-1} mats={mats} />
          <Lapel material={TAN} side={1} mats={mats} />
          {[[-0.25, -0.2], [0.25, -0.2], [-0.27, -0.5], [0.27, -0.5]].map(([x, y], i) => (
            <mesh key={i} geometry={pocketGeo} material={CREAM} position={[x, y, frontZ(y, Math.abs(x))]} />
          ))}
        </group>
      );
    case "space-robe":
      // Stays the crystal robe — the star pattern does the work here.
      return (
        <group>
          <mesh material={mats.accent} position={[0, -0.12, frontZ(-0.12, 0.3)]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.022, 6, 18, Math.PI]} />
          </mesh>
        </group>
      );
    case "mechanic-coveralls":
      return (
        <group>
          <Shell geo={SHELL.closed} material={mats.robeDark} />
          <Belt material={BLACK} y={-0.38} tube={0.05} />
          {[-0.18, 0.18].map((x) => (
            <mesh key={x} geometry={pocketGeo} material={mats.accent} position={[x, -0.08, frontZ(-0.08, 0.18)]} />
          ))}
        </group>
      );
    case "robe":
    default:
      return null;
  }
}
