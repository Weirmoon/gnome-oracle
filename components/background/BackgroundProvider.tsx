"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { BACKGROUND_CHANGE_EVENT, BACKGROUND_STORAGE_KEY, defaultBackgroundDocument, parseBackgroundDocument, parseBackgroundFile, type BackgroundConfig, type BackgroundDocument } from "@/lib/background";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { apiFetch } from "@/lib/platform/client";

type BackgroundContextValue = {
  document: BackgroundDocument;
  ready: boolean;
  error: string;
  setConfig: (config: BackgroundConfig) => void;
  replaceDocument: (document: BackgroundDocument) => void;
};

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

/** This contains visual preferences only; provider keys must never enter it. */
export function readBackgroundDocument(): BackgroundDocument | null {
  try {
    const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    return stored ? parseBackgroundFile(stored) : null;
  } catch { return null; }
}

/** Used by backup restore as well as by the Studio; updates mounted canvases. */
export function restoreBackgroundDocument(value: unknown): void {
  const document = parseBackgroundDocument(value);
  localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(document));
  window.dispatchEvent(new CustomEvent(BACKGROUND_CHANGE_EVENT, { detail: document }));
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [document, setDocument] = useState<BackgroundDocument>(() => defaultBackgroundDocument(true));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    async function initialize() {
      let existing = false;
      try {
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key?.startsWith("gnome.") && key !== BACKGROUND_STORAGE_KEY) existing = true;
        }
        const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
        if (!stored && !existing) {
          try {
            const response = await apiFetch("/api/history?limit=1", { signal: controller.signal });
            if (response.ok) { const history: unknown = await response.json(); existing = Array.isArray(history) && history.length > 0; }
          } catch { /* Offline first launches can still choose and save a background. */ }
        }
        if (cancelled) return;
        // Another tab or an import may have supplied settings during the check.
        const latest = localStorage.getItem(BACKGROUND_STORAGE_KEY);
        const initial = latest ? parseBackgroundFile(latest) : defaultBackgroundDocument(existing);
        setDocument(initial);
        localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(initial));
      } catch {
        if (cancelled) return;
        setError("Your background could not be loaded or saved. Changes will still work for this visit.");
        setDocument(defaultBackgroundDocument(existing));
      }
      if (!cancelled) setReady(true);
      clearTimeout(timeout);
    }
    void initialize();
    function synchronize(event: Event) {
      try {
        if (event instanceof StorageEvent && event.key !== BACKGROUND_STORAGE_KEY) return;
        const next = event instanceof CustomEvent ? parseBackgroundDocument(event.detail) : readBackgroundDocument();
        if (next) setDocument(next);
      } catch { setError("The restored background settings were not valid."); }
    }
    window.addEventListener("storage", synchronize);
    window.addEventListener(BACKGROUND_CHANGE_EVENT, synchronize);
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); window.removeEventListener("storage", synchronize); window.removeEventListener(BACKGROUND_CHANGE_EVENT, synchronize); };
  }, []);

  const replaceDocument = useCallback((next: BackgroundDocument) => {
    const valid = parseBackgroundDocument(next);
    setDocument(valid);
    try { localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(valid)); setError(""); }
    catch { setError("Storage is unavailable. Your background changes will last for this visit."); }
  }, []);
  const setConfig = useCallback((config: BackgroundConfig) => replaceDocument({ ...document, config }), [document, replaceDocument]);
  const original = document.config.effect === "gradient";
  const gradient = original
    ? `radial-gradient(1200px 800px at 50% -10%, ${document.config.accentColor}, ${document.config.backgroundColor})`
    : `radial-gradient(ellipse at 50% 0%, ${document.config.accentColor}0d, transparent 70%)`;

  return <BackgroundContext.Provider value={{ document, ready, error, setConfig, replaceDocument }}>
    <div className="background-world" data-effect={document.config.effect} style={{ backgroundColor: document.config.backgroundColor, backgroundImage: gradient }} aria-hidden="true">
      {ready && <BackgroundCanvas config={document.config} />}
    </div>
    <div className="background-content" data-animated-background={!original}>{children}</div>
  </BackgroundContext.Provider>;
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (!context) throw new Error("Background settings require BackgroundProvider.");
  return context;
}
