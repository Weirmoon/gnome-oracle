"use client";

import OracleCanvas from "@/components/OracleCanvas";
import { CRITTER_LIST } from "@/components/oracle/critters/catalog";

/**
 * Dev-only 2D critter gallery. Renders `<OracleCanvas>` once per catalog entry
 * with that critter forced active (held mid-event), so every `drawCritter` case
 * can be eyeballed at once. Not linked from the app.
 *
 *   /lab/critters
 */
export default function CritterGallery() {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return (
    <main style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 6, background: "#241a33" }}>
      {CRITTER_LIST.map((c) => (
        <figure key={c.id} style={{ margin: 0, width: 280, textAlign: "center" }}>
          <div className="panel stage" style={{ width: 280, height: 280 }}>
            <div>
              <OracleCanvas
                speaking={false}
                critter={{
                  id: c.id,
                  reaction: c.reaction,
                  side: c.side,
                  // Huge duration + back-dated start parks the event in its hold
                  // beat indefinitely so the sprite just sits there.
                  startedAt: now - 4_000_000,
                  durationMs: 9_000_000,
                  reacting: true,
                }}
              />
            </div>
          </div>
          <figcaption style={{ fontSize: 11, opacity: 0.75, color: "#e6dcff" }}>
            {c.emoji} {c.id} · {c.side}/{c.reaction}
          </figcaption>
        </figure>
      ))}
    </main>
  );
}
