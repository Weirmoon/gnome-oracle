"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { BACKGROUND_PRESETS, defaultBackgroundDocument, parseBackgroundFile, type BackgroundConfig } from "@/lib/background";
import { exportFile } from "@/lib/platform/client";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { useBackground } from "./BackgroundProvider";

const DESCRIPTIONS: Record<BackgroundConfig["effect"], string> = {
  gradient: "The familiar purple glow. A calm, static home for your oracle.",
  matrix: "A curtain of falling glyphs bends gently around your pointer.",
  constellations: "Drifting stars find one another, and connect to your pointer.",
  particles: "Luminous motes drift around you. Choose whether they gather or scatter.",
};

function RangeField({ label, value, min = 0, max = 1, step = 0.05, onChange, unit = "%" }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void; unit?: string }) {
  return <label className="field background-range"><span>{label}<output>{unit === "%" ? Math.round(value * 100) : value}{unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function BackgroundSettings() {
  const { document, ready, error, setConfig, replaceDocument } = useBackground();
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [selectedCustomId, setSelectedCustomId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const { config, presets } = document;
  const update = <K extends keyof BackgroundConfig>(key: K, value: BackgroundConfig[K]) => { setConfig({ ...config, [key]: value }); setSelectedCustomId(""); };

  function savePreset() {
    const trimmed = name.trim();
    if (!trimmed) { setFailure("Give your preset a name first."); return; }
    if (presets.length >= 40) { setFailure("You can keep up to 40 custom presets. Delete one before saving another."); return; }
    const id = `custom-${crypto.randomUUID()}`;
    replaceDocument({ ...document, presets: [...presets, { id, name: trimmed, config: { ...config } }] });
    setSelectedCustomId(id); setName(""); setNotice(`Saved “${trimmed}”.`); setFailure("");
  }

  async function importPresets(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("Choose a background JSON file smaller than 100 KB.");
      const imported = parseBackgroundFile(await file.text());
      const copies = imported.presets.map((preset) => ({ ...preset, id: `custom-${crypto.randomUUID()}` }));
      if (presets.length + copies.length > 40) throw new Error("Import would exceed 40 custom presets. Remove some presets first.");
      replaceDocument({ version: 1, config: imported.config, presets: [...presets, ...copies] });
      setSelectedCustomId(""); setFailure(""); setNotice(`Applied the imported background and added ${copies.length} custom preset${copies.length === 1 ? "" : "s"}.`);
    } catch (error) { setFailure(error instanceof Error ? error.message : "Could not import this background."); }
  }

  async function exportPresets() {
    try {
      await exportFile("gnome-backgrounds.json", new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
      setFailure(""); setNotice("Background settings exported.");
    } catch (error) { setFailure(error instanceof Error ? error.message : "Could not export backgrounds."); }
  }

  return <section className="background-studio" aria-labelledby={headingId}>
    <header className="background-studio-header"><div><span className="background-eyebrow">MAKE SPACE FOR MAGIC</span><h3 id={headingId}>Background Studio</h3></div><span className="background-live-badge">Live preview</span></header>
    <p className="background-description">Choose a world, then make it yours. Changes apply across the app and save automatically.</p>
    {!ready ? <p role="status">Preparing your background…</p> : <>
      <div className="background-preset-grid" role="group" aria-label="Background effects">
        {BACKGROUND_PRESETS.map((preset) => <button key={preset.id} type="button" className={`background-preset ${config.effect === preset.config.effect ? "selected" : ""}`} aria-pressed={config.effect === preset.config.effect} onClick={() => { setConfig({ ...preset.config }); setSelectedCustomId(""); setNotice(""); }}>
          <span className={`background-thumbnail ${preset.id}`} aria-hidden="true"><span>{preset.id === "matrix" ? "01  Ψ  10" : preset.id === "constellations" ? "✦  ·  ✧" : preset.id === "particles" ? "·  ✨  ·" : "◒"}</span></span>
          <span>{preset.name}</span>
        </button>)}
      </div>
      <div className="background-preview" style={{ backgroundColor: config.backgroundColor, backgroundImage: config.effect === "gradient" ? `radial-gradient(ellipse at top, ${config.accentColor}, ${config.backgroundColor})` : undefined }}>
        <BackgroundCanvas config={config} preview />
        <div className="background-preview-copy"><span aria-hidden="true">✦</span><strong>Your next revelation awaits.</strong><small>{config.effect === "gradient" ? "A little room to wonder." : "Move your pointer here. Touch works too."}</small></div>
      </div>
      <p className="background-description">{DESCRIPTIONS[config.effect]}</p>
      <div className="background-controls">
        <label className="field background-color">Background color<input type="color" value={config.backgroundColor} onChange={(event) => update("backgroundColor", event.target.value)} /></label>
        <label className="field background-color">Accent color<input type="color" value={config.accentColor} onChange={(event) => update("accentColor", event.target.value)} /></label>
        {config.effect !== "gradient" && <>
          <RangeField label="Speed" value={config.speed} min={0} max={2} step={0.1} unit="×" onChange={(value) => update("speed", value)} />
          <RangeField label="Density" value={config.density} min={0.1} onChange={(value) => update("density", value)} />
          <RangeField label="Brightness" value={config.brightness} onChange={(value) => update("brightness", value)} />
          <RangeField label="Interaction strength" value={config.interactionStrength} onChange={(value) => update("interactionStrength", value)} />
          <label className="field">Quality<select value={config.quality} onChange={(event) => update("quality", event.target.value as BackgroundConfig["quality"])}><option value="auto">Auto — adapt to this device</option><option value="low">Low — conserve power</option><option value="high">High</option></select></label>
          {config.effect === "matrix" && <label className="field">Glyph set<input type="text" maxLength={80} value={config.glyphs} onChange={(event) => { if (event.target.value.trim() && !/[\u0000-\u001f\u007f]/.test(event.target.value)) update("glyphs", event.target.value); }} /></label>}
          {config.effect === "constellations" && <RangeField label="Connection distance" value={config.connectionDistance} min={40} max={240} step={5} unit=" px" onChange={(value) => update("connectionDistance", value)} />}
          {config.effect === "particles" && <label className="field">Pointer interaction<select value={config.particleInteraction} onChange={(event) => update("particleInteraction", event.target.value as "attract" | "repel")}><option value="repel">Scatter away</option><option value="attract">Gather around</option></select></label>}
        </>}
      </div>
      <p className="background-accessibility-note">Follows your device’s reduced-motion setting, pauses when hidden, and lets taps and scrolling pass through.</p>
      <div className="background-custom-presets">
        <h4>Your presets</h4>
        <div className="background-save-row"><label className="field">Preset name<input type="text" placeholder="Moonlit clearing" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label><button type="button" disabled={!name.trim() || presets.length >= 40} onClick={savePreset}>Save as new</button></div>
        {presets.length > 0 && <div className="background-saved-row"><label className="field">Saved presets<select value={selectedCustomId} onChange={(event) => { const preset = presets.find((item) => item.id === event.target.value); if (preset) { setConfig({ ...preset.config }); setSelectedCustomId(preset.id); } }}><option value="">Choose a saved world…</option>{presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}</select></label><button type="button" className="ghost" disabled={!selectedCustomId || presets.length >= 40} onClick={() => { const original = presets.find((item) => item.id === selectedCustomId); if (original) { const id = `custom-${crypto.randomUUID()}`; replaceDocument({ ...document, presets: [...presets, { id, name: `${original.name.slice(0, 53)} (copy)`, config: { ...original.config } }] }); setSelectedCustomId(id); setNotice("Preset duplicated."); } }}>Duplicate</button><button type="button" className="danger" disabled={!selectedCustomId} onClick={() => { replaceDocument({ ...document, presets: presets.filter((item) => item.id !== selectedCustomId) }); setSelectedCustomId(""); setNotice("Preset deleted. The current appearance is still active."); }}>Delete</button></div>}
      </div>
      <div className="background-file-actions"><button type="button" className="ghost" onClick={() => { replaceDocument({ ...document, config: defaultBackgroundDocument(false).config }); setSelectedCustomId(""); setNotice("Restored subtle Constellations. Your saved presets are kept."); }}>Restore defaults</button><button type="button" className="ghost" onClick={() => fileInput.current?.click()}>Import JSON</button><button type="button" className="ghost" onClick={() => void exportPresets()}>Export JSON</button><input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label="Import background presets" onChange={(event) => void importPresets(event)} /></div>
    </>}
    {(error || failure) && <p className="background-error" role="alert">{failure || error}</p>}
    {notice && <p className="background-notice" role="status">{notice}</p>}
  </section>;
}
