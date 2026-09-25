"use client";

/**
 * Hidden-by-default view of a thinking model's reasoning: a pulsing hint while
 * the oracle ponders, then a collapsed "musings" section once the answer starts.
 */
export default function Pondering({ reasoning, pondering }: { reasoning: string; pondering: boolean }) {
  if (!reasoning) return null;
  return <details className="pondering">
    <summary>{pondering ? <span className="pondering-live">✨ The oracle ponders…</span> : "✨ The oracle’s musings"}</summary>
    <p className="pondering-text">{reasoning}</p>
  </details>;
}
