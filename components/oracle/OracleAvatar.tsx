"use client";

import {
  Component,
  Suspense,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from "react";
import dynamic from "next/dynamic";
import OracleCanvas from "@/components/OracleCanvas";
import type { Appearance } from "@/lib/persona";
import { useAvatarCapability } from "./useAvatarCapability";
import { useCritterEvents, type CritterApi } from "./critters/useCritterEvents";

/**
 * Public avatar component. Owns the choice between the 2D `<OracleCanvas>`
 * (always available, cheap, SSR-safe) and the procedural 3D renderer
 * (`OracleAvatar3D`, lazy-loaded, WebGL). `app/page.tsx` imports THIS, never
 * `OracleCanvas` directly.
 *
 * The original `{ speaking, appearance, burst }` contract is preserved exactly;
 * every new prop is optional so the 2D path can ignore what it can't express.
 * `three` / `@react-three/fiber` live only in the lazily-imported
 * `OracleAvatar3D` chunk, so the initial page load never pays for them.
 *
 * The ambient-critter loop lives HERE, not in `OracleAvatar3D`, so both
 * renderers share one loop and one `summon` — critters now perform in 2D too.
 */

export type OracleQuality = "auto" | "high" | "low" | "2d" | "sprite";

export interface OracleAvatarProps {
  /** TTS or stream is producing output — drives mouth + orb pulse. */
  speaking: boolean;
  /** Persona look; when omitted the renderer uses its own default. */
  appearance?: Appearance;
  /** Bump to fire a one-shot sparkle pop (e.g. when an answer arrives). */
  burst?: number;

  // --- richer responding-animation signals (all optional) ---
  /** A request is in flight (fetch open / reader not done). */
  streaming?: boolean;
  /** Running answer text; drives gesture parsing + muted lip-sync cadence. */
  answerText?: string;
  /** Explicit "thinking" flag; derived from `streaming && !answerText` if omitted. */
  thinking?: boolean;
  /** Bump on a *successful* stream completion — triggers the finish flourish. */
  streamDone?: number;
  /** Persona mood (from page state) — maps to idle posture / tempo. */
  mood?: string;
  /** Rendering preference from settings. Default "auto". */
  quality?: OracleQuality;

  // --- ambient critters (both renderers) ---
  /** Ambient critter loop on. Manual `summon` still works when false. */
  crittersEnabled?: boolean;
  /** Populated with the critter controls so `page.tsx` can summon by slash command. */
  critterApiRef?: Ref<CritterApi>;
  /** Persona id + voice flag, needed to fetch and speak a critter quip. */
  characterId?: number;
  voiceOn?: boolean;
  /** Force-simplifies critter motion and disables the ambient loop. */
  reducedMotion?: boolean;
}

const OracleAvatar3D = dynamic(() => import("./OracleAvatar3D"), { ssr: false });

const LOW_TIER_INTERVAL_SCALE = 1.8;
const MOBILE_INTERVAL_SCALE = 1.6;

function isCoarsePointer(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
}

export default function OracleAvatar(props: OracleAvatarProps) {
  const { speaking, appearance, burst = 0, quality = "auto" } = props;
  const cap = useAvatarCapability(quality);
  const reduced = cap.tier === "low" || !!props.reducedMotion;

  const critters = useCritterEvents({
    enabled: props.crittersEnabled ?? false,
    isIdle: !props.streaming && !speaking,
    streaming: !!props.streaming,
    characterId: props.characterId,
    mood: props.mood,
    reduced,
    ambientOff: !!props.reducedMotion,
    // Weak devices and phones get the same roster, just further apart.
    intervalScale:
      (cap.tier === "low" ? LOW_TIER_INTERVAL_SCALE : 1) *
      (isCoarsePointer() ? MOBILE_INTERVAL_SCALE : 1),
    voiceOn: !!props.voiceOn,
  });

  useImperativeHandle(props.critterApiRef, () => critters.api, [critters.api]);

  const active = critters.active;
  const caption = critters.caption ? (
    <p className="critter-quip">
      <span aria-hidden="true">{active?.critter.emoji}</span> {critters.caption}
    </p>
  ) : null;

  const fallback2d = (
    <OracleCanvas
      speaking={speaking}
      appearance={appearance}
      burst={burst}
      critterRender={cap.mode === "sprite" ? "sprite" : "draw"}
      critter={
        active
          ? {
              id: active.critter.id,
              reaction: active.critter.reaction,
              side: active.critter.side,
              startedAt: active.startedAt,
              durationMs: active.critter.durationMs,
              reacting: active.reacting,
            }
          : null
      }
      reducedMotion={reduced}
    />
  );

  let renderer: ReactNode;
  if (!cap.ready || cap.mode === "2d" || cap.mode === "sprite") {
    renderer = fallback2d;
  } else {
    const thinking = props.thinking ?? (!!props.streaming && !props.answerText);
    renderer = (
      <ThreeErrorBoundary fallback={fallback2d}>
        <Suspense fallback={fallback2d}>
          <OracleAvatar3D
            {...props}
            thinking={thinking}
            tier={cap.tier}
            critters={critters}
          />
        </Suspense>
      </ThreeErrorBoundary>
    );
  }

  return (
    <div className="oraclewrap">
      {renderer}
      {caption}
    </div>
  );
}

class ThreeErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("OracleAvatar3D failed, falling back to 2D:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
