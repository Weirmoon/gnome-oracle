"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Appearance } from "@/lib/persona";
import type { AvatarTier } from "./useAvatarCapability";
import { usePersonaMaterials, type PersonaMaterials } from "./parts/materials";
import { Hat, hasStaff } from "./parts/hats";
import { Torso } from "./parts/torsos";
import { Pattern } from "./parts/patterns";
import { Hair } from "./parts/hair";
import { FaceFeature } from "./parts/faceFeatures";
import { HeldItem } from "./parts/heldItems";
import { BackItem } from "./parts/backItems";
import { Accessory } from "./parts/accessories";
import {
  GROUND_Y,
  HEAD_R,
  HEAD_Y,
  HEM_Y,
  frontZ,
  headZ,
  makeRobeGeometry,
} from "./parts/body";
import type { PhaseTick } from "./animation/useOraclePhase";
import { PHASE_POSES, applyMood, type RigPose } from "./animation/poses";
import { getMouthOpen } from "./animation/lipSync";
import { readGesture } from "./animation/gestures";
import { flourishFor } from "./animation/flourish";
import type { ParticlesHandle } from "./Particles";

export interface RigRefs {
  root: THREE.Group | null;
  torso: THREE.Group | null;
  head: THREE.Group | null;
  jaw: THREE.Group | null;
  eyelidL: THREE.Mesh | null;
  eyelidR: THREE.Mesh | null;
  eyeL: THREE.Group | null;
  eyeR: THREE.Group | null;
  browL: THREE.Group | null;
  browR: THREE.Group | null;
  beard: THREE.Group | null;
  hat: THREE.Group | null;
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  handR: THREE.Group | null;
  backSlot: THREE.Group | null;
  staffOrb: THREE.Mesh | null;
}

const ARM_L_REST = 0.3;
const ARM_R_REST = -0.3;

/** Head-local rest height of the brow group (sits close over the eyes). */
const BROW_Y = 0.205;
/** Head-local eye centre. */
const EYE_Y = 0.07;
const EYE_X = 0.17;

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function lerpPose(cur: RigPose, target: RigPose, k: number): RigPose {
  return {
    headPitch: lerp(cur.headPitch, target.headPitch, k),
    headYaw: lerp(cur.headYaw, target.headYaw, k),
    headRoll: lerp(cur.headRoll, target.headRoll, k),
    brow: lerp(cur.brow, target.brow, k),
    eyeWide: lerp(cur.eyeWide, target.eyeWide, k),
    lean: lerp(cur.lean, target.lean, k),
    chinHand: lerp(cur.chinHand, target.chinHand, k),
    armRaise: lerp(cur.armRaise, target.armRaise, k),
    bobRate: lerp(cur.bobRate, target.bobRate, k),
    bobAmp: lerp(cur.bobAmp, target.bobAmp, k),
    blinkRate: lerp(cur.blinkRate, target.blinkRate, k),
    scale: lerp(cur.scale, target.scale, k),
  };
}

/**
 * One eye: white ball, violet iris, dark pupil and an unlit specular dot, plus
 * the lid that scales down over it. Sheet 01 shows a real iris + highlight —
 * a flat black oval reads as a hole at 280px, and merges with dark eyewear.
 */
function Eye({
  mats,
  lidRef,
}: {
  mats: PersonaMaterials;
  lidRef: (m: THREE.Mesh | null) => void;
}) {
  const z = headZ(EYE_Y, EYE_X);
  return (
    <group position={[0, 0, z - 0.06]}>
      <mesh material={mats.light} scale={[1, 1.12, 0.6]}>
        <sphereGeometry args={[0.105, 10, 8]} />
      </mesh>
      <mesh material={mats.iris} position={[0, 0, 0.055]} scale={[1, 1, 0.5]}>
        <sphereGeometry args={[0.068, 10, 8]} />
      </mesh>
      <mesh material={mats.dark} position={[0, 0, 0.076]} scale={[1, 1, 0.5]}>
        <sphereGeometry args={[0.036, 8, 6]} />
      </mesh>
      <mesh material={mats.glint} position={[-0.026, 0.032, 0.086]}>
        <sphereGeometry args={[0.019, 6, 5]} />
      </mesh>
      <mesh
        ref={lidRef}
        material={mats.skin}
        position={[0, 0.075, 0.03]}
        scale={[1.3, 0, 0.9]}
      >
        <sphereGeometry args={[0.105, 10, 6]} />
      </mesh>
    </group>
  );
}

/**
 * The procedural crystal gnome. Builds a rig of named nested groups from
 * `Appearance` and drives ALL animation from a single `useFrame`:
 *   phase machine → target pose → eased rig → idle wobble + lip-sync + gestures.
 */
export default function GnomeModel({
  appearance,
  tier,
  speaking,
  mood,
  phaseTick,
  particles,
}: {
  appearance: Appearance;
  tier: AvatarTier;
  speaking: boolean;
  mood?: string;
  phaseTick: (dtMs: number) => PhaseTick;
  particles: RefObject<ParticlesHandle | null>;
}) {
  const mats = usePersonaMaterials(appearance, tier);

  const rig = useRef<RigRefs>({
    root: null, torso: null, head: null, jaw: null,
    eyelidL: null, eyelidR: null, eyeL: null, eyeR: null,
    browL: null, browR: null, beard: null, hat: null,
    armL: null, armR: null, handR: null, backSlot: null, staffOrb: null,
  });
  const pose = useRef<RigPose>({ ...PHASE_POSES.idle });
  const flourish = useRef<{ kind: string; t: number } | null>(null);
  const popScale = tier === "low" ? 0.5 : 1;

  const staff = hasStaff(appearance);
  const heldHand: "L" | "R" = staff ? "L" : "R";
  const seg = tier === "low" ? 0.6 : 1;

  // Rounded, slightly wide head — an unsubdivided icosahedron silhouettes as a
  // hard hexagon with a pointed chin, which is nothing like the reference.
  const headGeo = useMemo(
    () => new THREE.SphereGeometry(HEAD_R, Math.round(14 * seg), Math.round(11 * seg)),
    [seg]
  );
  const earGeo = useMemo(() => new THREE.ConeGeometry(0.1, 0.26, 5), []);
  const noseGeo = useMemo(() => new THREE.SphereGeometry(0.088, 8, 7), []);
  const robeGeo = useMemo(() => makeRobeGeometry(), []);
  const beardGeo = useMemo(() => new THREE.ConeGeometry(0.38, 0.86, 9), []);
  const armGeo = useMemo(() => new THREE.CapsuleGeometry(0.078, 0.36, 2, 7), []);
  const handGeo = useMemo(() => new THREE.SphereGeometry(0.105, 8, 7), []);
  const cuffGeo = useMemo(() => new THREE.CylinderGeometry(0.095, 0.095, 0.07, 8), []);
  const legGeo = useMemo(() => new THREE.CylinderGeometry(0.1, 0.1, 0.24, 7), []);
  const bootGeo = useMemo(() => new THREE.SphereGeometry(0.135, 9, 7), []);
  const browGeo = useMemo(() => new THREE.BoxGeometry(0.19, 0.06, 0.07), []);
  const mouthGeo = useMemo(
    () => new THREE.TorusGeometry(0.088, 0.022, 5, 12, Math.PI * 0.8),
    []
  );
  const blushGeo = useMemo(() => new THREE.SphereGeometry(0.082, 9, 7), []);
  const orbGeo = useMemo(() => new THREE.IcosahedronGeometry(0.11, 0), []);
  const staffGeo = useMemo(() => new THREE.CylinderGeometry(0.032, 0.042, 1.55, 7), []);
  const hemGeo = useMemo(() => new THREE.TorusGeometry(0.452, 0.028, 5, 20), []);
  const gemGeo = useMemo(() => new THREE.OctahedronGeometry(0.075, 0), []);

  useEffect(() => {
    const geos = [
      headGeo, earGeo, noseGeo, robeGeo, beardGeo, armGeo, handGeo, cuffGeo,
      legGeo, bootGeo, browGeo, mouthGeo, blushGeo, orbGeo, staffGeo, hemGeo, gemGeo,
    ];
    return () => geos.forEach((g) => g.dispose());
  }, [
    headGeo, earGeo, noseGeo, robeGeo, beardGeo, armGeo, handGeo, cuffGeo,
    legGeo, bootGeo, browGeo, mouthGeo, blushGeo, orbGeo, staffGeo, hemGeo, gemGeo,
  ]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dtMs = Math.min(delta, 0.05) * 1000;
    const r = rig.current;

    // ---- phase machine ----
    const tick = phaseTick(dtMs);
    if (tick.justEntered === "answerBurst") {
      particles.current?.pop(Math.round(16 * popScale), appearance.accent, [0, 0.55, 0.45]);
    }
    if (tick.justEntered === "flourish") {
      const f = flourishFor(appearance);
      flourish.current = { kind: f.kind, t: 0 };
      particles.current?.pop(Math.round(f.particles * popScale), appearance.accent, f.origin);
    }
    if (flourish.current) {
      flourish.current.t += dtMs;
      if (tick.phase !== "flourish") flourish.current = null;
    }

    // ---- target pose (phase + mood) with gesture overlay ----
    const base = applyMood(PHASE_POSES[tick.phase], mood);
    const o = readGesture(dtMs);
    const target: RigPose = o ? { ...base } : base;
    if (o) {
      target.headPitch += o.headPitch;
      target.headRoll += o.headRoll;
      target.brow += o.brow;
      target.lean += o.lean;
      target.armRaise = Math.max(target.armRaise, o.armRaise);
    }
    const k = 1 - Math.pow(0.001, delta); // frame-rate independent ~fast ease
    pose.current = lerpPose(pose.current, target, Math.min(1, k));
    const p = pose.current;

    // ---- root: bob + burst scale pop + flourish hop ----
    let hop = 0;
    if (flourish.current) {
      const fp = Math.min(1, flourish.current.t / 900);
      hop = Math.sin(fp * Math.PI) * 0.12;
    }
    if (r.root) {
      r.root.position.y = Math.sin(t * 2 * p.bobRate) * 0.05 * p.bobAmp + hop;
      const sc = r.root.scale.x;
      r.root.scale.setScalar(lerp(sc, p.scale, Math.min(1, delta * 12)));
    }

    // ---- head ----
    if (r.head) {
      r.head.position.y = HEAD_Y - Math.sin(t * 2 * p.bobRate) * 0.012 * p.bobAmp;
      r.head.rotation.x = p.headPitch + Math.sin(t * 1.1) * 0.015;
      r.head.rotation.y = p.headYaw + Math.sin(t * 0.7) * 0.02;
      r.head.rotation.z = p.headRoll + Math.sin(t * 1.3) * 0.03;
    }
    if (r.torso) r.torso.rotation.x = p.lean;
    if (r.hat) {
      const flTip = flourish.current?.kind === "staff" ? Math.sin(Math.min(1, flourish.current.t / 700) * Math.PI) * -0.3 : 0;
      r.hat.rotation.z = Math.sin(t * 1.5) * 0.08 + flTip;
    }

    // ---- brows ----
    for (const brow of [r.browL, r.browR]) {
      if (!brow) continue;
      brow.position.y = BROW_Y + p.brow * 0.035;
      brow.rotation.z = (brow === r.browL ? -1 : 1) * Math.max(0, -p.brow) * 0.35;
    }

    // ---- eyes: widen / half-lid + blink ----
    const wide = 1 + Math.max(0, p.eyeWide) * 0.4;
    for (const eye of [r.eyeL, r.eyeR]) {
      if (eye) eye.scale.set(wide, wide, 1);
    }
    const rest = Math.min(0.7, Math.max(0, -p.eyeWide)); // sleepy → half closed
    const blink = Math.sin(t * (1.7 / Math.max(0.2, p.blinkRate))) > 0.965 ? 1 : 0;
    const lidTarget = Math.max(blink, rest);
    for (const lid of [r.eyelidL, r.eyelidR]) {
      if (lid) lid.scale.y = lerp(lid.scale.y, lidTarget, 0.4);
    }

    // ---- arms ----
    if (r.armL) {
      r.armL.rotation.z = ARM_L_REST + p.chinHand * 1.05;
      r.armL.rotation.x = p.chinHand * -0.7;
    }
    if (r.armR) {
      let raise = p.armRaise;
      if (flourish.current && flourish.current.kind !== "nod") {
        raise = Math.max(raise, Math.sin(Math.min(1, flourish.current.t / 800) * Math.PI));
      }
      r.armR.rotation.z = ARM_R_REST - raise * 1.25;
      r.armR.rotation.x = raise * -0.35;
    }
    if (r.handR && flourish.current?.kind === "spin") {
      r.handR.rotation.z = Math.min(1, flourish.current.t / 700) * Math.PI * 2;
    } else if (r.handR) {
      r.handR.rotation.z = lerp(r.handR.rotation.z, 0, 0.15);
    }

    // ---- mouth: lip-sync while speaking, else a thin smile line ----
    if (r.jaw) {
      const active = tick.phase === "speaking" || tick.phase === "answerBurst";
      const open = active ? getMouthOpen(t, speaking) : 0.12;
      r.jaw.scale.y = lerp(r.jaw.scale.y, 0.16 + open * 0.9, 0.4);
      r.jaw.scale.x = lerp(r.jaw.scale.x, 1 + open * 0.15, 0.3);
    }
    if (r.beard) r.beard.rotation.x = (r.jaw?.scale.y ?? 0.16) * 0.16;

    // ---- staff orb glow ----
    if (r.staffOrb) {
      const m = r.staffOrb.material as THREE.MeshStandardMaterial;
      const flare = flourish.current?.kind === "staff" ? Math.sin(Math.min(1, flourish.current.t / 600) * Math.PI) * 1.4 : 0;
      m.emissiveIntensity =
        (speaking ? 0.6 + Math.sin(t * 12) * 0.25 : 0.4 + Math.sin(t * 3) * 0.1) + flare;
    }
  });

  const set = <K extends keyof RigRefs>(k: K) => (v: RigRefs[K]) => {
    rig.current[k] = v;
  };

  const legTop = HEM_Y + 0.04;

  return (
    <group ref={set("root")} position={[0, 0, 0]}>
      <group ref={set("backSlot")} position={[0, -0.1, -0.24]}>
        <BackItem appearance={appearance} mats={mats} />
      </group>

      {/* Legs + boots below the tunic hem — the break that makes the
          silhouette read chibi instead of as a floor-length cone. */}
      {[-0.21, 0.21].map((x) => (
        <group key={x}>
          <mesh geometry={legGeo} material={mats.dark} position={[x, legTop - 0.12, 0]} />
          <mesh
            geometry={bootGeo}
            material={mats.dark}
            position={[x, GROUND_Y + 0.1, 0.05]}
            scale={[1, 0.72, 1.42]}
          />
        </group>
      ))}

      <group ref={set("torso")}>
        <mesh geometry={robeGeo} material={mats.robe} />
        {/* gold hem band + chest gem (sheet 01 trim) */}
        <mesh
          geometry={hemGeo}
          material={mats.accent}
          position={[0, HEM_Y + 0.06, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh geometry={gemGeo} material={mats.accent} position={[0, -0.3, frontZ(-0.3, 0.08)]} />
        <mesh material={mats.accent} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.4, 0.026, 5, 20]} />
        </mesh>

        <Torso appearance={appearance} mats={mats} />
        <Pattern appearance={appearance} mats={mats} />
        <Accessory appearance={appearance} mats={mats} />

        <group ref={set("armL")} position={[-0.46, -0.02, 0.16]} rotation={[0, 0, ARM_L_REST]}>
          <mesh geometry={armGeo} material={mats.robe} position={[0, -0.22, 0]} />
          <mesh geometry={cuffGeo} material={mats.accent} position={[0, -0.44, 0]} />
          <mesh geometry={handGeo} material={mats.skin} position={[0, -0.55, 0]} scale={[1, 0.92, 0.9]} />
          <group position={[0, -0.6, 0.06]}>
            {heldHand === "L" && <HeldItem appearance={appearance} mats={mats} />}
          </group>
        </group>
        <group ref={set("armR")} position={[0.46, -0.02, 0.16]} rotation={[0, 0, ARM_R_REST]}>
          <mesh geometry={armGeo} material={mats.robe} position={[0, -0.22, 0]} />
          <mesh geometry={cuffGeo} material={mats.accent} position={[0, -0.44, 0]} />
          <mesh geometry={handGeo} material={mats.skin} position={[0, -0.55, 0]} scale={[1, 0.92, 0.9]} />
          <group ref={set("handR")} position={[0, -0.6, 0.06]}>
            {heldHand === "R" && <HeldItem appearance={appearance} mats={mats} />}
            {staff && (
              <group position={[0.1, 0.24, 0.04]} rotation={[0, 0, -ARM_R_REST]}>
                <mesh geometry={staffGeo} material={mats.wood} />
                <mesh
                  ref={set("staffOrb")}
                  geometry={orbGeo}
                  material={mats.accent}
                  position={[0, 0.8, 0]}
                />
              </group>
            )}
          </group>
        </group>
      </group>

      <group ref={set("head")} position={[0, HEAD_Y, 0]}>
        <mesh geometry={headGeo} material={mats.skin} scale={[1.06, 1, 0.97]} />

        {/* pointed ears — present on every view of sheet 01 */}
        <mesh
          geometry={earGeo}
          material={mats.skin}
          position={[-0.45, 0.04, -0.02]}
          rotation={[0, 0, 1.05]}
        />
        <mesh
          geometry={earGeo}
          material={mats.skin}
          position={[0.45, 0.04, -0.02]}
          rotation={[0, 0, -1.05]}
        />

        <mesh geometry={noseGeo} material={mats.skin} position={[0, -0.03, headZ(-0.03) - 0.03]} />

        <group ref={set("eyeL")} position={[-EYE_X, EYE_Y, 0]}>
          <Eye mats={mats} lidRef={set("eyelidL")} />
        </group>
        <group ref={set("eyeR")} position={[EYE_X, EYE_Y, 0]}>
          <Eye mats={mats} lidRef={set("eyelidR")} />
        </group>

        <group ref={set("browL")} position={[-EYE_X, BROW_Y, 0]}>
          <mesh
            geometry={browGeo}
            material={mats.cloth}
            position={[0, 0, headZ(BROW_Y, EYE_X) - 0.03]}
            rotation={[0, 0, 0.1]}
          />
        </group>
        <group ref={set("browR")} position={[EYE_X, BROW_Y, 0]}>
          <mesh
            geometry={browGeo}
            material={mats.cloth}
            position={[0, 0, headZ(BROW_Y, EYE_X) - 0.03]}
            rotation={[0, 0, -0.1]}
          />
        </group>

        {/* rosy cheeks — matte rose, NOT the emissive accent (that read as rivets) */}
        <mesh
          geometry={blushGeo}
          material={mats.blush}
          position={[-0.29, -0.1, headZ(-0.1, 0.29) - 0.035]}
          scale={[0.92, 0.6, 0.3]}
        />
        <mesh
          geometry={blushGeo}
          material={mats.blush}
          position={[0.29, -0.1, headZ(-0.1, 0.29) - 0.035]}
          scale={[0.92, 0.6, 0.3]}
        />

        {/* mouth: a curved arc that opens downward under lip-sync */}
        <group ref={set("jaw")} position={[0, -0.14, headZ(-0.14) - 0.04]} scale={[1, 0.16, 1]}>
          <mesh geometry={mouthGeo} material={mats.dark} rotation={[0, 0, Math.PI * 1.1]} />
        </group>

        <FaceFeature appearance={appearance} mats={mats} />
        <Hair appearance={appearance} mats={mats} />

        {/* Beard sits PROUD of the chest. The old placement put its front face
            at z 0.255 against a robe of radius 0.44 — fully buried. */}
        <group ref={set("beard")} position={[0, -0.6, 0.3]} scale={[1, 1, 0.62]}>
          <mesh geometry={beardGeo} material={mats.cloth} rotation={[Math.PI, 0, 0]} />
        </group>

        <group ref={set("hat")} position={[0, 0.3, 0]}>
          <Hat appearance={appearance} mats={mats} />
        </group>
      </group>
    </group>
  );
}
