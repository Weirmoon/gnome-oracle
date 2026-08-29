"use client";

import { Component, Suspense, type ReactNode } from "react";
import * as THREE from "three";
import type { CritterId } from "./catalog";
import { CRITTER_MODELS } from "./critterModels";
import { GltfCritter } from "./GltfCritter";

/**
 * Critter models: SOFT PAINTED low-poly, deliberately not crystal.
 *
 * The gnome is faceted and translucent; these are the warm living contrast, so
 * they use smooth-shaded low-poly geometry (rounded forms, gentle gradients)
 * rather than the `flatShading` used everywhere in `parts/`.
 *
 * All materials and geometries are module scope: a critter mounts and unmounts
 * on every ambient event, and per-mount allocation would grow GPU memory over a
 * session. Nothing here is per-persona, so nothing needs disposing.
 */
const soft = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });

const glow = (color: string, intensity = 0.9) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });

// -- shared palettes -------------------------------------------------------
const SKIN_IMP = soft("#8bb04a");
const SKIN_IMP_DK = soft("#5f7d31");
const CLOTH_BROWN = soft("#6b4a2b", { roughness: 0.9 });
const EYE_DARK = soft("#1b1620", { roughness: 0.35 });
const EYE_WHITE = soft("#fdfbf4", { roughness: 0.4 });
const AMBER = soft("#e0a54a", { roughness: 0.5 });
const CLOUD = soft("#6b7183", { roughness: 0.95 });
const CLOUD_DK = soft("#4d5364", { roughness: 0.95 });
const RAIN = glow("#9ec8ee", 0.35);
const MOTH_WING = soft("#bfe9c4", { roughness: 0.6 });
const MOTH_BODY = soft("#e6efd9", { roughness: 0.8 });
const CROW_BODY = soft("#1d2233", { roughness: 0.5 });
const CROW_BEAK = soft("#c8b45a", { roughness: 0.5 });
const DEER_COAT = soft("#c8a878", { roughness: 0.85 });
const DEER_DK = soft("#7c5c3c", { roughness: 0.85 });
const DEER_DAPPLE = soft("#d8c4a0", { roughness: 0.9 });
const TOAD_BODY = soft("#7b9a52", { roughness: 0.9 });
const TOAD_DK = soft("#5d7a3d", { roughness: 0.9 });
const SNAIL_BODY = soft("#e4cba6", { roughness: 0.85 });
const SNAIL_SHELL = soft("#c98a3f", { roughness: 0.55 });
// Green low-poly dragon (ref sheet C13 — the canonical colourway).
const DRAGON_BODY = soft("#4f7a45", { roughness: 0.7 });
const DRAGON_BELLY = soft("#cdae6a", { roughness: 0.8 });
const DRAGON_HORN = soft("#efe3c2", { roughness: 0.6 });
const DRAGON_DK = soft("#35592f", { roughness: 0.75 });
const FAIRY_SKIN = soft("#f6d9b0", { roughness: 0.7 });
const LEAF = soft("#9aa86a", { roughness: 0.9 });
const WOODLAND_DARK = soft("#332b2a");
const WOODLAND_MATERIALS = new Map<string, THREE.MeshStandardMaterial>();
function woodlandMaterial(tint: string) {
  let material = WOODLAND_MATERIALS.get(tint);
  if (!material) {
    material = soft(tint);
    WOODLAND_MATERIALS.set(tint, material);
  }
  return material;
}

// -- shared geometry -------------------------------------------------------
const ball = new THREE.SphereGeometry(1, 12, 9);
const cone = new THREE.ConeGeometry(1, 1, 8);
const capsule = new THREE.CapsuleGeometry(1, 1.4, 3, 9);
const wingGeo = new THREE.SphereGeometry(1, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2);

/** Two eyes with a highlight, sized to the critter. */
function Eyes({ x = 0.16, y = 0.1, z = 0.3, r = 0.09, pupil = 0.05 }: {
  x?: number; y?: number; z?: number; r?: number; pupil?: number;
}) {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * x, y, z]}>
          <mesh geometry={ball} material={EYE_WHITE} scale={r} />
          <mesh geometry={ball} material={EYE_DARK} position={[0, 0, r * 0.65]} scale={pupil} />
        </group>
      ))}
    </group>
  );
}

/** Fairy — palm-sized, iridescent wings, cheeky. Ref: C06 / C13. */
function Fairy({ tint }: { tint: string }) {
  const wing = glow(tint, 0.5);
  return (
    <group scale={0.34}>
      <mesh geometry={capsule} material={FAIRY_SKIN} scale={[0.32, 0.3, 0.32]} />
      <mesh geometry={ball} material={FAIRY_SKIN} position={[0, 0.62, 0]} scale={0.36} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cone} material={FAIRY_SKIN}
          position={[s * 0.3, 0.68, -0.04]} rotation={[0, 0, -s * 0.7]} scale={[0.1, 0.24, 0.1]} />
      ))}
      <Eyes x={0.13} y={0.64} z={0.3} r={0.075} pupil={0.042} />
      {/* two pairs of dragonfly wings */}
      {[-1, 1].map((s) =>
        [0.34, -0.1].map((yo, i) => (
          <mesh key={`${s}-${i}`} geometry={wingGeo} material={wing}
            position={[s * 0.26, 0.4 + yo * 0.4, -0.16]}
            rotation={[Math.PI / 2, 0, s * (0.5 + i * 0.5)]}
            scale={[0.5 - i * 0.12, 0.16, 0.78 - i * 0.2]} />
        ))
      )}
    </group>
  );
}

/** Imp — knee-high goblin with big bat ears and a stolen trinket. Ref: C01. */
function Imp() {
  return (
    <group scale={0.5}>
      <mesh geometry={capsule} material={SKIN_IMP} scale={[0.4, 0.34, 0.36]} />
      <mesh geometry={ball} material={SKIN_IMP} position={[0, 0.78, 0.02]} scale={[0.46, 0.42, 0.44]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cone} material={SKIN_IMP_DK}
          position={[s * 0.46, 0.98, -0.06]} rotation={[0, 0, -s * 0.5]} scale={[0.16, 0.62, 0.08]} />
      ))}
      <Eyes x={0.16} y={0.8} z={0.38} r={0.1} pupil={0.055} />
      <mesh geometry={cone} material={SKIN_IMP} position={[0, 0.72, 0.42]} rotation={[1.5, 0, 0]} scale={[0.08, 0.18, 0.08]} />
      {/* loincloth + tail */}
      <mesh geometry={cone} material={CLOTH_BROWN} position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]} scale={[0.42, 0.4, 0.42]} />
      <mesh geometry={capsule} material={SKIN_IMP} position={[-0.36, -0.24, -0.3]} rotation={[0, 0, 1.1]} scale={[0.06, 0.3, 0.06]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={capsule} material={SKIN_IMP}
          position={[s * 0.24, -0.72, 0]} scale={[0.11, 0.2, 0.11]} />
      ))}
      <mesh geometry={ball} material={soft("#b23a34")} position={[0.44, -0.06, 0.12]} scale={0.17} />
    </group>
  );
}

/** Raincloud — grumpy storm cloud with rain streaks. Ref: C03. */
function Raincloud() {
  return (
    <group scale={0.62}>
      {[[0, 0, 0, 0.56], [-0.44, -0.06, 0.02, 0.4], [0.44, -0.04, -0.02, 0.42],
        [-0.2, 0.24, -0.04, 0.36], [0.22, 0.22, 0.03, 0.34]].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={ball} material={i % 2 ? CLOUD_DK : CLOUD}
          position={[x, y, z]} scale={[r * 1.2, r, r]} />
      ))}
      <Eyes x={0.2} y={0.02} z={0.5} r={0.13} pupil={0.07} />
      {/* scowl */}
      <mesh geometry={ball} material={EYE_DARK} position={[0, -0.22, 0.5]} scale={[0.16, 0.05, 0.05]} />
      {[-0.5, -0.18, 0.16, 0.48].map((x, i) => (
        <mesh key={i} geometry={capsule} material={RAIN}
          position={[x, -0.62 - (i % 2) * 0.16, 0.08]} scale={[0.035, 0.12, 0.035]} />
      ))}
      <mesh geometry={cone} material={glow("#ffd66b", 1.1)} position={[0.06, -0.72, 0.16]} rotation={[0, 0, 0.3]} scale={[0.12, 0.3, 0.06]} />
    </group>
  );
}

/**
 * Dragon — pot-bellied but unmistakably a dragon at thumbnail size: big membrane
 * wings, a horn crown, a spine ridge and a long tapered tail. Faces +z. Ref: C13.
 */
function Dragon() {
  return (
    <group scale={0.92}>
      {/* torso + pot belly */}
      <mesh geometry={ball} material={DRAGON_BODY} scale={[0.58, 0.52, 0.74]} />
      <mesh geometry={ball} material={DRAGON_BELLY} position={[0, -0.16, 0.3]} scale={[0.44, 0.38, 0.46]} />

      {/* raised neck + head */}
      <mesh geometry={capsule} material={DRAGON_BODY} position={[0, 0.44, 0.34]} rotation={[0.6, 0, 0]} scale={[0.19, 0.28, 0.19]} />
      <mesh geometry={ball} material={DRAGON_BODY} position={[0, 0.74, 0.58]} scale={[0.33, 0.31, 0.4]} />
      <mesh geometry={cone} material={DRAGON_BODY} position={[0, 0.66, 0.92]} rotation={[1.5, 0, 0]} scale={[0.19, 0.34, 0.16]} />
      <mesh geometry={ball} material={DRAGON_BELLY} position={[0, 0.58, 0.88]} scale={[0.12, 0.09, 0.14]} />
      <Eyes x={0.17} y={0.82} z={0.8} r={0.11} pupil={0.055} />

      {/* horn crown — two swept-back, two small brow horns */}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} geometry={cone} material={DRAGON_HORN}
          position={[s * 0.16, 0.98, 0.46]} rotation={[-0.8, 0, -s * 0.22]} scale={[0.07, 0.36, 0.07]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`hb${s}`} geometry={cone} material={DRAGON_HORN}
          position={[s * 0.24, 0.84, 0.66]} rotation={[-0.2, 0, -s * 0.6]} scale={[0.04, 0.16, 0.04]} />
      ))}

      {/* membrane wings — arm bone + finger struts over a flat webbed fan */}
      {[-1, 1].map((s) => (
        <group key={`w${s}`} position={[s * 0.36, 0.32, -0.12]} rotation={[0.2, s * 0.5, s * 0.95]}>
          <mesh geometry={wingGeo} material={DRAGON_DK} rotation={[Math.PI / 2, 0, 0]} scale={[0.98, 0.05, 0.82]} />
          <mesh geometry={capsule} material={DRAGON_BODY} position={[0.32, 0.02, 0.16]} rotation={[0, 0, 1.2]} scale={[0.045, 0.72, 0.045]} />
          {[0, 1, 2].map((f) => (
            <mesh key={f} geometry={capsule} material={DRAGON_BODY}
              position={[0.22 + f * 0.2, -0.05, -0.08 - f * 0.18]} rotation={[0.35, 0, 1.05]} scale={[0.028, 0.44, 0.028]} />
          ))}
        </group>
      ))}

      {/* spine ridge, shoulders down to the tail */}
      {[0.42, 0.12, -0.2, -0.52, -0.82].map((z, i) => (
        <mesh key={`sp${i}`} geometry={cone} material={DRAGON_DK}
          position={[0, 0.46 - i * 0.06, z]} rotation={[0.15, 0, 0]} scale={[0.05, 0.17 - i * 0.022, 0.09]} />
      ))}

      {/* legs */}
      {[-1, 1].map((s) =>
        [0.3, -0.3].map((z, i) => (
          <mesh key={`l${s}-${i}`} geometry={capsule} material={DRAGON_BODY}
            position={[s * 0.4, -0.46, z]} scale={[0.12, 0.15, 0.12]} />
        ))
      )}

      {/* long tapered segmented tail */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`t${i}`} geometry={cone} material={DRAGON_BODY}
          position={[0, -0.06 - i * 0.015, -0.72 - i * 0.34]} rotation={[-1.42, 0, 0]}
          scale={[0.15 - i * 0.033, 0.42, 0.15 - i * 0.033]} />
      ))}
      <mesh geometry={cone} material={DRAGON_DK} position={[0, -0.02, -1.9]} rotation={[-1.5, 0, 0]} scale={[0.12, 0.18, 0.06]} />
    </group>
  );
}

/**
 * Deer — slender and shoulder-height to the gnome, with real branched antlers,
 * separate soft ears and a dappled coat. Faces +x. Built so the body sits near
 * the group origin (feet just below it). Ref: C3 / C13.
 */
function Deer() {
  return (
    <group scale={1.0}>
      {/* barrel body + haunch + chest */}
      <mesh geometry={capsule} material={DEER_COAT} position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.24, 0.32, 0.26]} />
      <mesh geometry={ball} material={DEER_COAT} position={[-0.32, 0.52, 0]} scale={[0.25, 0.27, 0.25]} />
      <mesh geometry={ball} material={DEER_COAT} position={[0.28, 0.54, 0]} scale={[0.2, 0.22, 0.2]} />

      {/* neck + head */}
      <mesh geometry={capsule} material={DEER_COAT} position={[0.4, 0.92, 0]} rotation={[0, 0, -0.7]} scale={[0.1, 0.26, 0.1]} />
      <mesh geometry={ball} material={DEER_COAT} position={[0.58, 1.2, 0]} scale={[0.15, 0.15, 0.19]} />
      <mesh geometry={capsule} material={DEER_COAT} position={[0.72, 1.12, 0]} rotation={[0, 0, 1.3]} scale={[0.07, 0.12, 0.08]} />
      <mesh geometry={ball} material={DEER_DK} position={[0.8, 1.06, 0]} scale={0.055} />
      <Eyes x={0.02} y={1.24} z={0.16} r={0.055} pupil={0.036} />

      {/* soft ears */}
      {[-1, 1].map((s) => (
        <mesh key={`e${s}`} geometry={cone} material={DEER_COAT}
          position={[0.5, 1.32, s * 0.15]} rotation={[s * 0.8, 0, -0.35]} scale={[0.055, 0.16, 0.03]} />
      ))}

      {/* branched antlers — swept-back beam + three tines each side */}
      {[-1, 1].map((s) => (
        <group key={`a${s}`} position={[0.54, 1.38, s * 0.1]} rotation={[s * 0.4, 0, 0.25]}>
          <mesh geometry={capsule} material={DEER_DK} position={[-0.03, 0.16, 0]} rotation={[0, 0, 0.2]} scale={[0.026, 0.2, 0.026]} />
          <mesh geometry={capsule} material={DEER_DK} position={[-0.16, 0.26, 0]} rotation={[0, 0, 1.15]} scale={[0.02, 0.11, 0.02]} />
          <mesh geometry={capsule} material={DEER_DK} position={[0.03, 0.36, 0.05]} rotation={[0.5, 0, 0.25]} scale={[0.02, 0.13, 0.02]} />
          <mesh geometry={capsule} material={DEER_DK} position={[-0.06, 0.47, 0]} rotation={[0, 0, 0.12]} scale={[0.018, 0.11, 0.018]} />
        </group>
      ))}

      {/* thin long legs */}
      {[-1, 1].map((s) =>
        [0.28, -0.32].map((x, i) => (
          <mesh key={`l${s}-${i}`} geometry={capsule} material={DEER_DK}
            position={[x, 0.02, s * 0.15]} scale={[0.036, 0.3, 0.036]} />
        ))
      )}

      {/* short tail + coat dappling */}
      <mesh geometry={ball} material={DEER_DAPPLE} position={[-0.44, 0.62, 0]} scale={[0.06, 0.09, 0.06]} />
      {[[-0.08, 0.6, 0.22], [0.1, 0.54, 0.23], [-0.24, 0.48, 0.19], [-0.02, 0.66, -0.22], [0.16, 0.56, -0.2]].map((d, i) => (
        <mesh key={`d${i}`} geometry={ball} material={DEER_DAPPLE}
          position={[d[0], d[1], d[2]]} scale={[0.045, 0.045, 0.02]} />
      ))}
    </group>
  );
}

/** Will-o'-wisp — flame orb with a wispy tail. Ref: plan C4. */
function Wisp({ tint }: { tint: string }) {
  const core = glow(tint, 0.85);
  const halo = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.24, depthWrite: false });
  return (
    <group scale={0.4}>
      <mesh geometry={ball} material={halo} scale={1.5} />
      <mesh geometry={ball} material={core} scale={0.85} />
      <Eyes x={0.24} y={0.1} z={0.72} r={0.13} pupil={0.08} />
      {[0.5, 0.85, 1.15].map((y, i) => (
        <mesh key={i} geometry={cone} material={core}
          position={[i % 2 ? 0.1 : -0.08, -y, 0]} rotation={[0, 0, Math.PI]}
          scale={[0.34 - i * 0.09, 0.4, 0.34 - i * 0.09]} />
      ))}
    </group>
  );
}

/** Luna moth — pale mint, feathery antennae, long tails. Ref: C05. */
function Moth() {
  return (
    <group scale={0.5}>
      <mesh geometry={capsule} material={MOTH_BODY} scale={[0.1, 0.26, 0.1]} />
      <mesh geometry={ball} material={MOTH_BODY} position={[0, 0.42, 0]} scale={0.14} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={wingGeo} material={MOTH_WING}
            position={[s * 0.42, 0.16, -0.02]} rotation={[Math.PI / 2, 0, s * 0.35]}
            scale={[0.6, 0.1, 0.5]} />
          <mesh geometry={cone} material={MOTH_WING}
            position={[s * 0.36, -0.5, -0.02]} rotation={[Math.PI, 0, s * 0.2]}
            scale={[0.2, 0.62, 0.1]} />
          <mesh geometry={capsule} material={MOTH_BODY}
            position={[s * 0.14, 0.6, 0.04]} rotation={[0, 0, -s * 0.5]} scale={[0.02, 0.14, 0.02]} />
        </group>
      ))}
    </group>
  );
}

/** Snail — amber spiral shell, sleepy eyestalks. Ref: C07. */
function Snail() {
  return (
    <group scale={0.36}>
      <mesh geometry={capsule} material={SNAIL_BODY} rotation={[0, 0, Math.PI / 2]} scale={[0.22, 0.42, 0.24]} />
      <mesh geometry={ball} material={SNAIL_BODY} position={[0.52, 0.1, 0]} scale={[0.24, 0.22, 0.22]} />
      {/* shell: a few rings standing in for the spiral */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={ball} material={SNAIL_SHELL}
          position={[-0.16 + i * 0.06, 0.34 + i * 0.05, 0]}
          scale={[0.46 - i * 0.13, 0.44 - i * 0.13, 0.3 - i * 0.07]} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={capsule} material={SNAIL_BODY}
            position={[0.6, 0.4, s * 0.1]} rotation={[0, 0, -0.25]} scale={[0.035, 0.18, 0.035]} />
          <mesh geometry={ball} material={EYE_DARK} position={[0.68, 0.62, s * 0.1]} scale={0.06} />
        </group>
      ))}
    </group>
  );
}

/** Crow — glossy blue-black, clever head, gold beak. Ref: C09. */
function Crow({ hat }: { hat?: boolean }) {
  return (
    <group scale={0.62}>
      <mesh geometry={capsule} material={CROW_BODY} rotation={[0.35, 0, 0]} scale={[0.32, 0.34, 0.34]} />
      <mesh geometry={ball} material={CROW_BODY} position={[0, 0.62, 0.16]} scale={[0.28, 0.28, 0.3]} />
      <mesh geometry={cone} material={CROW_BEAK} position={[0, 0.56, 0.46]} rotation={[1.5, 0, 0]} scale={[0.09, 0.28, 0.07]} />
      <Eyes x={0.14} y={0.7} z={0.24} r={0.075} pupil={0.045} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={wingGeo} material={CROW_BODY}
          position={[s * 0.34, 0.1, -0.04]} rotation={[Math.PI / 2, 0, s * 0.3]}
          scale={[0.34, 0.12, 0.58]} />
      ))}
      <mesh geometry={cone} material={CROW_BODY} position={[0, -0.18, -0.5]} rotation={[-1.2, 0, 0]} scale={[0.18, 0.42, 0.1]} />
      {hat && (
        <group position={[0, 0.42, 0.78]} rotation={[0.5, 0, 0.2]}>
          <mesh geometry={cone} material={soft("#5a3aa0")} scale={[0.3, 0.5, 0.3]} />
          <mesh geometry={ball} material={soft("#ffd66b")} position={[0, -0.2, 0]} scale={[0.34, 0.05, 0.34]} />
        </group>
      )}
    </group>
  );
}

/** Firefly swarm — one group of 8 glowing bugs. Ref: C10. */
function Fireflies({ tint }: { tint: string }) {
  const body = soft("#3a3226", { roughness: 0.8 });
  const lamp = glow(tint, 3.2);
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const r = 0.28 + (i % 3) * 0.12;
        return (
          <group key={i} position={[Math.cos(a) * r, Math.sin(a * 1.7) * 0.26, Math.sin(a) * r * 0.5]}>
            <mesh geometry={ball} material={body} scale={[0.055, 0.045, 0.08]} />
            <mesh geometry={ball} material={lamp} position={[0, -0.02, 0.09]} scale={0.1} />
          </group>
        );
      })}
    </group>
  );
}

/** Dust gust — translucent motion ribbons with tumbling leaves. Ref: C02 / C11. */
function Gust() {
  const ribbon = new THREE.MeshBasicMaterial({
    color: "#cfe3f5", transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide,
  });
  return (
    <group scale={0.9}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={ribbon} position={[0, -0.4 + i * 0.32, 0]} rotation={[Math.PI / 2, 0, i * 0.7]}>
          <torusGeometry args={[0.34 + i * 0.08, 0.035, 5, 16, Math.PI * 1.5]} />
        </mesh>
      ))}
      {[[0.4, 0.2], [-0.34, 0.6], [0.22, -0.3]].map(([x, y], i) => (
        <mesh key={i} geometry={ball} material={LEAF} position={[x, y, 0.12]} rotation={[0.4, i, 0.3]} scale={[0.09, 0.03, 0.06]} />
      ))}
    </group>
  );
}

/** Toad — fat, warty, copper eyes. Ref: C04 / C12. */
function Toad() {
  return (
    <group scale={0.42}>
      <mesh geometry={ball} material={TOAD_BODY} scale={[0.62, 0.44, 0.56]} />
      <mesh geometry={ball} material={soft("#d9d2a8", { roughness: 0.9 })} position={[0, -0.18, 0.3]} scale={[0.38, 0.22, 0.3]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={ball} material={TOAD_BODY} position={[s * 0.2, 0.32, 0.14]} scale={0.19} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.2, 0.36, 0.2]}>
          <mesh geometry={ball} material={AMBER} scale={0.13} />
          <mesh geometry={ball} material={EYE_DARK} position={[0, 0, 0.1]} scale={[0.03, 0.09, 0.03]} />
        </group>
      ))}
      <mesh geometry={ball} material={TOAD_DK} position={[0, -0.06, 0.54]} scale={[0.28, 0.03, 0.05]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={capsule} material={TOAD_DK}
          position={[s * 0.5, -0.28, 0.12]} rotation={[0, 0, s * 0.9]} scale={[0.1, 0.14, 0.1]} />
      ))}
    </group>
  );
}

// -- woodland-critter shared materials (module scope; see file header) --------
const FUR_CREAM = soft("#e8dcc8", { roughness: 0.9 });
const FUR_WHITE = soft("#f4efe6", { roughness: 0.9 });
const HORN_PALE = soft("#efe3c2", { roughness: 0.6 });
const BEAK_H = soft("#e0a54a", { roughness: 0.5 });
const BAT_WING = soft("#443f5c", { roughness: 0.8 });
const CHAM_DK = soft("#3f8a44", { roughness: 0.7 });
const TONGUE = soft("#e08a7a", { roughness: 0.6 });

type EarKind = "prick" | "round" | "long" | "tuft";
type TailKind = "brush" | "puff" | "stub" | "none";

/**
 * Shared four-legged body plan for the woodland critters, faced +x. Built like
 * `Deer` (body seated ~0.5 above the group origin, feet just below it) so the
 * one `scale` knob sizes it in the world.
 */
function Quadruped({
  fur, dark, scale, ear, tail, snout = 0.13, markings,
}: {
  fur: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial;
  scale: number; ear: EarKind; tail: TailKind; snout?: number; markings?: ReactNode;
}) {
  return (
    <group scale={scale}>
      <mesh geometry={capsule} material={fur} position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.28, 0.4, 0.3]} />
      <mesh geometry={ball} material={fur} position={[-0.34, 0.5, 0]} scale={[0.3, 0.32, 0.3]} />
      <mesh geometry={ball} material={fur} position={[0.3, 0.52, 0]} scale={[0.24, 0.26, 0.25]} />
      <mesh geometry={capsule} material={fur} position={[0.42, 0.74, 0]} rotation={[0, 0, -0.8]} scale={[0.13, 0.22, 0.13]} />
      <mesh geometry={ball} material={fur} position={[0.62, 0.9, 0]} scale={[0.22, 0.21, 0.24]} />
      {snout > 0 && (
        <mesh geometry={cone} material={fur} position={[0.78, 0.82, 0]} rotation={[0, 0, 1.35]} scale={[0.1, snout, 0.1]} />
      )}
      <mesh geometry={ball} material={EYE_DARK} position={[0.86, 0.79, 0]} scale={0.045} />
      <Eyes x={0.02} y={0.96} z={0.2} r={0.055} pupil={0.036} />
      {[-1, 1].map((s) => {
        const p: [number, number, number] = [0.54, 1.04, s * 0.15];
        if (ear === "prick")
          return <mesh key={s} geometry={cone} material={fur} position={p} rotation={[s * 0.3, 0, -0.15]} scale={[0.07, 0.18, 0.045]} />;
        if (ear === "tuft")
          return <mesh key={s} geometry={cone} material={dark} position={p} rotation={[s * 0.4, 0, -0.05]} scale={[0.05, 0.15, 0.035]} />;
        if (ear === "long")
          return <mesh key={s} geometry={capsule} material={fur} position={[p[0] - 0.03, p[1] + 0.16, p[2]]} rotation={[s * 0.12, 0, -0.12]} scale={[0.05, 0.2, 0.035]} />;
        return <mesh key={s} geometry={ball} material={fur} position={p} scale={0.1} />;
      })}
      {[-1, 1].map((s) =>
        [0.3, -0.34].map((x, i) => (
          <mesh key={`${s}-${i}`} geometry={capsule} material={dark} position={[x, 0.12, s * 0.17]} scale={[0.052, 0.26, 0.052]} />
        ))
      )}
      {tail === "brush" && (
        <mesh geometry={capsule} material={fur} position={[-0.56, 0.52, 0]} rotation={[0, 0, 0.7]} scale={[0.1, 0.32, 0.1]} />
      )}
      {tail === "puff" && <mesh geometry={ball} material={fur} position={[-0.5, 0.7, 0]} scale={[0.24, 0.32, 0.22]} />}
      {tail === "stub" && <mesh geometry={ball} material={FUR_WHITE} position={[-0.5, 0.52, 0]} scale={0.09} />}
      {markings}
    </group>
  );
}

function Wolf({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <Quadruped fur={fur} dark={WOODLAND_DARK} scale={1.05} ear="prick" tail="brush" snout={0.18}
      markings={<mesh geometry={ball} material={FUR_CREAM} position={[0.7, 0.78, 0]} scale={[0.12, 0.14, 0.16]} />} />
  );
}

function Bobcat({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <Quadruped fur={fur} dark={soft("#8a5c38", { roughness: 0.85 })} scale={0.78} ear="tuft" tail="stub" snout={0.09}
      markings={
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={ball} material={WOODLAND_DARK} position={[0.5 + s * 0.03, 0.9, s * 0.06]} scale={[0.03, 0.09, 0.03]} />
          ))}
        </>
      } />
  );
}

function Fox({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <Quadruped fur={fur} dark={soft("#2b2320", { roughness: 0.9 })} scale={0.72} ear="prick" tail="brush" snout={0.2}
      markings={
        <>
          <mesh geometry={ball} material={FUR_WHITE} position={[0.72, 0.74, 0]} scale={[0.12, 0.12, 0.16]} />
          <mesh geometry={capsule} material={FUR_WHITE} position={[-0.68, 0.44, 0]} rotation={[0, 0, 0.7]} scale={[0.07, 0.12, 0.07]} />
        </>
      } />
  );
}

function Rabbit({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <Quadruped fur={fur} dark={soft("#b39f90", { roughness: 0.9 })} scale={0.6} ear="long" tail="stub" snout={0.05} />
  );
}

function Raccoon({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  const dk = soft("#33373d", { roughness: 0.85 });
  return (
    <Quadruped fur={fur} dark={dk} scale={0.66} ear="round" tail="brush" snout={0.11}
      markings={
        <>
          <mesh geometry={ball} material={dk} position={[0.7, 0.9, 0]} scale={[0.1, 0.08, 0.2]} />
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={capsule} material={dk} position={[-0.44 - i * 0.14, 0.5 + i * 0.06, 0]} rotation={[0, 0, 0.7]} scale={[0.11, 0.05, 0.11]} />
          ))}
        </>
      } />
  );
}

function Squirrel({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <group scale={0.5}>
      <Quadruped fur={fur} dark={fur} scale={1} ear="round" tail="none" snout={0.07} />
      {/* big S-curved tail arcing up behind */}
      <mesh geometry={capsule} material={fur} position={[-0.5, 0.7, 0]} rotation={[0, 0, 1.5]} scale={[0.16, 0.34, 0.16]} />
      <mesh geometry={ball} material={fur} position={[-0.5, 1.06, 0]} scale={[0.22, 0.3, 0.2]} />
    </group>
  );
}

function Goat({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <Quadruped fur={fur} dark={soft("#a39a83", { roughness: 0.85 })} scale={0.8} ear="long" tail="stub" snout={0.14}
      markings={
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={cone} material={HORN_PALE} position={[0.5, 1.06, s * 0.1]} rotation={[-0.9, 0, -s * 0.2]} scale={[0.05, 0.24, 0.05]} />
          ))}
          <mesh geometry={cone} material={FUR_WHITE} position={[0.82, 0.68, 0]} rotation={[Math.PI, 0, 0]} scale={[0.05, 0.14, 0.05]} />
        </>
      } />
  );
}

function QuillBeast({ tint, scale, quills }: { tint: string; scale: number; quills: number }) {
  const fur = woodlandMaterial(tint);
  return (
    <group scale={scale}>
      <mesh geometry={ball} material={fur} position={[0, 0.42, 0]} scale={[0.5, 0.42, 0.56]} />
      <mesh geometry={ball} material={FUR_CREAM} position={[0.44, 0.32, 0]} scale={[0.24, 0.22, 0.24]} />
      <mesh geometry={cone} material={fur} position={[0.62, 0.3, 0]} rotation={[0, 0, 1.4]} scale={[0.09, 0.14, 0.09]} />
      <mesh geometry={ball} material={EYE_DARK} position={[0.72, 0.3, 0]} scale={0.045} />
      <Eyes x={0.02} y={0.42} z={0.32} r={0.05} pupil={0.032} />
      {Array.from({ length: quills }, (_, i) => {
        const a = (i / quills) * Math.PI * 1.5 - Math.PI * 0.25;
        return (
          <mesh key={i} geometry={cone} material={WOODLAND_DARK}
            position={[Math.cos(a) * 0.3 - 0.1, 0.42 + Math.sin(a) * 0.3, ((i % 3) - 1) * 0.22]}
            rotation={[0, 0, a - Math.PI / 2]} scale={[0.04, scale > 0.6 ? 0.36 : 0.22, 0.04]} />
        );
      })}
      {[-1, 1].map((s) =>
        [0.24, -0.28].map((x, i) => (
          <mesh key={`${s}-${i}`} geometry={capsule} material={WOODLAND_DARK} position={[x, 0.06, s * 0.16]} scale={[0.045, 0.16, 0.045]} />
        ))
      )}
    </group>
  );
}

const Hedgehog = ({ tint }: { tint: string }) => <QuillBeast tint={tint} scale={0.5} quills={14} />;
const Porcupine = ({ tint }: { tint: string }) => <QuillBeast tint={tint} scale={0.7} quills={18} />;

/** Owl — round body, face disc, ear tufts, folded wings. Faces +z. Ref: critter-06. */
function Owl({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <group scale={0.62}>
      <mesh geometry={ball} material={fur} position={[0, 0.2, 0]} scale={[0.5, 0.62, 0.46]} />
      <mesh geometry={ball} material={FUR_CREAM} position={[0, 0.02, 0.34]} scale={[0.32, 0.42, 0.24]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={wingGeo} material={fur} position={[s * 0.44, 0.18, 0.02]} rotation={[Math.PI / 2, 0, s * 0.2]} scale={[0.2, 0.16, 0.6]} />
      ))}
      <mesh geometry={ball} material={fur} position={[0, 0.62, 0.18]} scale={[0.42, 0.4, 0.4]} />
      <mesh geometry={ball} material={FUR_CREAM} position={[0, 0.58, 0.44]} scale={[0.34, 0.3, 0.16]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cone} material={fur} position={[s * 0.24, 0.92, 0.1]} rotation={[-0.3, 0, -s * 0.5]} scale={[0.09, 0.22, 0.06]} />
      ))}
      <Eyes x={0.16} y={0.58} z={0.56} r={0.14} pupil={0.075} />
      <mesh geometry={cone} material={BEAK_H} position={[0, 0.5, 0.56]} rotation={[1.5, 0, 0]} scale={[0.06, 0.12, 0.05]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={capsule} material={BEAK_H} position={[s * 0.12, -0.24, 0.1]} scale={[0.05, 0.1, 0.05]} />
      ))}
    </group>
  );
}

/** Bat — small body, big membrane wings, faces +z. Ref: critter-07. */
function Bat({ tint }: { tint: string }) {
  const fur = woodlandMaterial(tint);
  return (
    <group scale={0.5}>
      <mesh geometry={capsule} material={fur} position={[0, 0, 0]} scale={[0.22, 0.3, 0.22]} />
      <mesh geometry={ball} material={fur} position={[0, 0.44, 0.06]} scale={[0.26, 0.24, 0.26]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cone} material={fur} position={[s * 0.16, 0.66, 0]} rotation={[0, 0, -s * 0.3]} scale={[0.09, 0.2, 0.05]} />
      ))}
      <Eyes x={0.09} y={0.44} z={0.24} r={0.05} pupil={0.03} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.12, 0.1, -0.04]} rotation={[0, s * -0.4, 0]}>
          <mesh geometry={wingGeo} material={BAT_WING} rotation={[Math.PI / 2, 0, s * 1.2]} scale={[0.7, 0.05, 0.55]} />
          <mesh geometry={capsule} material={fur} position={[s * 0.34, 0.04, 0]} rotation={[0, 0, s * 1.3]} scale={[0.03, 0.4, 0.03]} />
        </group>
      ))}
    </group>
  );
}

/** Chameleon — curl tail, casque crest, turret eyes. Faces +x. Ref: critter-12. */
function Chameleon({ tint }: { tint: string }) {
  const body = woodlandMaterial(tint);
  return (
    <group scale={0.5}>
      <mesh geometry={ball} material={body} position={[0, 0.44, 0]} scale={[0.42, 0.36, 0.3]} />
      {/* dorsal ridge */}
      {[0.2, 0, -0.2].map((x, i) => (
        <mesh key={i} geometry={cone} material={CHAM_DK} position={[x, 0.78 - i * 0.02, 0]} scale={[0.04, 0.1, 0.08]} />
      ))}
      {/* neck + head + casque */}
      <mesh geometry={ball} material={body} position={[0.42, 0.56, 0]} scale={[0.22, 0.22, 0.22]} />
      <mesh geometry={cone} material={CHAM_DK} position={[0.4, 0.82, 0]} rotation={[0, 0, -0.2]} scale={[0.16, 0.24, 0.12]} />
      {/* turret eyes */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.44, 0.56, s * 0.18]}>
          <mesh geometry={ball} material={body} scale={0.13} />
          <mesh geometry={ball} material={EYE_DARK} position={[0.05, 0, s * 0.04]} scale={0.05} />
        </group>
      ))}
      {/* snout */}
      <mesh geometry={cone} material={body} position={[0.62, 0.5, 0]} rotation={[0, 0, 1.5]} scale={[0.1, 0.12, 0.1]} />
      {/* splayed legs */}
      {[-1, 1].map((s) =>
        [0.24, -0.24].map((x, i) => (
          <mesh key={`${s}-${i}`} geometry={capsule} material={CHAM_DK} position={[x, 0.2, s * 0.26]} rotation={[s * 0.5, 0, x > 0 ? 0.4 : -0.4]} scale={[0.05, 0.18, 0.05]} />
        ))
      )}
      {/* curled tail */}
      <mesh geometry={capsule} material={body} position={[-0.42, 0.4, 0]} rotation={[0, 0, 0.6]} scale={[0.07, 0.2, 0.07]} />
      <mesh geometry={capsule} material={body} position={[-0.56, 0.26, 0]} rotation={[0, 0, 1.7]} scale={[0.05, 0.14, 0.05]} />
      <mesh geometry={ball} material={body} position={[-0.5, 0.16, 0]} scale={0.07} />
    </group>
  );
}

/** The all-primitive model for a critter id — the fallback when no glTF exists. */
function ProceduralCritter({ id, tint }: { id: CritterId; tint: string }) {
  switch (id) {
    case "fairy": return <Fairy tint={tint} />;
    case "imp": return <Imp />;
    case "raincloud": return <Raincloud />;
    case "dragon": return <Dragon />;
    case "deer": return <Deer />;
    case "wisp": return <Wisp tint={tint} />;
    case "moth": return <Moth />;
    case "snail": return <Snail />;
    case "crow": return <Crow hat />;
    case "fireflies": return <Fireflies tint={tint} />;
    case "gust": return <Gust />;
    case "toad": return <Toad />;
    case "wolf": return <Wolf tint={tint} />; case "bobcat": return <Bobcat tint={tint} />;
    case "fox": return <Fox tint={tint} />; case "rabbit": return <Rabbit tint={tint} />;
    case "raccoon": return <Raccoon tint={tint} />; case "owl": return <Owl tint={tint} />;
    case "bat": return <Bat tint={tint} />; case "squirrel": return <Squirrel tint={tint} />;
    case "hedgehog": return <Hedgehog tint={tint} />; case "goat": return <Goat tint={tint} />;
    case "porcupine": return <Porcupine tint={tint} />; case "chameleon": return <Chameleon tint={tint} />;
    default: return null;
  }
}

/**
 * Render the model for a critter id. Uses the authored glTF from
 * `public/critters/` when `CRITTER_MODELS` has an entry for the id (and the file
 * loads); otherwise the all-primitive `ProceduralCritter`.
 */
export function CritterModel({ id, tint }: { id: CritterId; tint: string }) {
  const cfg = CRITTER_MODELS[id];
  const fallback = <ProceduralCritter id={id} tint={tint} />;
  if (!cfg) return fallback;
  return (
    <GltfErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfCritter cfg={cfg} />
      </Suspense>
    </GltfErrorBoundary>
  );
}

/** Falls back to the procedural model if the glTF 404s or fails to parse. */
class GltfErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("Critter glTF failed, using the procedural model:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
