/** Platform boundary: shared screens never need a local web server. */
export function isNative(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isNative()) return fetch(input, init);
  const url = input instanceof Request ? input.url : String(input);
  const parsed = new URL(url, window.location.origin);
  if (!parsed.pathname.startsWith("/api/")) return fetch(input, init);
  const { nativeFetch } = await import("./native-routes");
  const request = input instanceof Request ? input : undefined;
  const normalized = request ? { method: request.method, headers: request.headers, signal: request.signal, body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(), ...init } : init;
  return nativeFetch(parsed.pathname + parsed.search, normalized ?? {});
}

export async function exportFile(filename: string, data: Blob): Promise<void> {
  if (isNative()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("export_file", { filename, bytes: Array.from(new Uint8Array(await data.arrayBuffer())), mime: data.type || "application/octet-stream" });
    return;
  }
  const href = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = href; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}

export function hasNativeTts(): boolean { return isNative() && /Android/i.test(navigator.userAgent); }
export async function ttsSpeak(text: string, voice: { rate: number; pitch: number }, volume = 1): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("native_speak", { text, rate: voice.rate, pitch: voice.pitch, volume });
}
export async function ttsCancel(): Promise<void> {
  if (!hasNativeTts()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("native_speech_cancel");
}
