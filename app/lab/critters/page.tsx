"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import OracleCanvas from "@/components/OracleCanvas";
import { CRITTER_LIST } from "@/components/oracle/critters/catalog";
import { CritterModel } from "@/components/oracle/critters/models";

/**
 * Dev-only critter gallery. `/lab/critters` shows the 2D `drawCritter` sprite for
 * every catalog entry (parked mid-event); `/lab/critters?d=3` lays out every
 * static 3D `<CritterModel>` in ONE canvas (many `<Canvas>` elements blow the
 * browser's WebGL-context limit). Not linked from the app.
 */
function Gallery() {
  const threeD = useSearchParams().get("d") === "3";
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (threeD) {
    const cols = 4;
    const gap = 3.4;
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#241a33" }}>
        <Canvas orthographic camera={{ position: [0, 1.2, 12], zoom: 42 }}>
          <hemisphereLight args={["#dbe8ff", "#3b3054", 0.7]} />
          <directionalLight position={[-3, 6, 5]} intensity={1.4} />
          <directionalLight position={[4, 2, -3]} intensity={0.8} color="#ffdca8" />
          {CRITTER_LIST.map((c, i) => {
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
      {CRITTER_LIST.map((c) => (
        <figure key={c.id} style={{ margin: 0, width: 240, textAlign: "center" }}>
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
