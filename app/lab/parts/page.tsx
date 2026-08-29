"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OracleAvatar } from "@/components/oracle";
import type { Appearance } from "@/lib/persona";

/**
 * Dev-only part gallery.
 *
 * Renders the 3D avatar with an `Appearance` taken straight from the query
 * string, so every enum value can be inspected against its reference sheet —
 * including the ones no seeded persona happens to use. Not linked from the app;
 * it exists so the avatar work is reviewable and repeatable.
 *
 *   /lab/parts?hat=cowboy&torsoStyle=pirate-coat&heldItem=flask
 */
function Gallery() {
  const q = useSearchParams();
  const get = <T,>(k: string, def: T) => (q.get(k) as T | null) ?? def;

  const appearance: Appearance = {
    hat: get("hat", "wizard"),
    hatColor: get("hatColor", "#3a2470"),
    robeColor: get("robeColor", "#5a3aa0"),
    beardColor: get("beardColor", "#eef0f5"),
    skin: get("skin", "#f3d3b3"),
    accent: get("accent", "#ffd66b"),
    accessory: get("accessory", undefined),
    hair: get("hair", undefined),
    faceFeature: get("faceFeature", undefined),
    torsoStyle: get("torsoStyle", undefined),
    backItem: get("backItem", undefined),
    heldItem: get("heldItem", undefined),
    pattern: get("pattern", undefined),
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 8, justifyItems: "center" }}>
      <div className="panel stage" style={{ width: 280 }}>
        <OracleAvatar speaking={false} appearance={appearance} quality="high" />
      </div>
      <code style={{ fontSize: 11, opacity: 0.7 }}>{q.toString()}</code>
    </main>
  );
}

export default function PartsGalleryPage() {
  return (
    <Suspense fallback={null}>
      <Gallery />
    </Suspense>
  );
}
