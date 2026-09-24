"use client";
import { useState } from "react";
import type { Character } from "@/lib/domain/types";
import { AVATAR_VARIANTS, HAT_STYLES } from "@/lib/persona";
import { apiFetch, exportFile } from "@/lib/platform/client";

export default function PersonaEditor({ character, onSaved, onClose }: { character: Character; onSaved: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(character));
  const [catchphrases, setCatchphrases] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  function field(key: keyof Character, value: unknown) { setDraft(d => ({ ...d, [key]: value })); }
  async function save() {
    setBusy(true); setError("");
    try {
      const data = { ...draft, system_prompt: draft.system_prompt + (catchphrases.trim() ? `\nOccasional catchphrases: ${catchphrases.trim()}` : "") };
      const res = await apiFetch(character.is_seed ? "/api/characters" : `/api/characters/${character.id}`, { method: character.is_seed ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).error); onSaved(); onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel editor" aria-label="Persona editor"><h2>{character.is_seed ? "Create an editable copy" : "Edit persona"}</h2>
    <div className="controlgrid"><label className="field">Name<input maxLength={60} value={draft.name} onChange={e => field("name", e.target.value)} /></label><label className="field">Emoji<input value={draft.emoji} onChange={e => field("emoji", e.target.value)} /></label></div>
    <label className="field">Description<textarea value={draft.description} onChange={e => field("description", e.target.value)} /></label>
    <label className="field">Personality instructions<textarea rows={6} value={draft.system_prompt} onChange={e => field("system_prompt", e.target.value)} /></label>
    <label className="field">Add catchphrases<input value={catchphrases} onChange={e => setCatchphrases(e.target.value)} placeholder="By my mossy beard!" /></label>
    <label className="field">Moods, separated by commas<input value={draft.meta.moods.join(", ")} onChange={e => field("meta", { ...draft.meta, moods: e.target.value.split(",").map(s => s.trim()) })} /></label>
    <div className="controlgrid"><label className="field">Body<select value={draft.meta.appearance.variant ?? "gnome"} onChange={e => field("meta", { ...draft.meta, appearance: { ...draft.meta.appearance, variant: e.target.value }, appearanceVariants: [] })}>{AVATAR_VARIANTS.map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="field">Hat<select value={draft.meta.appearance.hat} onChange={e => field("meta", { ...draft.meta, appearance: { ...draft.meta.appearance, hat: e.target.value }, appearanceVariants: [] })}>{HAT_STYLES.map(v => <option key={v}>{v}</option>)}</select></label>
      {(["hatColor", "robeColor", "accent", "skin"] as const).map(key => <label className="field" key={key}>{key}<input type="color" value={draft.meta.appearance[key]} onChange={e => field("meta", { ...draft.meta, appearance: { ...draft.meta.appearance, [key]: e.target.value }, appearanceVariants: [] })} /></label>)}
      {(["rate", "pitch"] as const).map(key => <label className="field" key={key}>Voice {key}: {draft.meta.voice[key]}<input type="range" min="0.6" max="1.6" step="0.05" value={draft.meta.voice[key]} onChange={e => field("meta", { ...draft.meta, voice: { ...draft.meta.voice, [key]: Number(e.target.value) } })} /></label>)}
    </div><div className="row"><button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save persona"}</button><button className="ghost" onClick={onClose}>Cancel</button><button className="ghost" onClick={() => exportFile("gnome-persona.json", new Blob([JSON.stringify({ version: 1, persona: draft }, null, 2)], { type: "application/json" })).catch(e => setError(e.message))}>Export JSON</button></div>{error && <p role="alert" className="error">{error}</p>}
  </section>;
}
