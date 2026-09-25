"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/platform/client";
import { PROFILE_TUNING_DEFAULTS, PROVIDER_DEFAULTS, type ProviderKind, type ProviderModel, type ProviderProfile } from "@/lib/providers/types";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import SearchSettings from "./SearchSettings";
import ModelGuide from "./ModelGuide";
import type { ModelInfo, ModelSwitch, PullProgress } from "@/lib/providers/protocol";

type Draft = Omit<ProviderProfile, "id"> & { id?: string; apiKey: string; clearApiKey: boolean };
type Status = { configured: boolean; managementEnabled: boolean; defaultPassword?: boolean; native?: boolean; activeProfile?: Pick<ProviderProfile, "id" | "name" | "kind" | "model"> };
const blankProfile = (kind: ProviderKind = "ollama"): Draft => ({ ...PROVIDER_DEFAULTS[kind], ...PROFILE_TUNING_DEFAULTS, kind, contextBudget: 4096, hasApiKey: false, apiKey: "", clearApiKey: false });
type Pull = { model: string; status: string; completed?: number; total?: number; controller: AbortController };
const KEEP_ALIVE_CHOICES = [["5m", "5 minutes"], ["30m", "30 minutes"], ["2h", "2 hours"], ["-1", "Forever"]] as const;
const SPEED_LABEL = { fastest: "⚡⚡⚡", fast: "⚡⚡", moderate: "⚡" } as const;
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
  const [modelInfo, setModelInfo] = useState<(ModelInfo & { missing?: boolean }) | null>(null);
  const [pull, setPull] = useState<Pull | null>(null);
  const [activeModels, setActiveModels] = useState<ProviderModel[]>([]);
  // Credentials live only in this component’s memory, never browser storage.
  const adminToken = useRef("");
  const modelListId = useId();
  const native = status?.native === true;
  const ollama = draft.kind === "ollama";
  const installed = new Set(models.map(model => model.id));
  const canThink = modelInfo?.capabilities.includes("thinking") ?? false;
  const activeProfile = profiles.find(profile => profile.id === activeId);

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

  function describeSwitch(modelSwitch?: ModelSwitch): string {
    if (!modelSwitch) return "";
    const closed = modelSwitch.unloaded.length ? ` Closed ${modelSwitch.unloaded.join(", ")}.` : "";
    return `${closed}${modelSwitch.loading ? ` Loading ${modelSwitch.loading} in the background.` : ""}`;
  }

  /** Change only the active connection's model; every other setting carries over. */
  async function switchModel(model: string) {
    if (!activeProfile || model === activeProfile.model) return;
    await perform(async () => {
      const { hasApiKey: _hasApiKey, ...current } = activeProfile;
      const result = await request("", "POST", { profile: { ...current, model } });
      await reload(draft.id === current.id ? current.id : undefined);
      setNotice(`Now using ${model}.${describeSwitch(result.modelSwitch)}`);
    });
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

  // Ask Ollama what the chosen model can do, so Thinking is offered only when it works.
  useEffect(() => {
    setModelInfo(null);
    if (!unlocked || !ollama || !draft.model.trim()) return;
    const timer = setTimeout(() => {
      request("/show", "POST", { ...payload(), model: draft.model.trim() })
        .then(result => setModelInfo(result.info))
        .catch(() => setModelInfo({ capabilities: [], missing: true }));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, ollama, draft.model, draft.baseUrl]);

  // Models the quick switcher can offer: whatever the active connection has installed.
  useEffect(() => {
    if (!unlocked || !activeId) return;
    request("/models", "POST", { profileId: activeId }).then(result => setActiveModels(result.models)).catch(() => setActiveModels([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, activeId, activeProfile?.baseUrl, models.length]);

  // Know which recommended models are already installed without an extra click.
  useEffect(() => {
    if (!unlocked || !ollama) return;
    request("/models", "POST", payload()).then(result => setModels(result.models)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, ollama, draft.id, draft.baseUrl]);

  async function download(model: string) {
    const controller = new AbortController();
    setPull({ model, status: "starting", controller }); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/providers/pull", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(adminToken.current ? { Authorization: `Bearer ${adminToken.current}` } : {}) },
        body: JSON.stringify({ ...payload(), model }),
      });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error || "The download could not start.");
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = "", last: PullProgress | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const progress = JSON.parse(line) as PullProgress;
          if (progress.error) throw new Error(progress.error);
          last = progress;
          setPull(current => current && { ...current, status: progress.status, completed: progress.completed ?? current.completed, total: progress.total ?? current.total });
        }
        if (done) break;
      }
      if (last?.status !== "success") throw new Error("The download ended before it finished. Try again.");
      setModels((await request("/models", "POST", payload())).models);
      setNotice(`${model} is downloaded. Choose “Use”, then save the connection.`);
    } catch (value) {
      setError(controller.signal.aborted ? "Download cancelled." : value instanceof Error ? value.message : "The download failed.");
    } finally { setPull(null); }
  }

  return <section className="panel" aria-labelledby="provider-settings-title" style={{ marginTop: 18 }}>
    <h2 id="provider-settings-title">AI connections</h2>
    <p className="muted">Active: <strong>{status?.activeProfile ? `${status.activeProfile.name} · ${status.activeProfile.model}` : "Loading…"}</strong></p>
    <div style={{ marginBottom: 16 }}><ModelGuide selected={status?.activeProfile?.model ?? ""} /></div>
    {error && <p role="alert" style={{ color: "#ffb3b3" }}>{error}</p>}
    {notice && <p role="status" style={{ color: "var(--accent2)" }}>{notice}</p>}
    {!unlocked ? <div style={{ display: "grid", gap: 10 }}>
      {status?.defaultPassword && <p className="muted">The default password is <strong>Gnome</strong>. Change it by setting <code>GNOME_ADMIN_TOKEN</code> on the server.</p>}
      <label style={fieldStyle}>Password
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
      <details><summary>Server setup</summary><p>Set <code>GNOME_ADMIN_TOKEN</code> to change the password from the default (<strong>Gnome</strong>); a long random value is safest. Set <code>GNOME_DEPLOYMENT_SECRET</code> to a different secret of at least 32 characters before saving API keys. Keep the deployment secret stable to unlock saved API keys after a restart. Use HTTPS when accessing these settings over a network.</p></details>
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
      {activeProfile && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
        <label style={{ ...fieldStyle, flex: "1 1 220px" }}>Switch model
          <select aria-label="Switch the active model" value={activeProfile.model} disabled={busy || !!pull} onChange={event => void switchModel(event.target.value)} style={inputStyle}>
            {!activeModels.some(model => model.id === activeProfile.model) && <option value={activeProfile.model}>{activeProfile.model}</option>}
            {activeModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
        </label>
        <p className="muted" style={{ flex: "1 1 220px", margin: 0 }}>Applies immediately to {activeProfile.name}.{activeProfile.kind === "ollama" ? " The model that is loaded now is closed first to free memory." : ""}</p>
      </div>}
      {status?.defaultPassword && !native && <p role="alert" style={{ color: "#ffd9a0", marginTop: 0 }}>⚠️ You’re using the default password, <strong>Gnome</strong>. Anyone who can open this site can change models and download new ones. Set <code>GNOME_ADMIN_TOKEN</code> on the server to change it.</p>}
      <div style={{ marginBottom: 16 }}><SearchSettings adminToken={adminToken.current} /></div>
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
        {ollama && <details open={!draft.model}>
          <summary>Recommended small models</summary>
          <p className="muted">Sized for CPU-only servers. RAM figures include the app and a 4k context.</p>
          <div style={{ display: "grid" }}>{MODEL_CATALOG.map(model => {
            const active = pull?.model === model.id;
            const percent = active && pull?.total ? Math.round((pull.completed ?? 0) / pull.total * 100) : null;
            return <div key={model.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <strong>{model.label}</strong> <code>{model.id}</code>{installed.has(model.id) && <span title="Installed"> ✓</span>}
                <div className="muted" style={{ fontSize: "0.85em" }}>{model.sizeGb} GB · needs ~{model.minRamGb} GB RAM · {SPEED_LABEL[model.speed]}{model.thinking ? " · 🧠 thinks" : ""} · {model.note}</div>
                {active && <div role="status" style={{ fontSize: "0.85em" }}>
                  <progress max={100} value={percent ?? undefined} style={{ width: "100%" }} /> {pull?.status}{percent !== null ? ` · ${percent}%` : ""}
                </div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" disabled={draft.model === model.id} onClick={() => setDraft(value => ({ ...value, model: model.id }))}>{draft.model === model.id ? "Selected" : "Use"}</button>
                {active ? <button type="button" onClick={() => pull?.controller.abort()}>Cancel</button>
                  : !installed.has(model.id) && <button type="button" disabled={!!pull} onClick={() => void download(model.id)}>Download</button>}
              </div>
            </div>;
          })}</div>
        </details>}
        <div style={{ display: "grid", gap: 8 }}>
          <label><input type="checkbox" checked={draft.thinking === "on"} onChange={event => setDraft(value => ({ ...value, thinking: event.target.checked ? "on" : "off" }))} /> Let the oracle think before answering</label>
          <p className="muted" style={{ margin: 0 }}>{!ollama ? "Reasoning models think natively; others work the answer out step by step first."
            : !modelInfo ? "Checking what this model can do…"
            : modelInfo.missing ? "This model isn’t downloaded yet."
            : canThink ? "🧠 This model thinks natively."
            : "This model can’t think natively, so it first works the answer out step by step in a separate pass (roughly doubles the time)."}
            {" "}The working stays tucked away under “The oracle ponders”. Critter quips never think. Serious mode always works answers out.</p>
          {draft.thinking === "on" && <label style={fieldStyle}>Thinking budget (tokens)<input style={inputStyle} type="number" min={256} max={4096} step={128} value={draft.thinkingBudget} onChange={event => setDraft(value => ({ ...value, thinkingBudget: Number(event.target.value) }))} /></label>}
        </div>
        <details>
          <summary>Performance</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 14, marginTop: 10 }}>
            <label style={fieldStyle}>Context budget (tokens)<input style={inputStyle} type="number" min={512} max={131072} step={256} value={draft.contextBudget} onChange={event => setDraft(value => ({ ...value, contextBudget: Number(event.target.value) }))} /></label>
            <label style={fieldStyle}>Reply length (tokens)<input style={inputStyle} type="number" min={64} max={2048} step={32} value={draft.replyLength} onChange={event => setDraft(value => ({ ...value, replyLength: Number(event.target.value) }))} /></label>
            {ollama && <label style={fieldStyle}>Keep model loaded<select style={inputStyle} value={draft.keepAlive} onChange={event => setDraft(value => ({ ...value, keepAlive: event.target.value }))}>
              {KEEP_ALIVE_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              {!KEEP_ALIVE_CHOICES.some(([value]) => value === draft.keepAlive) && <option value={draft.keepAlive}>{draft.keepAlive}</option>}
            </select></label>}
            {ollama && <label style={fieldStyle}>CPU threads<input style={inputStyle} type="number" min={1} max={64} placeholder="Auto" value={draft.numThread ?? ""} onChange={event => setDraft(value => ({ ...value, numThread: event.target.value ? Number(event.target.value) : undefined }))} /></label>}
          </div>
          <p className="muted">On a 6 GB server, keep the context at 4096 or less. A smaller context is also faster on CPU. Keeping the model loaded avoids a slow reload after idle time.</p>
        </details>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={() => void perform(async () => {
            const result = await request("", "POST", payload());
            setDraft(value => ({ ...value, apiKey: "", clearApiKey: false }));
            await reload(result.profile.id);
            setNotice(result.profile.id === activeId
              ? `Connection saved and in use.${describeSwitch(result.modelSwitch)}`
              : "Connection saved. Use ‘Make active’ to select it for new requests.");
          })}>Save connection</button>
          <button type="button" onClick={() => void perform(async () => { await request("/test", "POST", payload()); setNotice("Connected successfully. The selected model answered the test."); })}>Test connection</button>
          {draft.id && draft.id !== activeId && <button type="button" onClick={() => void perform(async () => { const result = await request("", "PATCH", { activeProfileId: draft.id }); await reload(); setNotice(`Connection activated for new requests. Unsaved edits have not been applied.${describeSwitch(result.modelSwitch)}`); })}>Make active</button>}
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
