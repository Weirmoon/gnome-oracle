// Target poses per phase + per mood. Pure numbers — consumed by GnomeModel's
// useFrame, which lerps the live rig toward the active pose.

import type { Phase } from "./stateMachine";

export interface RigPose {
  /** head rotation.x — positive = chin down, negative = look up. */
  headPitch: number;
  /** head rotation.y — look left/right. */
  headYaw: number;
  /** head rotation.z — tilt. */
  headRoll: number;
  /** -1 furrow … 0 neutral … +1 raised. */
  brow: number;
  /** extra eye openness 0…1 (widen). */
  eyeWide: number;
  /** torso rotation.x — forward lean. */
  lean: number;
  /** 0…1 — left hand drawn up toward the chin (thinking). */
  chinHand: number;
  /** 0…1 — right arm/staff raised (emphasis / flourish). */
  armRaise: number;
  /** bob frequency multiplier. */
  bobRate: number;
  /** bob amplitude multiplier. */
  bobAmp: number;
  /** blink interval multiplier (higher = blinks less often). */
  blinkRate: number;
  /** target uniform body scale (answerBurst pops this). */
  scale: number;
}

const BASE: RigPose = {
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  brow: 0,
  eyeWide: 0,
  lean: 0,
  chinHand: 0,
  armRaise: 0,
  bobRate: 1,
  bobAmp: 1,
  blinkRate: 1,
  scale: 1,
};

export const PHASE_POSES: Record<Phase, RigPose> = {
  idle: BASE,
  thinking: {
    ...BASE,
    headPitch: -0.16,
    headYaw: 0.14,
    headRoll: 0.08,
    brow: -0.35,
    lean: -0.05,
    chinHand: 1,
    bobRate: 0.6,
    bobAmp: 0.7,
  },
  answerBurst: {
    ...BASE,
    headPitch: -0.05,
    brow: 0.8,
    eyeWide: 1,
    lean: 0.14,
    bobAmp: 1.3,
    scale: 1.07,
  },
  speaking: {
    ...BASE,
    lean: 0.09,
    brow: 0.15,
    eyeWide: 0.15,
    bobRate: 1.15,
  },
  flourish: {
    ...BASE,
    headPitch: 0.06,
    brow: 0.5,
    eyeWide: 0.3,
    armRaise: 1,
    bobAmp: 1.2,
  },
};

export interface MoodMod {
  headPitch?: number;
  headRoll?: number;
  brow?: number;
  eyeWide?: number;
  lean?: number;
  bobRate?: number;
  bobAmp?: number;
  blinkRate?: number;
}

export const MOOD_MODS: Record<string, MoodMod> = {
  default: {},
  excited: { bobRate: 1.7, bobAmp: 1.5, eyeWide: 0.4, blinkRate: 0.7, brow: 0.25 },
  grumpy: { headPitch: 0.12, brow: -0.8, lean: -0.06, bobRate: 0.7, bobAmp: 0.7 },
  wise: { headPitch: -0.05, eyeWide: -0.3, bobRate: 0.55, bobAmp: 0.8, blinkRate: 1.4 },
  sleepy: { headPitch: 0.2, eyeWide: -0.55, bobRate: 0.5, bobAmp: 0.6, blinkRate: 0.5 },
  dramatic: { headRoll: 0.06, bobAmp: 1.35, bobRate: 0.9 },
  mystical: { headRoll: 0.05, bobAmp: 1.3, bobRate: 0.85, eyeWide: 0.2 },
};

/** Fold a mood's modifiers onto a base pose. Missing moods → unchanged. */
export function applyMood(pose: RigPose, mood: string | undefined): RigPose {
  const m = MOOD_MODS[mood ?? "default"];
  if (!m) return pose;
  return {
    ...pose,
    headPitch: pose.headPitch + (m.headPitch ?? 0),
    headRoll: pose.headRoll + (m.headRoll ?? 0),
    brow: pose.brow + (m.brow ?? 0),
    eyeWide: pose.eyeWide + (m.eyeWide ?? 0),
    lean: pose.lean + (m.lean ?? 0),
    bobRate: pose.bobRate * (m.bobRate ?? 1),
    bobAmp: pose.bobAmp * (m.bobAmp ?? 1),
    blinkRate: pose.blinkRate * (m.blinkRate ?? 1),
  };
}
