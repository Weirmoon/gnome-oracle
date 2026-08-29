"use client";

import { useMemo } from "react";
import * as THREE from "three";

/** Flat 5-point star shape geometry, radius `r`, centred on the origin (XY plane). */
export function makeStarGeometry(r: number, inner = 0.45): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export function Star({
  r = 0.1,
  material,
  position,
  rotation,
}: {
  r?: number;
  material: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const geo = useMemo(() => makeStarGeometry(r), [r]);
  return <mesh geometry={geo} material={material} position={position} rotation={rotation} />;
}

/**
 * A faceted gem: an octahedron/icosahedron scaled to `size`. Cheap stand-in for
 * "a crystal chunk" used all over the costume set.
 */
export function Gem({
  size = [0.3, 0.4, 0.3],
  detail = 0,
  kind = "octa",
  material,
  position,
  rotation,
}: {
  size?: [number, number, number];
  detail?: number;
  kind?: "octa" | "icosa";
  material: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh material={material} position={position} rotation={rotation} scale={size}>
      {kind === "octa" ? (
        <octahedronGeometry args={[0.5, detail]} />
      ) : (
        <icosahedronGeometry args={[0.5, detail]} />
      )}
    </mesh>
  );
}
