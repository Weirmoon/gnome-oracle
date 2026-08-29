"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CritterModelCfg } from "./critterModels";

/**
 * Renders an authored glTF critter from `public/critters/`.
 *
 * `useLoader` caches the parsed glTF by URL, so repeated summons of the same
 * critter don't re-download or re-parse. The scene graph is cloned per mount
 * (geometry + materials stay shared references, so this is cheap) which keeps
 * the loop/animation state isolated and lets `<primitive>` detach cleanly on
 * unmount.
 *
 * Suspends while loading and throws on a 404 / parse error — `CritterModel`
 * wraps this in Suspense + an error boundary that falls back to the procedural
 * model, so a missing or broken file degrades gracefully.
 */
export function GltfCritter({ cfg }: { cfg: CritterModelCfg }) {
  const gltf = useLoader(GLTFLoader, `/critters/${cfg.file}`);

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
    return clone;
  }, [gltf]);

  const mixer = useMemo(
    () => (cfg.clip && gltf.animations.length ? new THREE.AnimationMixer(scene) : null),
    [cfg.clip, gltf.animations.length, scene]
  );

  useEffect(() => {
    if (!mixer || !cfg.clip) return;
    const clip = THREE.AnimationClip.findByName(gltf.animations, cfg.clip);
    if (clip) mixer.clipAction(clip).play();
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, cfg.clip, gltf.animations]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    mixer?.update(dt);
  });

  return (
    <group
      ref={groupRef}
      scale={cfg.scale}
      position={[0, cfg.y ?? 0, 0]}
      rotation={[0, cfg.yaw ?? 0, 0]}
    >
      <primitive object={scene} />
    </group>
  );
}
