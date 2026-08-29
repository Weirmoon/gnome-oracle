"use client";

import { tts, type TtsBoundary } from "@/lib/tts";

// Mouth-openness envelope for the crystal gnome.
//
// Preferred source: `SpeechSynthesisUtterance.onboundary` word events (real
// speech timing). speechSynthesis audio can't be routed into an AnalyserNode in
// any browser, so amplitude lip-sync isn't possible without replacing the TTS
// engine — out of scope.
//
// Fallbacks, in order:
//   • voice muted / unsupported → sine flap, pulsed by streaming-text cadence
//   • voice on but no boundary event within 500 ms (Safari, older FF) → sine

const VISEMES = ["A", "E", "O", "M"] as const;

class LipSync {
  private lastBoundaryAt = -Infinity;
  private targetOpen = 0.15;
  private viseme = 0;
  private wordEndsAt = 0;
  private sawAnyBoundary = false;
  private speakStartedAt = -Infinity;

  private answerLen = 0;
  private lastAnswerChangeAt = -Infinity;

  constructor() {
    if (typeof window !== "undefined") tts.onBoundary((b) => this.onBoundary(b));
  }

  /** Mark the moment speaking begins so we can time-out the boundary wait. */
  noteSpeakingStart(nowSec: number) {
    this.speakStartedAt = nowSec;
    this.sawAnyBoundary = false;
  }

  /** Called every time the streamed answer text changes (muted-mode cadence). */
  noteAnswer(text: string) {
    if (text.length !== this.answerLen) {
      this.answerLen = text.length;
      this.lastAnswerChangeAt = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
    }
  }

  private onBoundary(b: TtsBoundary) {
    const now = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
    this.lastBoundaryAt = now;
    this.sawAnyBoundary = true;
    this.targetOpen = 0.35 + Math.min(0.55, b.wordLength * 0.08);
    this.wordEndsAt = now + Math.max(0.12, b.wordLength * 0.06);
    this.viseme = (hash(String(b.charIndex)) + b.wordLength) % VISEMES.length;
  }

  /**
   * @param tSec  clock.elapsedTime
   * @param speaking  whether TTS is currently producing audio
   * @returns 0…1 mouth openness
   */
  mouthOpen(tSec: number, speaking: boolean): number {
    const now = typeof performance !== "undefined" ? performance.now() / 1000 : tSec;
    const muted = tts.isMuted() || !tts.supported();

    // --- boundary-driven envelope ---
    const boundaryFresh = now - this.lastBoundaryAt < 0.28;
    const withinSpeak = speaking && now - this.speakStartedAt < 30;
    const boundaryUsable =
      !muted && (this.sawAnyBoundary || (withinSpeak && now - this.speakStartedAt < 0.5));

    if (boundaryUsable && this.sawAnyBoundary) {
      let open = this.targetOpen;
      if (boundaryFresh) {
        // quick syllable oscillation right after a word starts
        open *= 0.7 + 0.3 * Math.abs(Math.sin(tSec * 26));
      } else if (now > this.wordEndsAt) {
        open = 0.12; // rest between words
      }
      return clamp01(open);
    }

    // --- fallback: sine flap while there's something to say ---
    if (speaking || (muted && now - this.lastAnswerChangeAt < 0.4)) {
      return 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(tSec * 16));
    }
    return 0.12;
  }

  currentViseme() {
    return VISEMES[this.viseme];
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

const lipSync = new LipSync();

export function getMouthOpen(tSec: number, speaking: boolean): number {
  return lipSync.mouthOpen(tSec, speaking);
}
export function noteAnswerText(text: string) {
  lipSync.noteAnswer(text);
}
export function noteSpeakingStart() {
  lipSync.noteSpeakingStart(
    typeof performance !== "undefined" ? performance.now() / 1000 : 0
  );
}
