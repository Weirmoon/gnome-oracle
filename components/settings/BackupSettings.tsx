"use client";
import { useState } from "react";
import { apiFetch, exportFile } from "@/lib/platform/client";
export default function BackupSettings() {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function backup() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/backup"); const data = await res.json(); if (!res.ok) throw new Error(data.error);
      // Only visual preferences are included; never provider/admin credentials.
      data.visualPreferences = Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith("gnome.background")).map(k => [k, localStorage.getItem(k)]));
      await exportFile("gnome-oracle-backup.json", new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); setMessage("Backup exported. Credentials are excluded.");
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function restore(file: File) {
    setBusy(true);
    try {
      if (file.size > 12_000_000) throw new Error("Backup exceeds 12 MB.");
      const data = JSON.parse(await file.text());
      const res = await apiFetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).error);
      // Visual presets are validated by Background Studio when loaded.
      for (const [key, value] of Object.entries(data.visualPreferences ?? {})) if (key.startsWith("gnome.background") && typeof value === "string" && value.length < 200000) localStorage.setItem(key, value);
      setMessage("Imported as new records. Reload to use restored visual preferences.");
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="panel"><summary>Backup and restore</summary><p>Export characters, consultations, favorites, and background presets. Imports add new records; existing data remains.</p><div className="row"><button disabled={busy} onClick={backup}>Export backup</button><label className="field">Import backup<input type="file" accept="application/json,.json" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} /></label></div><p role="status">{message}</p></details>;
}
