"use client";

// Content-driven gesture cues parsed from the streamed answer text. A single
// pass over the *delta* (new characters since last feed) emits cue types; at
// most one cue fires per 700 ms so a punctuation-heavy sentence doesn't twitch.

export type GestureType =
  | "emphasize" // ! → arm up + lean in + brows up
  | "ponder" // ? → head tilt + look up
  | "enumerate" // list / number → small count nod
  | "chuckle" // haha/lol → torso bounce, head back
  | "hesitate" // … / — → eyes up, micro shrug
  | "beat"; // sentence end → tiny nod

export interface GestureOffset {
  headPitch: number;
  headRoll: number;
  brow: number;
  lean: number;
  armRaise: number;
}

const OFFSETS: Record<GestureType, GestureOffset> = {
  emphasize: { headPitch: -0.04, headRoll: 0, brow: 0.7, lean: 0.16, armRaise: 0.8 },
  ponder: { headPitch: -0.12, headRoll: 0.18, brow: -0.2, lean: -0.04, armRaise: 0 },
  enumerate: { headPitch: 0.08, headRoll: 0.05, brow: 0.2, lean: 0.03, armRaise: 0.25 },
  chuckle: { headPitch: -0.14, headRoll: 0.06, brow: 0.4, lean: -0.05, armRaise: 0 },
  hesitate: { headPitch: -0.1, headRoll: -0.08, brow: -0.1, lean: -0.03, armRaise: 0 },
  beat: { headPitch: 0.05, headRoll: 0, brow: 0, lean: 0, armRaise: 0 },
};

const DURATION: Record<GestureType, number> = {
  emphasize: 620,
  ponder: 900,
  enumerate: 500,
  chuckle: 850,
  hesitate: 700,
  beat: 320,
};

/** Scan new text; return the cue types it contains (order-preserving, deduped). */
export function parseGestureCues(delta: string): GestureType[] {
  const out: GestureType[] = [];
  const add = (g: GestureType) => {
    if (!out.includes(g)) out.push(g);
  };
  if (/!/.test(delta)) add("emphasize");
  if (/\?/.test(delta)) add("ponder");
  if (/\b(haha|hehe|heh|lol|lmao|hah)\b/i.test(delta) || /😂|🤣/.test(delta)) add("chuckle");
  if (/(^|\n)\s*([-*•]|\d+[.)])\s/.test(delta) || /\d+\s?(%|\$|dollars|percent)/i.test(delta))
    add("enumerate");
  if (/\.\.\.|—| - /.test(delta)) add("hesitate");
  if (/[.!?]\s*$/.test(delta)) add("beat");
  return out;
}

class Gestures {
  private prevLen = 0;
  private queue: GestureType[] = [];
  private lastFireAt = -Infinity;
  private active: { type: GestureType; t: number; dur: number } | null = null;

  /** Feed the full running answer text; diffs against last call. */
  feed(fullText: string) {
    if (fullText.length < this.prevLen) this.prevLen = 0; // new answer
    if (fullText.length === this.prevLen) return;
    const delta = fullText.slice(this.prevLen);
    this.prevLen = fullText.length;
    for (const g of parseGestureCues(delta)) {
      if (this.queue.length < 4) this.queue.push(g);
    }
  }

  reset() {
    this.prevLen = 0;
    this.queue = [];
    this.active = null;
  }

  /** Advance timers; return the currently-playing gesture type, or null. */
  tick(dtMs: number): GestureType | null {
    const now = performanceNow();
    if (this.active) {
      this.active.t += dtMs;
      if (this.active.t >= this.active.dur) this.active = null;
    }
    if (!this.active && this.queue.length && now - this.lastFireAt >= 700) {
      const type = this.queue.shift()!;
      this.active = { type, t: 0, dur: DURATION[type] };
      this.lastFireAt = now;
    }
    return this.active?.type ?? null;
  }

  /** Eased 0→1→0 weight for the active gesture. */
  weight(): number {
    if (!this.active) return 0;
    const k = this.active.t / this.active.dur;
    return Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
  }
}

function performanceNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

const gestures = new Gestures();

export function feedGestureText(text: string) {
  gestures.feed(text);
}
export function resetGestures() {
  gestures.reset();
}
/** Called once per frame from GnomeModel; returns a blended pose offset or null. */
export function readGesture(dtMs: number): GestureOffset | null {
  const type = gestures.tick(dtMs);
  if (!type) return null;
  const w = gestures.weight();
  const o = OFFSETS[type];
  return {
    headPitch: o.headPitch * w,
    headRoll: o.headRoll * w,
    brow: o.brow * w,
    lean: o.lean * w,
    armRaise: o.armRaise * w,
  };
}
