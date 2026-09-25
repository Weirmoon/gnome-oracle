/**
 * Server-only control of a local SearXNG instance. Turning search on starts
 * SearXNG and turning it off stops it, so it only uses memory while wanted.
 *
 * SEARXNG_CONTROL picks how; when unset it is detected in this order:
 *  - "systemd": `systemctl start|stop gnome-searxng` (servers; see deploy/install-linux.sh,
 *               which grants this app's user permission for that one unit via polkit)
 *  - "docker":  runs/starts/stops a `gnome-searxng` container directly (dev machines)
 *  - "none":    search is unavailable, and the status says how to set it up
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SearchResult } from "./format";

export type SearchState = "stopped" | "starting" | "running" | "stopping" | "error";
export interface SearchStatus { available: boolean; enabled: boolean; state: SearchState; error?: string; reason?: string }

type Control = "docker" | "systemd" | "none";
const NOT_INSTALLED = "SearXNG isn't set up on this server. On Linux, re-run deploy/install-linux.sh to add it; on another machine, install Docker.";
const URL_BASE = (process.env.SEARXNG_URL || "http://127.0.0.1:8888").replace(/\/+$/, "");
const CONTAINER = "gnome-searxng";
const UNIT = "gnome-searxng";
const IMAGE = process.env.SEARXNG_IMAGE || "searxng/searxng:latest";
const dataDir = () => process.env.GNOME_DATA_DIR || path.join(process.cwd(), "data");
const statePath = () => path.join(dataDir(), "search.json");

// One state per process: Next.js gives each route its own module copy (and dev
// reloads reset them), so the in-flight start/stop must live on globalThis.
interface Shared { state: SearchState; lastError?: string; transition: Promise<void> | null; reconciled: boolean; control?: Promise<Control> }
const shared: Shared = ((globalThis as { __gnomeSearch?: Shared }).__gnomeSearch ??= { state: "stopped", transition: null, reconciled: false });

function run(file: string, args: string[], timeout = 15 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") reject(new Error(`${file} isn't installed or isn't on this service's PATH. ${NOT_INSTALLED}`));
      else if (error) reject(new Error((stderr || error.message).trim().split("\n").pop() || "Command failed."));
      else resolve(stdout.trim());
    });
  });
}

/** Honour SEARXNG_CONTROL, else use whatever is actually installed. */
function detectControl(): Promise<Control> {
  shared.control ??= (async (): Promise<Control> => {
    const chosen = process.env.SEARXNG_CONTROL;
    if (chosen === "docker" || chosen === "systemd" || chosen === "none") return chosen;
    if (process.platform === "linux" && await run("systemctl", ["cat", `${UNIT}.service`], 10_000).then(() => true, () => false)) return "systemd";
    if (await run("docker", ["--version"], 10_000).then(() => true, () => false)) return "docker";
    return "none";
  })();
  return shared.control;
}

function readEnabled(): boolean {
  try { return JSON.parse(fs.readFileSync(statePath(), "utf8")).enabled === true; } catch { return false; }
}

function writeEnabled(enabled: boolean) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify({ enabled }, null, 2));
}

/** Docker mode keeps SearXNG's config beside the app data; JSON output must be enabled. */
function ensureDockerSettings(): string {
  const dir = path.join(dataDir(), "searxng");
  const file = path.join(dir, "settings.yml");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, [
      "use_default_settings: true",
      "server:",
      `  secret_key: "${randomBytes(32).toString("hex")}"`,
      "  limiter: false",
      "  image_proxy: false",
      "  public_instance: false",
      "search:",
      "  safe_search: 1",
      "  formats:",
      "    - html",
      "    - json",
      "",
    ].join("\n"));
  }
  return dir;
}

async function isRunning(): Promise<boolean> {
  const CONTROL = await detectControl();
  if (CONTROL === "docker") return (await run("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], 20_000).catch(() => "false")) === "true";
  if (CONTROL === "systemd") return (await run("systemctl", ["is-active", UNIT], 20_000).catch(() => "inactive")) === "active";
  return false;
}

async function healthy(): Promise<boolean> {
  try { return (await fetch(`${URL_BASE}/healthz`, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; }
}

async function startService() {
  if (await detectControl() === "docker") {
    const exists = await run("docker", ["inspect", CONTAINER], 20_000).then(() => true, () => false);
    if (exists) await run("docker", ["start", CONTAINER]);
    else {
      const port = new URL(URL_BASE).port || "8888";
      await run("docker", ["run", "-d", "--name", CONTAINER, "-p", `127.0.0.1:${port}:8080`,
        "-v", `${ensureDockerSettings()}:/etc/searxng`, "-e", `SEARXNG_BASE_URL=${URL_BASE}/`, IMAGE]);
    }
  } else await run("systemctl", ["start", UNIT], 120_000);
  // The first start may include an image download; wait for SearXNG to answer.
  for (let i = 0; i < 90; i++) {
    if (await healthy()) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("SearXNG started but did not become ready within 90 seconds.");
}

async function stopService() {
  if (await detectControl() === "docker") await run("docker", ["stop", "-t", "5", CONTAINER]).catch(async error => { if (await isRunning()) throw error; });
  else await run("systemctl", ["stop", UNIT], 60_000);
}

function begin(next: "starting" | "stopping", work: () => Promise<void>) {
  shared.state = next; shared.lastError = undefined;
  const task: Promise<void> = work().then(
    () => { shared.state = next === "starting" ? "running" : "stopped"; },
    (error: Error) => { shared.state = "error"; shared.lastError = error.message; },
  ).finally(() => { if (shared.transition === task) shared.transition = null; });
  shared.transition = task;
}

/** Bring the service in line with the saved switch once per process (e.g. after a restart). */
async function reconcile() {
  if (shared.reconciled || await detectControl() === "none") return;
  shared.reconciled = true;
  const running = await isRunning();
  if (shared.transition) return;
  shared.state = running ? "running" : "stopped";
  if (readEnabled() && !running) begin("starting", startService);
}

export async function searchStatus(): Promise<SearchStatus> {
  if (await detectControl() === "none") return { available: false, enabled: readEnabled(), state: "stopped", reason: NOT_INSTALLED };
  await reconcile();
  // When nothing is in flight, report what is really running (it may have been stopped outside the app).
  if (!shared.transition && shared.state !== "error") shared.state = await isRunning() ? "running" : "stopped";
  return { available: true, enabled: readEnabled(), state: shared.state, ...(shared.lastError ? { error: shared.lastError } : {}) };
}

/** Turn search on or off; the service start/stop continues in the background. */
export async function setSearchEnabled(enabled: boolean): Promise<SearchStatus> {
  if (await detectControl() === "none") throw new Error(NOT_INSTALLED);
  await reconcile();
  await shared.transition?.catch(() => {});
  writeEnabled(enabled);
  const running = await isRunning();
  if (enabled && !running) begin("starting", startService);
  if (!enabled && running) begin("stopping", stopService);
  return searchStatus();
}

/** Top results for a question, or none when search is off, still starting, or failing. */
export async function webSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!readEnabled() || await detectControl() === "none") return [];
  await reconcile();
  if (shared.transition) return [];
  const url = `${URL_BASE}/search?${new URLSearchParams({ q: query.slice(0, 300), format: "json", safesearch: "1" })}`;
  try {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000) });
    if (!response.ok) return [];
    const data: any = await response.json();
    return (Array.isArray(data?.results) ? data.results : [])
      .filter((r: any) => typeof r?.url === "string" && /^https?:\/\//.test(r.url) && typeof r?.title === "string")
      .slice(0, 4)
      .map((r: any) => ({ title: String(r.title).slice(0, 150), url: String(r.url), snippet: String(r.content ?? "").replace(/\s+/g, " ").slice(0, 300) }));
  } catch { return []; }
}
