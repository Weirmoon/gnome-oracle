// Client-side text-to-speech using the browser's built-in speechSynthesis.
// Speaks sentence-by-sentence as the answer streams in, so the wizard starts
// talking almost immediately and the mouth stays roughly in sync with audio.

export interface TtsVoice {
  rate: number; // 0.5 - 1.6
  pitch: number; // 0 - 2
}

/** Emitted on each word/sentence boundary while an utterance plays. Drives the
 *  avatar's mouth (see components/oracle/animation/lipSync.ts). */
export interface TtsBoundary {
  charIndex: number;
  /** seconds since the utterance started. */
  elapsedTime: number;
  /** rough length of the word just started. */
  wordLength: number;
}

type SpeakingCb = (speaking: boolean) => void;
type BoundaryCb = (b: TtsBoundary) => void;

class Tts {
  private muted = false;
  private buffer = "";
  private voice: TtsVoice = { rate: 1, pitch: 1 };
  private volume = 1; // 0 - 1
  private active = 0; // utterances currently queued or playing
  private listeners = new Set<SpeakingCb>();
  private boundaryListeners = new Set<BoundaryCb>();

  supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.cancel();
  }

  isMuted() {
    return this.muted;
  }

  setVoice(v: TtsVoice) {
    this.voice = v;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
  }

  onSpeakingChange(cb: SpeakingCb): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onBoundary(cb: BoundaryCb): () => void {
    this.boundaryListeners.add(cb);
    return () => this.boundaryListeners.delete(cb);
  }

  private notify() {
    const speaking = this.active > 0;
    this.listeners.forEach((cb) => cb(speaking));
  }

  /** Start a new utterance stream (cancels anything still playing). */
  begin() {
    this.cancel();
    this.buffer = "";
  }

  /** Feed a chunk of streamed text; complete sentences are spoken immediately. */
  feed(chunk: string) {
    if (this.muted || !this.supported()) return;
    this.buffer += chunk;
    this.flush(false);
  }

  /** Flush whatever remains at the end of the answer. */
  end() {
    if (this.muted || !this.supported()) return;
    this.flush(true);
  }

  /** Speak a full piece of text on demand (e.g. a Replay button). Works even
   *  when auto-speak is muted, since it's an explicit user action. */
  replay(text: string) {
    if (!this.supported() || !text.trim()) return;
    this.cancel();
    this.buffer = text;
    this.flush(true);
  }

  private flush(force: boolean) {
    // Pull out complete sentences ending in . ! ? (keep a trailing partial).
    const re = /[^.!?]*[.!?]+(\s|$)/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buffer)) !== null) {
      const sentence = m[0].trim();
      if (sentence) this.speak(sentence);
      lastIndex = re.lastIndex;
    }
    this.buffer = this.buffer.slice(lastIndex);
    if (force && this.buffer.trim()) {
      this.speak(this.buffer.trim());
      this.buffer = "";
    }
  }

  private speak(text: string) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.voice.rate;
    u.pitch = this.voice.pitch;
    u.volume = this.volume;
    if (this.boundaryListeners.size) {
      u.onboundary = (ev) => {
        if (ev.name !== "word" && ev.name !== "sentence") return;
        const rest = text.slice(ev.charIndex);
        const m = /^\s*(\S+)/.exec(rest);
        const wordLength = m ? m[1].replace(/[^A-Za-z']/g, "").length || 1 : 1;
        this.boundaryListeners.forEach((cb) =>
          cb({ charIndex: ev.charIndex, elapsedTime: ev.elapsedTime / 1000, wordLength })
        );
      };
    }
    const done = () => {
      this.active = Math.max(0, this.active - 1);
      this.notify();
    };
    u.onend = done;
    u.onerror = done;
    // Count the utterance from the moment it is queued until it finishes, so
    // the mouth animation covers both queue latency and playback.
    this.active++;
    window.speechSynthesis.speak(u);
    this.notify();
  }

  cancel() {
    if (!this.supported()) return;
    window.speechSynthesis.cancel();
    this.active = 0;
    this.notify();
  }
}

export const tts = new Tts();
