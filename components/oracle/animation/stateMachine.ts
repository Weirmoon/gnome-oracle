// Pure phase machine for the oracle's "responding" behaviour. No React, no
// three — just numbers, so it is trivial to reason about and test.
//
//   idle → thinking → answerBurst → speaking → flourish → idle
//
// Continuous motion (bob, blink, lip-sync) is NOT driven from here; this only
// decides which discrete phase the rig should be posing toward.

export type Phase = "idle" | "thinking" | "answerBurst" | "speaking" | "flourish";

export interface PhaseInput {
  /** A request is in flight (fetch open / reader not done). */
  streaming: boolean;
  /** TTS or the stream is actively producing output. */
  speaking: boolean;
  /** The running answer text is non-empty. */
  hasAnswer: boolean;
  /** Monotonic counter — bumped on the first streamed chunk. */
  burst: number;
  /** Monotonic counter — bumped once a stream completes successfully. */
  streamDone: number;
}

export interface PhaseState {
  phase: Phase;
  /** ms spent in the current phase. */
  elapsedMs: number;
  seenBurst: number;
  seenStreamDone: number;
  /** value of streamDone when we entered `speaking` — lets us tell a finished
   *  answer (→ flourish) from an aborted / errored one (→ idle). */
  streamDoneAtSpeakStart: number;
}

export const ANSWER_BURST_MS = 460;
export const FLOURISH_MS = 1200;

export function initPhaseState(): PhaseState {
  return {
    phase: "idle",
    elapsedMs: 0,
    seenBurst: 0,
    seenStreamDone: 0,
    streamDoneAtSpeakStart: 0,
  };
}

/** Advance the machine by `dtMs`. Returns a new state object. */
export function stepPhase(prev: PhaseState, input: PhaseInput, dtMs: number): PhaseState {
  const s: PhaseState = { ...prev, elapsedMs: prev.elapsedMs + dtMs };
  const burstEdge = input.burst > s.seenBurst;
  const doneEdge = input.streamDone > s.seenStreamDone;
  s.seenBurst = input.burst;
  s.seenStreamDone = input.streamDone;

  const enter = (phase: Phase) => {
    if (phase !== s.phase) {
      s.phase = phase;
      s.elapsedMs = 0;
      if (phase === "speaking") s.streamDoneAtSpeakStart = s.seenStreamDone;
    }
  };

  switch (s.phase) {
    case "idle":
      if (input.streaming && !input.hasAnswer) enter("thinking");
      else if (burstEdge || (input.speaking && input.hasAnswer)) enter("answerBurst");
      break;

    case "thinking":
      if (burstEdge) enter("answerBurst");
      else if (input.hasAnswer || input.speaking) enter("speaking");
      else if (!input.streaming) enter("idle");
      break;

    case "answerBurst":
      if (s.elapsedMs >= ANSWER_BURST_MS) enter(input.speaking || input.streaming ? "speaking" : "flourish");
      break;

    case "speaking":
      // new question fired mid-answer
      if (input.streaming && !input.hasAnswer && !input.speaking) enter("thinking");
      else if (!input.speaking && !input.streaming) {
        enter(input.streamDone > s.streamDoneAtSpeakStart || doneEdge ? "flourish" : "idle");
      }
      break;

    case "flourish":
      if (input.streaming) enter("thinking");
      else if (s.elapsedMs >= FLOURISH_MS) enter("idle");
      break;
  }

  return s;
}
