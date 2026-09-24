"use client";
import { apiFetch } from "@/lib/platform/client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { PersonaMeta } from "@/lib/persona";

import type { Character } from "@/lib/domain/types";
import PersonaEditor from "@/components/PersonaEditor";
export default function Lab() {
  const [editing, setEditing] = useState<Character | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [vibe, setVibe] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justMade, setJustMade] = useState<Character | null>(null);

  function load() {
    apiFetch("/api/characters")
      .then((r) => r.json())
      .then(setCharacters)
      .catch(() => {});
  }

  useEffect(load, []);

  async function generate() {
    if (!vibe.trim() || busy) return;
    setBusy(true);
    setError("");
    setJustMade(null);
    try {
      const res = await apiFetch("/api/characters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setJustMade(data);
      setVibe("");
      load();
    } catch {
      setError("Could not reach the conjurer.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await apiFetch(`/api/characters/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete.");
    }
  }

  return (
    <main className="wrap">
      <div className="topbar">
        <h1 className="title">
          Persona Lab <span className="spark">🧪</span>
        </h1>
        <Link className="navlink" href="/">
          ← Back to the Oracle
        </Link>
      </div>
      <p className="tagline">
        Describe a vibe and the model will conjure a brand-new persona for the drop-down.
      </p>

      <div className="panel">
        <label className="field">
          Describe a vibe
          <textarea
            rows={3}
            placeholder="e.g. a 1920s gangster, a sleepy cat, an overdramatic Shakespearean actor…"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
          />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={generate} disabled={busy || !vibe.trim()}>
            {busy ? "Conjuring persona…" : "✨ Conjure a Persona"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {justMade && (
          <p className="persona-desc" style={{ marginTop: 10 }}>
            Created <b>{justMade.emoji} {justMade.name}</b> — it's now in the drop-down!
          </p>
        )}
      </div>

      {editing && <PersonaEditor key={editing.id} character={editing} onSaved={load} onClose={() => setEditing(null)} />}
      <label className="field">Import a persona<input type="file" accept=".json,application/json" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        try { if (file.size > 100000) throw new Error("Persona file is too large."); const data = JSON.parse(await file.text()); if (data.version !== 1 || !data.persona) throw new Error("Unsupported persona file."); const res = await apiFetch("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.persona) }); if (!res.ok) throw new Error((await res.json()).error); load(); } catch (err) { setError((err as Error).message); }
      }} /></label>
      <h2 className="section-title">All Personas</h2>
      <ul className="list">
        {characters.map((c) => (
          <li key={c.id}>
            <span className="emoji">{c.emoji}</span>
            <span
              className="swatch"
              title={`${c.meta.appearance.hat} hat`}
              style={{
                background: c.meta.appearance.robeColor,
                borderColor: c.meta.appearance.accent,
              }}
            >
              <span style={{ background: c.meta.appearance.hatColor }} />
              <span style={{ background: c.meta.appearance.accent }} />
            </span>
            <span className="meta">
              <b>{c.name}</b>
              <small>{c.description}</small>
            </span>
            <button className="ghost" onClick={() => setEditing(c)}>{c.is_seed ? "Duplicate / edit" : "Edit"}</button>
            {c.is_seed ? (
              <span className="badge">built-in</span>
            ) : (
              <button className="danger" onClick={() => remove(c.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
