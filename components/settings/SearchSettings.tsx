"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/platform/client";
import type { SearchStatus } from "@/lib/search/searxng";

const STATE_TEXT: Record<SearchStatus["state"], string> = {
  stopped: "SearXNG is stopped and using no memory.",
  starting: "Starting SearXNG… The first start downloads it, which can take a few minutes.",
  running: "SearXNG is running (about 200 MB of RAM). Questions are looked up before the oracle answers.",
  stopping: "Stopping SearXNG…",
  error: "SearXNG hit a problem.",
};

/** Web search switch: turning it on starts SearXNG, turning it off stops it. */
export default function SearchSettings({ adminToken }: { adminToken: string }) {
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [error, setError] = useState("");
  const busy = status?.state === "starting" || status?.state === "stopping";

  async function refresh() {
    const response = await apiFetch("/api/search");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not read web search status.");
    setStatus(data);
  }

  useEffect(() => { refresh().catch(value => setError(value.message)); }, []);
  // Follow a start or stop until it settles.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => { refresh().catch(() => {}); }, 2000);
    return () => clearInterval(timer);
  }, [busy]);

  async function toggle(enabled: boolean) {
    setError("");
    try {
      const response = await apiFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}) },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not change web search.");
      setStatus(data);
    } catch (value) { setError(value instanceof Error ? value.message : "Could not change web search."); }
  }

  if (!status) return error ? <p role="alert" style={{ color: "#ffb3b3" }}>{error}</p> : null;
  if (!status.available) return <p className="muted">🔎 Web search: {status.reason ?? "not available on this server."}</p>;
  return <div style={{ display: "grid", gap: 6 }}>
    <label><input type="checkbox" checked={status.enabled} disabled={busy} onChange={event => void toggle(event.target.checked)} /> 🔎 Look things up on the web (SearXNG)</label>
    <p className="muted" role="status" style={{ margin: 0 }}>{STATE_TEXT[status.state]}{status.error ? ` ${status.error}` : ""} Critter quips never search.</p>
    {error && <p role="alert" style={{ color: "#ffb3b3", margin: 0 }}>{error}</p>}
  </div>;
}
