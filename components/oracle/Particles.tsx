"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface ParticlesHandle {
  /** Spawn `n` sparkles bursting from local point `origin` in `color`. */
  pop: (n: number, color: string, origin?: [number, number, number]) => void;
  /**
   * Spawn `n` shards travelling `from` -> `to` as a spell-bolt stream, plus a
   * small burst where they land. Reuses the same fixed pool as `pop`.
   */
  beam: (
    from: [number, number, number],
    to: [number, number, number],
    color: string,
    n?: number
  ) => void;
}

const MAX = 64;

interface P {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  spin: number;
  size: number;
  /** Bolts fly straight at a target; sparkles arc under gravity. */
  gravity: number;
  drag: number;
}

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * One InstancedMesh sparkle system. Faceted little shards (crystal theme),
 * additive-blended. `pop()` claims free slots from a fixed pool.
 */
const Particles = forwardRef<ParticlesHandle>(function Particles(_props, ref) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.05, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  const pool = useRef<P[]>(
    Array.from({ length: MAX }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      max: 1,
      spin: 0,
      size: 1,
      gravity: 2.4,
      drag: 1.5,
    }))
  );

  /** Pending impact-burst timers, cleared on unmount so none fire after teardown. */
  const timers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  /** Burst `n` sparkles from `origin`. Shared by pop() and beam()'s impact. */
  const spawnPop = useCallback((n: number, color: string, origin: [number, number, number]) => {
    tmpColor.set(color);
    let spawned = 0;
    for (const p of pool.current.values()) {
      if (spawned >= n) break;
      if (p.active) continue;
      p.active = true;
      p.pos.set(
        origin[0] + (Math.random() - 0.5) * 0.25,
        origin[1] + (Math.random() - 0.5) * 0.25,
        origin[2] + (Math.random() - 0.5) * 0.2
      );
      const a = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2.2;
      p.vel.set(Math.cos(a) * speed, Math.sin(a) * speed + 0.6, (Math.random() - 0.5) * speed);
      p.life = 0;
      p.max = 0.5 + Math.random() * 0.7;
      p.spin = (Math.random() - 0.5) * 12;
      p.size = 0.7 + Math.random() * 1.1;
      p.gravity = 2.4;
      p.drag = 1.5;
      if (mesh.current) mesh.current.setColorAt(pool.current.indexOf(p), tmpColor);
      spawned++;
    }
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, []);

  useImperativeHandle(ref, () => ({
    pop(n, color, origin = [0, 0.4, 0]) {
      spawnPop(n, color, origin);
    },

    beam(from, to, color, n = 10) {
      tmpColor.set(color);
      const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      const dist = Math.max(0.001, dir.length());
      dir.divideScalar(dist);
      const travel = 0.16 + dist * 0.09; // seconds for a bolt to arrive

      let spawned = 0;
      for (const p of pool.current.values()) {
        if (spawned >= n) break;
        if (p.active) continue;
        p.active = true;
        // Stagger along the path so they read as a stream, not a clump.
        const lead = (spawned / Math.max(1, n)) * 0.35;
        p.pos.set(
          from[0] + dir.x * lead * dist + (Math.random() - 0.5) * 0.08,
          from[1] + dir.y * lead * dist + (Math.random() - 0.5) * 0.08,
          from[2] + dir.z * lead * dist + (Math.random() - 0.5) * 0.06
        );
        const speed = (dist * (1 - lead)) / travel;
        p.vel.set(
          dir.x * speed + (Math.random() - 0.5) * 0.5,
          dir.y * speed + (Math.random() - 0.5) * 0.5,
          dir.z * speed + (Math.random() - 0.5) * 0.4
        );
        p.life = 0;
        p.max = travel;
        p.spin = (Math.random() - 0.5) * 18;
        p.size = 0.8 + Math.random() * 0.6;
        p.gravity = 0;
        p.drag = 0;
        if (mesh.current) mesh.current.setColorAt(pool.current.indexOf(p), tmpColor);
        spawned++;
      }
      if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;

      // Impact burst, timed to land with the bolts.
      const at = window.setTimeout(() => {
        timers.current.delete(at);
        spawnPop(4, color, to);
      }, travel * 1000);
      timers.current.add(at);
    },
  }), [spawnPop]);

  useFrame((_state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    let anyActive = false;
    pool.current.forEach((p, i) => {
      if (!p.active) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -999, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        return;
      }
      anyActive = true;
      p.life += dt;
      if (p.life >= p.max) {
        p.active = false;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        return;
      }
      p.vel.y -= p.gravity * dt;
      if (p.drag) p.vel.multiplyScalar(1 - p.drag * dt);
      p.pos.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.max;
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.life * p.spin, p.life * p.spin * 0.7, 0);
      dummy.scale.setScalar(p.size * k);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.visible = anyActive;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, mat, MAX]} frustumCulled={false} visible={false} />
  );
});

export default Particles;
