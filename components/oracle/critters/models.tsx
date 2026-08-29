"use client";

import * as THREE from "three";
import type { CritterId } from "./catalog";

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
const DEER_COAT = soft("#c2a37a", { roughness: 0.85 });
const DEER_DK = soft("#8a6a48", { roughness: 0.85 });
const TOAD_BODY = soft("#7b9a52", { roughness: 0.9 });
const TOAD_DK = soft("#5d7a3d", { roughness: 0.9 });
const SNAIL_BODY = soft("#e4cba6", { roughness: 0.85 });
const SNAIL_SHELL = soft("#c98a3f", { roughness: 0.55 });
const DRAGON_BODY = soft("#c9503a", { roughness: 0.7 });
const DRAGON_BELLY = soft("#e8a06a", { roughness: 0.8 });
const DRAGON_HORN = soft("#f0e0c0", { roughness: 0.6 });
const FAIRY_SKIN = soft("#f6d9b0", { roughness: 0.7 });
const LEAF = soft("#9aa86a", { roughness: 0.9 });

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

/** Dragon — pot-bellied, stubby wings, smoking nostrils. Ref: C06 / C13. */
function Dragon() {
  return (
    <group scale={0.62}>
      <mesh geometry={ball} material={DRAGON_BODY} scale={[0.62, 0.52, 0.7]} />
      <mesh geometry={ball} material={DRAGON_BELLY} position={[0, -0.12, 0.28]} scale={[0.42, 0.34, 0.42]} />
      <mesh geometry={ball} material={DRAGON_BODY} position={[0, 0.5, 0.42]} scale={[0.4, 0.36, 0.44]} />
      <mesh geometry={cone} material={DRAGON_BODY} position={[0, 0.42, 0.78]} rotation={[1.5, 0, 0]} scale={[0.24, 0.3, 0.2]} />
      <Eyes x={0.18} y={0.6} z={0.74} r={0.11} pupil={0.06} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cone} material={DRAGON_HORN}
          position={[s * 0.2, 0.78, 0.3]} rotation={[-0.4, 0, -s * 0.3]} scale={[0.07, 0.24, 0.07]} />
      ))}
      {/* stubby wings */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={wingGeo} material={DRAGON_BELLY}
          position={[s * 0.56, 0.34, -0.16]} rotation={[Math.PI / 2, 0, s * 0.8]}
          scale={[0.46, 0.14, 0.56]} />
      ))}
      {[-1, 1].map((s) =>
        [0.34, -0.34].map((z, i) => (
          <mesh key={`${s}-${i}`} geometry={capsule} material={DRAGON_BODY}
            position={[s * 0.42, -0.5, z]} scale={[0.14, 0.14, 0.14]} />
        ))
      )}
      <mesh geometry={cone} material={DRAGON_BODY} position={[0, -0.06, -0.78]} rotation={[-1.3, 0, 0]} scale={[0.16, 0.66, 0.16]} />
    </group>
  );
}

/** Deer — slender, oversized ears, antler nubs. Ref: C06 / C13. */
function Deer() {
  return (
    <group scale={0.72}>
      <mesh geometry={capsule} material={DEER_COAT} rotation={[0, 0, Math.PI / 2]} scale={[0.3, 0.32, 0.3]} />
      <mesh geometry={capsule} material={DEER_COAT} position={[0.26, 0.42, 0]} rotation={[0, 0, -0.5]} scale={[0.14, 0.22, 0.14]} />
      <mesh geometry={ball} material={DEER_COAT} position={[0.44, 0.72, 0]} scale={[0.21, 0.19, 0.27]} />
      <mesh geometry={ball} material={DEER_DK} position={[0.62, 0.66, 0]} scale={0.09} />
      <Eyes x={0.02} y={0.76} z={0.18} r={0.07} pupil={0.05} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cone} material={DEER_DK}
          position={[0.36, 0.88, s * 0.16]} rotation={[s * 0.6, 0, -0.2]} scale={[0.09, 0.26, 0.05]} />
      ))}
      {[-1, 1].map((s) =>
        [0.3, -0.3].map((x, i) => (
          <mesh key={`${s}-${i}`} geometry={capsule} material={DEER_DK}
            position={[x, -0.5, s * 0.16]} scale={[0.055, 0.24, 0.055]} />
        ))
      )}
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

/** Render the model for a critter id. */
export function CritterModel({ id, tint }: { id: CritterId; tint: string }) {
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
    default: return null;
  }
}
