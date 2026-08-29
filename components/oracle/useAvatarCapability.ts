"use client";

import { useEffect, useState } from "react";
import type { OracleQuality } from "./OracleAvatar";

export type AvatarMode = "2d" | "3d";
export type AvatarTier = "high" | "low";

export interface AvatarCapability {
  mode: AvatarMode;
  tier: AvatarTier;
  /** True once the client-side probe has run; before that we render 2D (SSR-safe). */
  ready: boolean;
}

function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isWeakPhone(): boolean {
  if (typeof navigator === "undefined" || typeof matchMedia === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof mem === "number" && mem < 4 && matchMedia("(pointer: coarse)").matches;
}

function isCoarsePointer(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
}

/**
 * Decide 2D vs 3D from the user's quality preference + device capability.
 * Re-evaluates when the OS "reduce motion" setting is toggled live.
 */
export function useAvatarCapability(quality: OracleQuality = "auto"): AvatarCapability {
  const [cap, setCap] = useState<AvatarCapability>({ mode: "2d", tier: "high", ready: false });

  useEffect(() => {
    function evaluate(): AvatarCapability {
      if (quality === "2d") return { mode: "2d", tier: "low", ready: true };

      const webgl = hasWebGL();
      if (!webgl) return { mode: "2d", tier: "low", ready: true };

      if (quality === "high" || quality === "low") {
        return { mode: "3d", tier: quality, ready: true };
      }

      // quality === "auto"
      if (prefersReducedMotion() || isWeakPhone()) {
        return { mode: "2d", tier: "low", ready: true };
      }
      return { mode: "3d", tier: isCoarsePointer() ? "low" : "high", ready: true };
    }

    setCap(evaluate());

    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setCap(evaluate());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [quality]);

  return cap;
}
