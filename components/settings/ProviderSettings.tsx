"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/platform/client";
import { PROVIDER_DEFAULTS, type ProviderKind, type ProviderModel, type ProviderProfile } from "@/lib/providers/types";

type Draft = Omit<ProviderProfile, "id"> & { id?: string; apiKey: string; clearApiKey: boolean };
type Status = { configured: boolean; managementEnabled: boolean; native?: boolean; activeProfile?: Pick<ProviderProfile, "id" | "name" | "kind" | "model"> };
const blankProfile = (kind: ProviderKind = "ollama"): Draft => ({ ...PROVIDER_DEFAULTS[kind], kind, contextBudget: 6000, hasApiKey: false, apiKey: "", clearApiKey: false });
const fieldStyle = { display: "grid", gap: 6 } as const;
const inputStyle = { width: "100%", minHeight: 42 } as const;

export default function ProviderSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<Draft>(blankProfile);
  const [tokenInput, setTokenInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // Credentials live only in this component’s memory, never browser storage.
  const adminToken = useRef("");
  const modelListId = useId();
  const native = status?.native === true;

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/providers/status").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read connection status.");
      if (cancelled) return;
      setStatus(data);
      if (data.native) {
        const listResponse = await apiFetch("/api/providers");
        const list = await listResponse.json();
        if (!listResponse.ok) throw new Error(list.error || "Could not load connections.");
        if (cancelled) return;
        setProfiles(list.profiles);
        setActiveId(list.activeProfileId);
        const selected = list.profiles.find((profile: ProviderProfile) => profile.id === list.activeProfileId);
        if (selected) setDraft({ ...selected, apiKey: "", clearApiKey: false });
        setUnlocked(true);
      }
    }).catch(value => { if (!cancelled) setError(value.message); });
    return () => { cancelled = true; adminToken.current = ""; };
  }, []);

  async function request(path = "", method = "GET", body?: unknown) {
    const response = await apiFetch(`/api/providers${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(adminToken.current ? { Authorization: `Bearer ${adminToken.current}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !native) { setUnlocked(false); adminToken.current = ""; }
      throw new Error(data.error || "The connection request failed.");
    }
    return data;
  }

  function select(profile?: ProviderProfile) {
    setDraft(profile ? { ...profile, apiKey: "", clearApiKey: false } : blankProfile());
    setModels([]);
    setNotice("");
    setError("");
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (value) { setError(value instanceof Error ? value.message : "The request failed."); }
    finally { setBusy(false); }
  }

  async function reload(selectedId?: string) {
    const list = await request();
    setProfiles(list.profiles);
    setActiveId(list.activeProfileId);
    const active = list.profiles.find((profile: ProviderProfile) => profile.id === list.activeProfileId);
    setStatus(previous => previous ? { ...previous, activeProfile: active } : previous);
    if (selectedId) {
      const selected = list.profiles.find((profile: ProviderProfile) => profile.id === selectedId);
      if (selected) setDraft({ ...selected, apiKey: "", clearApiKey: false });
    }
  }

  function payload() {
    const { hasApiKey: _hasApiKey, ...value } = draft;
    return { profile: value };
  }

  return <section className="panel" aria-labelledby="provider-settings-title" style={{ marginTop: 18 }}>
    <h2 id="provider-settings-title">AI connections</h2>
    <p className="muted">Active: <strong>{status?.activeProfile ? `${status.activeProfile.name} · ${status.activeProfile.model}` : "Loading…"}</strong></p>
    {error && <p role="alert" style={{ color: "#ffb3b3" }}>{error}</p>}
    {notice && <p role="status" style={{ color: "var(--accent2)" }}>{notice}</p>}
    {!unlocked ? <div style={{ display: "grid", gap: 10 }}>
      {status && !status.managementEnabled && <p>Connection management is locked until the server administrator configures an administrator token.</p>}
      <label style={fieldStyle}>Administrator token
        <input type="password" autoComplete="off" value={tokenInput} onChange={event => setTokenInput(event.target.value)} style={inputStyle} />
      </label>
      <button type="button" disabled={busy || !tokenInput || !status?.managementEnabled} onClick={() => void perform(async () => {
        adminToken.current = tokenInput;
        setTokenInput("");
        await reload();
        setUnlocked(true);
        const list = await request();
        const selected = list.profiles.find((profile: ProviderProfile) => profile.id === list.activeProfileId);
        if (selected) select(selected);
      })}>Unlock connection settings</button>
      <details><summary>Server setup</summary><p>Set <code>GNOME_ADMIN_TOKEN</code> and <code>GNOME_DEPLOYMENT_SECRET</code> to different secrets of at least 32 characters. Keep the deployment secret stable to unlock saved API keys after a restart. Use HTTPS when accessing these settings over a network.</p></details>
    </div> : <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ ...fieldStyle, flex: "1 1 220px" }}>Saved connection
          <select aria-label="Saved AI connection" value={draft.id || "new"} disabled={busy} onChange={event => select(profiles.find(profile => profile.id === event.target.value))} style={inputStyle}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}{profile.id === activeId ? " (active)" : ""}</option>)}
            <option value="new">New connection…</option>
          </select>
        </label>
        {!native && <button type="button" disabled={busy} onClick={() => { adminToken.current = ""; setTokenInput(""); setProfiles([]); setDraft(blankProfile()); setUnlocked(false); }}>Lock settings</button>}
      </div>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
          <label style={fieldStyle}>Profile name<input style={inputStyle} maxLength={80} value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} /></label>
          <label style={fieldStyle}>Provider<select style={inputStyle} value={draft.kind} onChange={event => {
            const kind = event.target.value as ProviderKind;
            setDraft(value => ({ ...value, ...PROVIDER_DEFAULTS[kind], kind, apiKey: "", clearApiKey: true }));
            setModels([]);
          }}>{Object.entries(PROVIDER_DEFAULTS).map(([kind, value]) => <option key={kind} value={kind}>{value.name}</option>)}</select></label>
        </div>
        <label style={fieldStyle}>Base URL<input style={inputStyle} type="url" spellCheck={false} autoComplete="off" value={draft.baseUrl} onChange={event => { setDraft(value => ({ ...value, baseUrl: event.target.value })); setModels([]); }} /></label>
        <label style={fieldStyle}>API key{draft.hasApiKey ? " (saved; leave blank to keep)" : " (optional for local servers)"}
          <input style={inputStyle} type="password" autoComplete="new-password" value={draft.apiKey} onChange={event => setDraft(value => ({ ...value, apiKey: event.target.value, clearApiKey: false }))} placeholder={draft.hasApiKey ? "•••••••• — stored securely" : "Enter provider API key"} />
        </label>
        {draft.hasApiKey && <label><input type="checkbox" checked={draft.clearApiKey} onChange={event => setDraft(value => ({ ...value, clearApiKey: event.target.checked, apiKey: "" }))} /> Remove saved API key on save</label>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
          <label style={{ ...fieldStyle, flex: "1 1 240px" }}>Model<input style={inputStyle} list={modelListId} value={draft.model} onChange={event => setDraft(value => ({ ...value, model: event.target.value }))} placeholder="Select or type a model identifier" /></label>
          <datalist id={modelListId}>{models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</datalist>
          <button type="button" onClick={() => void perform(async () => {
            const result = await request("/models", "POST", payload());
            setModels(result.models);
            setNotice(result.models.length ? `${result.models.length} models found. Choose one in the model field.` : "No models found. Load a model in your server or enter its identifier.");
          })}>Load models</button>
        </div>
        <label style={fieldStyle}>Context budget (tokens)<input style={inputStyle} type="number" min={512} max={131072} step={256} value={draft.contextBudget} onChange={event => setDraft(value => ({ ...value, contextBudget: Number(event.target.value) }))} /></label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={() => void perform(async () => {
            const result = await request("", "POST", payload());
            setDraft(value => ({ ...value, apiKey: "", clearApiKey: false }));
            await reload(result.profile.id);
            setNotice("Connection saved. Use ‘Make active’ to select it for new requests.");
          })}>Save connection</button>
          <button type="button" onClick={() => void perform(async () => { await request("/test", "POST", payload()); setNotice("Connected successfully. The selected model answered the test."); })}>Test connection</button>
          {draft.id && draft.id !== activeId && <button type="button" onClick={() => void perform(async () => { await request("", "PATCH", { activeProfileId: draft.id }); await reload(); setNotice("Connection activated for new requests. Unsaved edits have not been applied."); })}>Make active</button>}
          {draft.id && draft.id !== activeId && <button type="button" onClick={() => void perform(async () => { await request("", "DELETE", { id: draft.id }); await reload(activeId); setNotice("Connection deleted."); })}>Delete connection</button>}
        </div>
      </fieldset>
      {busy && <p role="status">Working…</p>}
      <p className="muted">Testing sends one short request to the selected service and may use provider credit. Saving a connection does not activate it.</p>
      <p className="muted">On Android, localhost means your phone. To reach Ollama or LM Studio on a computer, use that computer’s network address and enable access in the model server.</p>
      <p className="muted">API keys are excluded from application backups and never displayed after saving.</p>
    </>}
  </section>;
}
