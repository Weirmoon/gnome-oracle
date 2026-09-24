"use client";
import { useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/domain/types";
import { apiFetch } from "@/lib/platform/client";
import { exportProphecyCard } from "@/lib/cards";
import { tts } from "@/lib/tts";
type Turn = { character: Character; text: string; phase: string; historyId?: number; error?: string; complete?: boolean };

export default function Council({ characters, resumeId }: { characters: Character[]; resumeId?: number }) {
  const [ids, setIds] = useState<number[]>(characters.slice(0, 3).map(c => c.id));
  const [question, setQuestion] = useState(""), [turns, setTurns] = useState<Record<number, Turn>>({});
  const [cid, setCid] = useState<number | undefined>(resumeId), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const voiceQueue = useRef(Promise.resolve());
  const voiceEpoch = useRef(0);
  useEffect(() => { if (!ids.length && characters.length) setIds(characters.slice(0, 3).map(c => c.id)); }, [characters, ids.length]);
  useEffect(() => { return () => { abort.current?.abort(); voiceEpoch.current++; tts.cancel(); }; }, []);
  useEffect(() => {
    if (!resumeId) return;
    apiFetch(`/api/consultations/${resumeId}`).then(r => r.json()).then(data => {
      if (data.error) throw new Error(data.error);
      const result: Record<number, Turn> = {};
      for (const m of data.messages) { const index = Number(m.phase.replace("council-", "")); result[index] = { character: JSON.parse(m.character_snapshot), text: m.answer, phase: index < 3 ? "answer" : "rebuttal", complete: m.status === "complete", error: m.error ?? (m.status !== "complete" ? "Interrupted" : undefined), historyId: m.id }; }
      setTurns(result); setQuestion(data.messages[0]?.question ?? data.title); setCid(resumeId);
      setIds(data.character_snapshot.map((c: Character) => c.id));
    }).catch(e => setError(e.message));
  }, [resumeId]);
  async function run(retryIndex?: number) {
    if (busy) return;
    abort.current = new AbortController(); setBusy(true); setError("");
    const epoch = ++voiceEpoch.current; tts.cancel(); voiceQueue.current = Promise.resolve();
    if (retryIndex === undefined) { setTurns({}); setCid(undefined); }
    const current: Record<number, Turn> = retryIndex === undefined ? {} : { ...turns };
    try {
      const res = await apiFetch("/api/council", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(retryIndex === undefined ? { characterIds: ids, question } : { consultationId: cid, retryIndex }), signal: abort.current.signal });
      if (!res.ok) throw new Error((await res.json()).error);
      const reader = res.body!.getReader(), decoder = new TextDecoder(); let buffer = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1); if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "session") setCid(event.consultationId);
          if (event.type === "speaker") current[event.index] = { character: event.character, text: "", phase: event.phase, historyId: event.historyId };
          if (event.type === "text") current[event.index].text += event.text;
          if (event.type === "error") { if (current[event.index]) current[event.index].error = event.error; else setError(event.error); }
          if (event.type === "done" && current[event.index]) {
            current[event.index].complete = true;
            const turn = { ...current[event.index] };
            voiceQueue.current = voiceQueue.current.then(async () => {
              if (epoch !== voiceEpoch.current || tts.isMuted()) return;
              tts.setVoice(turn.character.meta.voice); tts.begin(); tts.feed(turn.text); tts.end(); await tts.whenIdle();
            });
          }
          setTurns(Object.fromEntries(Object.entries(current).map(([key, v]) => [key, { ...v }])));
        }
      }
    } catch (e) { if (!abort.current?.signal.aborted) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel council"><h2>Oracle Council</h2><p className="persona-desc">Three perspectives, then three rebuttals. Each turn uses your active AI connection.</p>
    <div className="controlgrid">{[0, 1, 2].map(i => <label className="field" key={i}>Seat {i + 1}<select disabled={busy} value={ids[i] ?? ""} onChange={e => setIds(old => old.map((id, j) => j === i ? Number(e.target.value) : id))}>{characters.map(c => <option key={c.id} value={c.id} disabled={ids.includes(c.id) && ids[i] !== c.id}>{c.emoji} {c.name}</option>)}</select></label>)}</div>
    <label className="field">Question<textarea value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} /></label><div className="row"><button onClick={() => run()} disabled={busy || !question.trim() || new Set(ids).size !== 3}>{busy ? "Council in session…" : "Convene Council"}</button><button className="ghost" onClick={() => { abort.current?.abort(); voiceEpoch.current++; tts.cancel(); }} disabled={!busy}>Stop</button></div>
    {Object.entries(turns).map(([key, t]) => <article className="histcard panel" key={key}><b>{t.character.emoji} {t.character.name} · {t.phase}</b><p className="hista">{t.text || (t.error ? "" : "Thinking…")}</p>{t.error && <p className="error">{t.error}</p>}
      <div className="row">{!busy && !t.complete && <button className="ghost" onClick={() => run(Number(key))}>Retry this speaker</button>}{t.complete && <><button className="ghost" onClick={() => exportProphecyCard(question, t.text, t.character.name, t.character.meta.appearance).catch(e => setError(e.message))}>Export card</button><button className="ghost" onClick={() => apiFetch(`/api/history/${t.historyId}`, { method: "PATCH" }).then(() => setError("Favorite updated."))}>Toggle favorite</button></>}</div></article>)}
    {cid && <p className="persona-desc">Saved Council #{cid}</p>}{error && <p role="status">{error}</p>}
  </section>;
}
