"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Critter, CritterPath, CritterSide } from "./catalog";
import { CritterModel } from "./models";

/** Where a critter comes in from, per `side`. */
const ENTRY: Record<CritterSide, [number, number, number]> = {
  left: [-2.6, 0.7, 0.4],
  right: [2.6, 0.7, 0.4],
  top: [0.6, 2.6, 0.4],
  front: [0.2, -1.05, 1.9],
};

/** Where it settles while the gnome reacts, per `path`. */
const HOLD: Record<CritterPath, [number, number, number]> = {
  flit: [0.92, 0.86, 0.6],
  swoop: [0.86, 1.06, 0.5],
  walk: [1.02, -0.95, 0.6],
  drift: [0.95, 0.8, 0.5],
  burst: [1.05, -0.28, 0.6],
  descend: [1.0, -0.72, 0.5],
};

const ease = (k: number) => 1 - Math.pow(1 - k, 3);
const tmp = new THREE.Vector3();

/**
 * Mounts the active critter model and flies it enter -> hold -> exit, writing
 * its live local position into `posRef` so `GnomeModel` can aim at it and
 * `Particles.beam` can target it.
 *
 * Owns its own `useFrame`: this is scene motion independent of the gnome rig,
 * the same way `Particles` is.
 */
export default function CritterStage({
  critter,
  startedAt,
  posRef,
  reduced,
}: {
  critter: Critter;
  /** performance.now() when the event began. */
  startedAt: number;
  posRef: React.MutableRefObject<[number, number, number]>;
  /** Low tier / reduced motion — simpler paths, no wobble. */
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const from = useMemo(() => ENTRY[critter.side], [critter.side]);
  const hold = useMemo(() => HOLD[critter.path], [critter.path]);

  // Start where it enters, so the first frame never flashes at the origin.
  useEffect(() => {
    posRef.current = [...from] as [number, number, number];
    group.current?.position.set(from[0], from[1], from[2]);
  }, [from, posRef]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const el = (performance.now() - startedAt) / critter.durationMs;
    const t = state.clock.elapsedTime;

    const ENTER = 0.22;
    const EXIT = 0.78;

    if (el < ENTER) {
      const k = ease(el / ENTER);
      tmp.set(
        from[0] + (hold[0] - from[0]) * k,
        from[1] + (hold[1] - from[1]) * k,
        from[2] + (hold[2] - from[2]) * k
      );
    } else if (el < EXIT) {
      tmp.set(hold[0], hold[1], hold[2]);
    } else {
      const k = ease(Math.min(1, (el - EXIT) / (1 - EXIT)));
      tmp.set(
        hold[0] + (from[0] - hold[0]) * k,
        hold[1] + (from[1] - hold[1]) * k,
        hold[2] + (from[2] - hold[2]) * k
      );
    }

    // Per-path idle character on top of the travel.
    if (!reduced) {
      switch (critter.path) {
        case "flit":
          tmp.x += Math.sin(t * 6.1) * 0.16;
          tmp.y += Math.sin(t * 8.3) * 0.12;
          break;
        case "drift":
          tmp.x += Math.sin(t * 1.4) * 0.1;
          tmp.y += Math.sin(t * 1.9) * 0.08;
          break;
        case "swoop":
          tmp.y += Math.sin(t * 3.2) * 0.14;
          break;
        case "walk":
          tmp.y += Math.abs(Math.sin(t * 5)) * 0.03;
          break;
        case "burst":
          tmp.x += Math.sin(t * 11) * 0.05;
          break;
        case "descend":
          tmp.y += Math.sin(t * 2.2) * 0.03;
          break;
      }
    }

    g.position.copy(tmp);
    posRef.current[0] = tmp.x;
    posRef.current[1] = tmp.y;
    posRef.current[2] = tmp.z;

    // Face the gnome; ground critters stay upright.
    g.rotation.y = tmp.x > 0 ? -0.5 : 0.5;
    if (critter.path === "flit" || critter.path === "swoop") {
      g.rotation.z = Math.sin(t * 5) * 0.12;
    }
  });

  return (
    <group ref={group}>
      <CritterModel id={critter.id} tint={critter.tint} />
    </group>
  );
}
