"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { tts } from "@/lib/tts";
import { CRITTERS, pickCritter, type Critter, type CritterId } from "./catalog";

export interface CritterApi {
  /**
   * Play a critter now, ignoring the idle guard (manual = always plays).
   * Returns false for an unknown id, so callers can validate a slash command
   * without importing the catalog into the initial bundle.
   */
  summon: (id: string) => boolean;
}

export interface ActiveCritter {
  critter: Critter;
  startedAt: number;
  /** True once the enter beat is done and the gnome should be reacting. */
  reacting: boolean;
}

const AMBIENT_MIN_MS = 60_000;
const AMBIENT_MAX_MS = 150_000;
/** Never fire an ambient critter this soon after an answer finishes. */
const QUIET_AFTER_ANSWER_MS = 8_000;
/** Fraction of the event spent entering before the reaction starts. */
const ENTER_FRACTION = 0.22;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Owns the ambient critter loop and the imperative `summon`.
 *
 * A critter event is purely cosmetic: it never blocks or delays a real
 * question, and asking one despawns it instantly.
 */
export function useCritterEvents({
  enabled,
  isIdle,
  streaming,
  characterId,
  mood,
  reduced,
  voiceOn,
}: {
  enabled: boolean;
  isIdle: boolean;
  streaming: boolean;
  characterId?: number;
  mood?: string;
  reduced: boolean;
  voiceOn: boolean;
}): { active: ActiveCritter | null; caption: string; api: CritterApi } {
  const [active, setActive] = useState<ActiveCritter | null>(null);
  const [caption, setCaption] = useState("");

  const activeRef = useRef<ActiveCritter | null>(null);
  const idleRef = useRef(isIdle);
  const enabledRef = useRef(enabled);
  const seen = useRef<Set<CritterId>>(new Set());
  const timers = useRef<Set<number>>(new Set());
  const abort = useRef<AbortController | null>(null);
  /** True while OUR quip is being spoken, so cancelling never kills a real answer. */
  const speakingQuip = useRef(false);
  const lastAnswerAt = useRef(0);

  activeRef.current = active;
  idleRef.current = isIdle;
  enabledRef.current = enabled;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
  }, []);

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const despawn = useCallback(() => {
    clearTimers();
    abort.current?.abort();
    abort.current = null;
    if (speakingQuip.current) {
      tts.cancel();
      speakingQuip.current = false;
    }
    setCaption("");
    setActive(null);
  }, [clearTimers]);

  /** Fetch the quip, stream it into the caption, and speak it. */
  const runQuip = useCallback(
    async (critter: Critter) => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      const speak = voiceOn && !tts.isMuted();
      if (speak) {
        speakingQuip.current = true;
        tts.begin();
      }
      try {
        const res = await fetch("/api/quip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId, critterId: critter.id, mood }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          full += chunk;
          setCaption(full.trim());
          if (speak) tts.feed(chunk);
        }
        if (speak) tts.end();
      } catch {
        if (ctrl.signal.aborted) return;
        // Ollama being down is already handled server-side, which answers with
        // a canned line. Reaching here means the route itself was unreachable,
        // so just end the beat quietly rather than inventing a caption.
        if (speak) tts.end();
      } finally {
        if (abort.current === ctrl) abort.current = null;
      }
    },
    [characterId, mood, voiceOn]
  );

  const start = useCallback(
    (critter: Critter) => {
      if (activeRef.current) return;
      seen.current.add(critter.id);
      if (seen.current.size >= Object.keys(CRITTERS).length) seen.current.clear();

      const startedAt = performance.now();
      setActive({ critter, startedAt, reacting: false });
      sound.critterCue(critter.sfx);

      const enterMs = critter.durationMs * ENTER_FRACTION;
      after(enterMs, () => {
        setActive((a) => (a && a.startedAt === startedAt ? { ...a, reacting: true } : a));
        void runQuip(critter);
      });
      // Exit beat: clear the reaction a little before the model leaves.
      after(critter.durationMs * 0.78, () => {
        setActive((a) => (a && a.startedAt === startedAt ? { ...a, reacting: false } : a));
        setCaption("");
      });
      after(critter.durationMs, () => {
        setActive((a) => (a && a.startedAt === startedAt ? null : a));
      });
    },
    [after, runQuip]
  );

  const summon = useCallback(
    (id: string): boolean => {
      const critter = CRITTERS[id as CritterId];
      if (!critter) return false;
      if (activeRef.current) despawn();
      // Next tick, so the despawn above has committed before the new mount.
      window.setTimeout(() => start(critter), 0);
      return true;
    },
    [despawn, start]
  );

  // Hard cancel the moment a real question starts.
  useEffect(() => {
    if (streaming) {
      lastAnswerAt.current = performance.now();
      if (activeRef.current) despawn();
    } else if (lastAnswerAt.current) {
      lastAnswerAt.current = performance.now();
    }
  }, [streaming, despawn]);

  // Ambient loop.
  useEffect(() => {
    if (!enabled || reduced) return;
    let cancelled = false;
    let timer = 0;

    const schedule = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const quietEnough =
          !lastAnswerAt.current ||
          performance.now() - lastAnswerAt.current > QUIET_AFTER_ANSWER_MS;
        if (
          enabledRef.current &&
          idleRef.current &&
          quietEnough &&
          !activeRef.current &&
          !document.hidden
        ) {
          start(pickCritter(seen.current));
        }
        schedule();
      }, rand(AMBIENT_MIN_MS, AMBIENT_MAX_MS));
    };
    schedule();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, reduced, start]);

  // Tear everything down on unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
      abort.current?.abort();
      if (speakingQuip.current) tts.cancel();
    };
  }, []);

  return { active, caption, api: { summon } };
}
