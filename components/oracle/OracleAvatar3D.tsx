"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { Appearance } from "@/lib/persona";
import type { AvatarTier } from "./useAvatarCapability";
import type { OracleAvatarProps } from "./OracleAvatar";
import GnomeModel from "./GnomeModel";
import Particles, { type ParticlesHandle } from "./Particles";
import { useOraclePhase } from "./animation/useOraclePhase";
import { noteAnswerText, noteSpeakingStart } from "./animation/lipSync";
import { feedGestureText, resetGestures } from "./animation/gestures";

const DEFAULT_APPEARANCE: Appearance = {
  hat: "wizard",
  hatColor: "#3a2470",
  robeColor: "#5a3aa0",
  beardColor: "#eef0f5",
  skin: "#f3d3b3",
  accent: "#ffd66b",
};

type Props = OracleAvatarProps & { tier: AvatarTier };

/**
 * Procedural 3D oracle — a faceted "crystal / gemstone" gnome, re-skinned per
 * persona via material colours. No art assets. Lazy-loaded by `OracleAvatar`
 * (this module is the only place `three` / `@react-three/fiber` are imported).
 *
 * Owns the render surface + the responding-animation wiring: the phase machine,
 * lip-sync text/boundary feed, gesture-cue feed, and the particle system. All
 * continuous motion happens inside GnomeModel's single `useFrame`.
 */
export default function OracleAvatar3D(props: Props) {
  const { tier, speaking } = props;
  const appearance = props.appearance ?? DEFAULT_APPEARANCE;
  const answerText = props.answerText ?? "";

  const wrapRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticlesHandle | null>(null);
  const [active, setActive] = useState(true);

  const phase = useOraclePhase({
    streaming: props.streaming,
    speaking,
    answerText,
    burst: props.burst,
    streamDone: props.streamDone,
  });

  // Feed lip-sync + gesture parser as the answer streams in.
  useEffect(() => {
    noteAnswerText(answerText);
    feedGestureText(answerText);
    if (answerText === "") resetGestures();
  }, [answerText]);

  // Reset per-answer state when speaking begins.
  const wasSpeaking = useRef(false);
  useEffect(() => {
    if (speaking && !wasSpeaking.current) {
      noteSpeakingStart();
      resetGestures();
    }
    wasSpeaking.current = speaking;
  }, [speaking]);

  // Pause the render loop when the tab is hidden or the stage scrolls offscreen.
  useEffect(() => {
    const sync = (visible: boolean) => setActive(visible && !document.hidden);
    const onVis = () => sync(true);
    document.addEventListener("visibilitychange", onVis);

    let io: IntersectionObserver | undefined;
    const el = wrapRef.current;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver(([entry]) => sync(entry.isIntersecting), { threshold: 0.01 });
      io.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="oracle3d" aria-hidden="true">
      <Canvas
        orthographic
        // Framing: at zoom 92 / lookAt 0.18 the wizard hat tip (world y 1.85)
        // projected 0.27 units past the top edge while 0.24 went unused at the
        // bottom. zoom 82 / lookAt 0.42 gives a visible band of y -1.30..2.14,
        // which holds the tallest hat and the boots with even margins.
        camera={{ position: [0, 1.15, 6], zoom: 82, near: 0.1, far: 20 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.42, 0)}
        dpr={tier === "low" ? 1 : [1, 1.75]}
        gl={{ antialias: tier !== "low", alpha: true, powerPreference: "high-performance" }}
        shadows={false}
        frameloop={active ? "always" : "never"}
      >
        <LightRig accent={appearance.accent} />
        <GnomeModel
          appearance={appearance}
          tier={tier}
          speaking={speaking}
          mood={props.mood}
          phaseTick={phase.tick}
          particles={particlesRef}
        />
        <Particles ref={particlesRef} />
        <GroundShadow tier={tier} />
      </Canvas>
    </div>
  );
}

function LightRig({ accent }: { accent: string }) {
  return (
    <>
      {/* Lower ambient + a stronger key gives the flat-shaded facets real value
          steps between neighbours — that contrast IS the crystal read now that
          the material no longer pretends to be transmissive. */}
      <hemisphereLight args={["#dbe8ff", "#3b3054", 0.45]} />
      <directionalLight position={[-3, 4, 5]} intensity={1.5} />
      <directionalLight position={[1.5, 0.5, 6]} intensity={0.32} color="#bcd2ff" />
      <directionalLight position={[3.5, 2, -3]} intensity={1.15} color={accent} />
      <directionalLight position={[-2, -1, -3]} intensity={0.35} color={accent} />
    </>
  );
}

function GroundShadow({ tier }: { tier: AvatarTier }) {
  const geo = useMemo(() => new THREE.CircleGeometry(0.95, tier === "low" ? 16 : 40), [tier]);
  const tex = useMemo(() => radialShadowTexture(), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    [tex]
  );
  useEffect(
    () => () => {
      geo.dispose();
      tex.dispose();
      mat.dispose();
    },
    [geo, tex, mat]
  );
  return (
    <mesh geometry={geo} material={mat} position={[0, -1.14, 0]} rotation={[-Math.PI / 2, 0, 0]} />
  );
}

/** Procedurally-generated soft round shadow — transparent edge, ~40% black core. */
function radialShadowTexture(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(0.6, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}
