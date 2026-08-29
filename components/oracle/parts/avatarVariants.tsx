"use client";

import * as THREE from "three";
import type { AvatarVariant } from "@/lib/persona";

/**
 * Non-gnome body variants — additive silhouette geometry layered on the shared
 * rig so animation, lip-sync and critter reactions keep working unchanged.
 * `GnomeModel` also gates a couple of base parts per variant (beard for lady /
 * young-apprentice, legs for ghost).
 *
 * Mounted twice by `GnomeModel`: `slot="head"` inside the head group (origin =
 * head centre, radius ~0.46, +z = face) and `slot="body"` inside the torso group
 * (origin = chest; hem is down near y -1.1, head up at y ~0.62).
 *
 * All geometry/materials are module scope — a variant can mount on any persona
 * switch and per-mount allocation would leak.
 */
const geo = {
  ball: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cap: new THREE.CapsuleGeometry(1, 1.2, 2, 6),
};
const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...opts });

const FUR = mat("#6f5c66");
const FUR_DK = mat("#3c333c");
const CLAW = mat("#e9e2d4");
const GOWN = mat("#c8578f");
const GOWN_DK = mat("#9c3f6e");
const HAIR = mat("#5a3f52");
const GHOST = mat("#bff2ee", { transparent: true, opacity: 0.55, roughness: 0.35 });
const STONE = mat("#7b8390");
const STONE_DK = mat("#464c57");
const CORE = new THREE.MeshStandardMaterial({ color: "#ffd66b", emissive: "#ffd66b", emissiveIntensity: 1.4 });
const GOBLIN = mat("#7aa84c");
const GOBLIN_DK = mat("#557a33");
const SATCHEL = mat("#7a5334");

export type VariantSlot = "head" | "body";

function WerewolfHead() {
  return (
    <group>
      {/* swept-back pointed ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.cone} material={FUR} position={[s * 0.32, 0.38, -0.08]} rotation={[-0.4, 0, -s * 0.3]} scale={[0.1, 0.4, 0.08]} />
      ))}
      {/* brow fur + muzzle on the face */}
      <mesh geometry={geo.box} material={FUR} position={[0, 0.22, 0.32]} scale={[0.66, 0.12, 0.2]} />
      <mesh geometry={geo.cone} material={FUR} position={[0, -0.12, 0.4]} rotation={[1.35, 0, 0]} scale={[0.2, 0.26, 0.18]} />
      <mesh geometry={geo.ball} material={FUR_DK} position={[0, -0.06, 0.54]} scale={[0.09, 0.07, 0.08]} />
      {/* fang hints */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.cone} material={CLAW} position={[s * 0.06, -0.2, 0.46]} rotation={[Math.PI, 0, 0]} scale={[0.02, 0.05, 0.02]} />
      ))}
    </group>
  );
}

function GoblinHead() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.cone} material={GOBLIN} position={[s * 0.46, 0.06, -0.05]} rotation={[0.2, 0, -s * 1.25]} scale={[0.09, 0.5, 0.07]} />
      ))}
      {/* long hooked nose */}
      <mesh geometry={geo.cone} material={GOBLIN} position={[0, -0.06, 0.42]} rotation={[1.15, 0, 0]} scale={[0.09, 0.3, 0.09]} />
      {/* heavy brow */}
      <mesh geometry={geo.box} material={GOBLIN_DK} position={[0, 0.16, 0.34]} scale={[0.5, 0.09, 0.14]} />
    </group>
  );
}

function LadyHead() {
  return (
    <group>
      {/* hair mass behind + framing the face */}
      <mesh geometry={geo.ball} material={HAIR} position={[0, 0.12, -0.16]} scale={[0.56, 0.56, 0.5]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.cap} material={HAIR} position={[s * 0.42, -0.28, -0.02]} rotation={[0, 0, s * 0.12]} scale={[0.12, 0.4, 0.12]} />
      ))}
      {/* top bun */}
      <mesh geometry={geo.ball} material={HAIR} position={[0, 0.5, -0.06]} scale={0.2} />
    </group>
  );
}

function GolemHead() {
  return (
    <group>
      {/* cracked brow slab + jaw block */}
      <mesh geometry={geo.box} material={STONE_DK} position={[0, 0.18, 0.26]} scale={[0.78, 0.16, 0.18]} />
      <mesh geometry={geo.box} material={STONE} position={[0, -0.28, 0.24]} scale={[0.6, 0.22, 0.2]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.box} material={STONE} position={[s * 0.44, 0.02, 0]} scale={[0.14, 0.5, 0.4]} />
      ))}
    </group>
  );
}

function ApprenticeHead() {
  return (
    <group>
      {/* short mop of hair under the hat brim */}
      <mesh geometry={geo.ball} material={HAIR} position={[0, 0.28, 0]} scale={[0.5, 0.34, 0.5]} />
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} geometry={geo.cone} material={HAIR} position={[x, 0.42, 0.1]} rotation={[0.2, 0, x * 0.6]} scale={[0.1, 0.14, 0.1]} />
      ))}
    </group>
  );
}

function WerewolfBody() {
  return (
    <group>
      {/* neck ruff + hunched shoulder fur */}
      <mesh geometry={geo.ball} material={FUR} position={[0, 0.32, 0.14]} scale={[0.5, 0.22, 0.42]} />
      <mesh geometry={geo.ball} material={FUR_DK} position={[0, 0.16, -0.2]} scale={[0.5, 0.34, 0.32]} />
      {/* tail */}
      <mesh geometry={geo.cap} material={FUR} position={[0, -0.9, -0.34]} rotation={[-0.6, 0, 0]} scale={[0.1, 0.34, 0.1]} />
    </group>
  );
}

function GoblinBody() {
  return (
    <group>
      {/* ragged shoulder cloak + patched hem */}
      <mesh geometry={geo.ball} material={GOBLIN_DK} position={[0, 0.28, -0.06]} scale={[0.52, 0.2, 0.44]} />
      {[-0.3, 0.05, 0.34].map((x, i) => (
        <mesh key={i} geometry={geo.cone} material={GOBLIN_DK} position={[x, -0.98, 0.24]} rotation={[Math.PI, 0, x * 0.5]} scale={[0.12, 0.22, 0.1]} />
      ))}
    </group>
  );
}

function LadyBody() {
  return (
    <group>
      {/* gown flare replacing the robe cone read (robe is still there beneath) */}
      <mesh geometry={geo.cone} material={GOWN} position={[0, -0.7, 0]} rotation={[Math.PI, 0, 0]} scale={[0.62, 0.7, 0.62]} />
      <mesh geometry={geo.box} material={GOWN_DK} position={[0, 0.14, 0.22]} scale={[0.34, 0.4, 0.06]} />
      {/* shawl collar */}
      <mesh geometry={geo.cap} material={GOWN_DK} position={[0, 0.36, 0.06]} rotation={[0, 0, Math.PI / 2]} scale={[0.1, 0.4, 0.14]} />
    </group>
  );
}

function GhostBody() {
  return (
    <group>
      {/* translucent tapered lower body → wisp (legs are hidden by GnomeModel) */}
      <mesh geometry={geo.cone} material={GHOST} position={[0, -0.86, 0.02]} rotation={[Math.PI, 0, 0]} scale={[0.6, 1.05, 0.6]} />
      <mesh geometry={geo.ball} material={GHOST} position={[0, 0.02, 0.02]} scale={[0.52, 0.6, 0.44]} />
      {/* ragged tail tips */}
      {[-0.22, 0.06, 0.28].map((x, i) => (
        <mesh key={i} geometry={geo.cone} material={GHOST} position={[x, -1.34, 0.02]} rotation={[Math.PI, 0, 0]} scale={[0.12, 0.24, 0.12]} />
      ))}
    </group>
  );
}

function GolemBody() {
  return (
    <group>
      {/* rock plates over the torso + a glowing core */}
      <mesh geometry={geo.box} material={STONE} position={[0, 0.18, 0.12]} scale={[0.82, 0.6, 0.5]} />
      <mesh geometry={geo.box} material={STONE_DK} position={[-0.2, 0.3, 0.34]} rotation={[0, 0, 0.3]} scale={[0.28, 0.18, 0.1]} />
      <mesh geometry={geo.box} material={STONE_DK} position={[0.22, -0.02, 0.34]} rotation={[0, 0, -0.4]} scale={[0.24, 0.2, 0.1]} />
      <mesh geometry={geo.ball} material={CORE} position={[0, 0.16, 0.4]} scale={0.12} />
      {/* boulder shoulders */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.ball} material={STONE} position={[s * 0.5, 0.34, 0]} scale={0.26} />
      ))}
    </group>
  );
}

function ApprenticeBody() {
  return (
    <group>
      {/* an oversized spellbook hugged to the chest + a satchel strap */}
      <mesh geometry={geo.box} material={SATCHEL} position={[0, -0.02, 0.34]} scale={[0.34, 0.42, 0.1]} />
      <mesh geometry={geo.box} material={mat("#f2ead6")} position={[0, -0.02, 0.4]} scale={[0.28, 0.36, 0.04]} />
      <mesh geometry={geo.cap} material={SATCHEL} position={[0.02, 0.2, 0.1]} rotation={[0, 0, 1.1]} scale={[0.05, 0.4, 0.05]} />
    </group>
  );
}

export function AvatarVariantBody({
  variant,
  slot,
}: {
  variant?: AvatarVariant;
  slot: VariantSlot;
}) {
  if (!variant || variant === "gnome") return null;
  const head = slot === "head";
  switch (variant) {
    case "werewolf":
      return head ? <WerewolfHead /> : <WerewolfBody />;
    case "goblin":
      return head ? <GoblinHead /> : <GoblinBody />;
    case "lady":
      return head ? <LadyHead /> : <LadyBody />;
    case "ghost":
      return head ? null : <GhostBody />;
    case "stone-golem":
      return head ? <GolemHead /> : <GolemBody />;
    case "young-apprentice":
      return head ? <ApprenticeHead /> : <ApprenticeBody />;
    default:
      return null;
  }
}
