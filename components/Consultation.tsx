"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/platform/client";
import { exportProphecyCard } from "@/lib/cards";
import { tts } from "@/lib/tts";
import type { Character } from "@/lib/domain/types";

export default function Consultation({ id }: { id: number }) {
  const [consultation, setConsultation] = useState<any>(null), [question, setQuestion] = useState(""), [answer, setAnswer] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { apiFetch(`/api/consultations/${id}`).then(r => r.json()).then(data => { if (data.error) throw new Error(data.error); setConsultation(data); setQuestion(""); }).catch(e => setError(e.message)); return () => abort.current?.abort(); }, [id]);
  const character = consultation?.character_snapshot as Character | undefined;
  const messages = consultation?.messages ?? [];
  async function ask() {
    if (!question.trim() || busy) return;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller; setBusy(true); setAnswer(""); setError(""); tts.begin();
    try {
      const res = await apiFetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, consultationId: id }), signal: controller.signal });
      if (!res.ok) throw new Error((await res.json()).error); const reader = res.body!.getReader(), decoder = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); if (done) break; const text = decoder.decode(value, { stream: true }); setAnswer(old => old + text); tts.feed(text); }
      tts.end(); setQuestion(""); const refreshed = await apiFetch(`/api/consultations/${id}`); setConsultation(await refreshed.json());
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!consultation) return <main className="wrap"><p role="status">Loading consultation…</p>{error && <p role="alert">{error}</p>}</main>;
  return <main className="wrap"><div className="topbar"><h1 className="title">Consultation #{id} <span className="spark">🔮</span></h1><Link className="navlink" href="/history">← History</Link></div><p className="tagline">Resuming {character?.emoji} {character?.name ?? "the oracle"}. Only this consultation is remembered.</p>
    <div className="list">{messages.filter((m: any) => m.answer).map((m: any) => <article className="histcard panel" key={m.id}><p className="histq">“{m.question}”</p><p className="hista">{m.answer}</p>{m.status === "incomplete" && <p className="error">This answer was interrupted. Ask again to continue.</p>}<button className="ghost" onClick={() => exportProphecyCard(m.question, m.answer, m.persona_name, character?.meta.appearance).catch(e => setError(e.message))}>🖼️ Export card</button></article>)}</div>
    {answer && <div className="bubble">{answer}</div>}<div className="row"><input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void ask(); }} placeholder="Continue this consultation…" /><button disabled={busy || !question.trim()} onClick={() => void ask()}>{busy ? "Conjuring…" : "Ask again"}</button></div>{error && <p role="alert">{error}</p>}</main>;
}
