"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import OracleCanvas, { drawCritter } from "@/components/OracleCanvas";
import { CRITTER_LIST } from "@/components/oracle/critters/catalog";
import { CritterModel } from "@/components/oracle/critters/models";
import type { CritterId } from "@/components/oracle/critters/catalog";

/**
 * Dev-only critter gallery.
 *   /lab/critters          — the 2D sprite in-scene (parked mid-event)
 *   /lab/critters?sprite   — just `drawCritter`, blown up 5x, no gnome
 *   /lab/critters?d=3      — every 3D `<CritterModel>` in one canvas
 *   &only=fox,owl          — filter to specific ids
 * Not linked from the app.
 */

function SpriteCell({ id }: { id: CritterId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.translate(c.width / 2 - 12, c.height / 2 + 34);
      ctx.scale(3.6, 3.6);
      drawCritter(ctx, id, (now - start) / 1000);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} width={240} height={240} style={{ background: "#2f2440", borderRadius: 8 }} />;
}

function Gallery() {
  const q = useSearchParams();
  const mode = q.get("d") === "3" ? "3d" : q.get("sprite") != null ? "sprite" : "scene";
  const only = q.get("only");
  const list = only ? CRITTER_LIST.filter((c) => only.split(",").includes(c.id)) : CRITTER_LIST;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (mode === "3d") {
    const cols = 4;
    const gap = 3.4;
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#241a33" }}>
        <Canvas orthographic camera={{ position: [0, 1.2, 12], zoom: 42 }}>
          <hemisphereLight args={["#dbe8ff", "#3b3054", 0.7]} />
          <directionalLight position={[-3, 6, 5]} intensity={1.4} />
          <directionalLight position={[4, 2, -3]} intensity={0.8} color="#ffdca8" />
          {list.map((c, i) => {
            const x = (i % cols) * gap - ((cols - 1) * gap) / 2;
            const y = -Math.floor(i / cols) * 2.6 + 3;
            return (
              <group key={c.id} position={[x, y, 0]}>
                <CritterModel id={c.id} tint={c.tint} />
              </group>
            );
          })}
        </Canvas>
      </div>
    );
  }

  return (
    <main style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 6, background: "#241a33" }}>
      {list.map((c) => (
        <figure key={c.id} style={{ margin: 0, width: 240, textAlign: "center" }}>
          {mode === "sprite" ? (
            <SpriteCell id={c.id} />
          ) : (
            <div className="panel stage" style={{ width: 240, height: 240 }}>
              <OracleCanvas
                speaking={false}
                critter={{
                  id: c.id,
                  reaction: c.reaction,
                  side: c.side,
                  startedAt: now - 4_000_000,
                  durationMs: 9_000_000,
                  reacting: true,
                }}
              />
            </div>
          )}
          <figcaption style={{ fontSize: 11, opacity: 0.75, color: "#e6dcff" }}>
            {c.emoji} {c.id} · {c.side}/{c.reaction}
          </figcaption>
        </figure>
      ))}
    </main>
  );
}

export default function CritterGalleryPage() {
  return (
    <Suspense fallback={null}>
      <Gallery />
    </Suspense>
  );
}
