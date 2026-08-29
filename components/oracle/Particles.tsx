"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface ParticlesHandle {
  /** Spawn `n` sparkles bursting from local point `origin` in `color`. */
  pop: (n: number, color: string, origin?: [number, number, number]) => void;
}

const MAX = 48;

interface P {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  spin: number;
  size: number;
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
    }))
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useImperativeHandle(ref, () => ({
    pop(n, color, origin = [0, 0.4, 0]) {
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
        if (mesh.current) mesh.current.setColorAt(pool.current.indexOf(p), tmpColor);
        spawned++;
      }
      if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    },
  }));

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
      p.vel.y -= 2.4 * dt; // gravity
      p.vel.multiplyScalar(1 - 1.5 * dt); // drag
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
