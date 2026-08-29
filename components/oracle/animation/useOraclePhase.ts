"use client";

import { useRef } from "react";
import {
  initPhaseState,
  stepPhase,
  type Phase,
  type PhaseInput,
  type PhaseState,
} from "./stateMachine";

export interface PhaseInputProps {
  streaming?: boolean;
  speaking: boolean;
  answerText?: string;
  burst?: number;
  streamDone?: number;
}

export interface PhaseTick {
  phase: Phase;
  elapsedMs: number;
  /** the phase we just transitioned INTO this tick, else null. */
  justEntered: Phase | null;
}

/**
 * Bridges React props ↔ the pure phase machine. Call `tick(dtMs)` once per frame
 * from the avatar's single `useFrame`; it reads the latest props (captured on
 * render, no extra re-renders) and advances the machine.
 */
export function useOraclePhase(props: PhaseInputProps): { tick: (dtMs: number) => PhaseTick } {
  const stateRef = useRef<PhaseState>(initPhaseState());
  const inputRef = useRef<PhaseInput>({
    streaming: false,
    speaking: false,
    hasAnswer: false,
    burst: 0,
    streamDone: 0,
  });

  // Refresh the input snapshot every render (safe: plain ref write, read in rAF).
  inputRef.current = {
    streaming: !!props.streaming,
    speaking: props.speaking,
    hasAnswer: !!props.answerText && props.answerText.length > 0,
    burst: props.burst ?? 0,
    streamDone: props.streamDone ?? 0,
  };

  const tickRef = useRef((dtMs: number): PhaseTick => {
    const before = stateRef.current.phase;
    const next = stepPhase(stateRef.current, inputRef.current, dtMs);
    stateRef.current = next;
    return {
      phase: next.phase,
      elapsedMs: next.elapsedMs,
      justEntered: next.phase !== before ? next.phase : null,
    };
  });

  return { tick: tickRef.current };
}
