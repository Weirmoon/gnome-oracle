# gnome-oracle
The Oracle of Truth

## The avatar

The on-screen oracle is procedural — no art assets. `components/oracle/OracleAvatar`
picks the renderer at runtime:

- **3D** (default on capable devices): a faceted "crystal gnome" built from
  Three.js primitives via `@react-three/fiber`, re-skinned per persona. It reacts
  while answering — a *thinking* beat, viseme-ish lip-sync (browser TTS word
  boundaries), punctuation-driven gestures, and a held-item-specific finish
  flourish. `three` is lazy-loaded, so it never touches the initial page bundle.
- **2D** (`components/OracleCanvas`): the original hand-drawn `<canvas>`. Used
  automatically on `prefers-reduced-motion`, when WebGL is unavailable, on
  low-memory phones, or when picked in **⚙️ Settings → Avatar**.

Settings also expose a **High / Low** quality tier (Low drops crystal
transmission, MSAA, and DPR for weak GPUs).

## Windows 11

This repo supports staying on Node 24 on Windows 11. If `better-sqlite3`
needs to build from source, the PowerShell installer will now install Python and
the Visual Studio C++ build tools automatically before retrying the build.

## Linux deployment

On Debian/Ubuntu servers, run:

```bash
sudo SERVER_NAME=your.domain.com bash deploy/install-linux.sh
```

The script will:

- install OS packages for Node.js, nginx, and native module builds
- install `python3` as a build-time dependency for native Node modules
- install a recent Node.js runtime if the server does not already have one
- build the app in standalone mode
- install and start a systemd service
- configure nginx to proxy `http://your.domain.com` to the app
- install and start Ollama if it is missing, then pull the default model

If you want the app on a non-default port or with a different model, set `PORT`,
`OLLAMA_MODEL`, or `OLLAMA_URL` before running the script.

## AI connections

The web app starts with Ollama using `OLLAMA_URL`, `OLLAMA_MODEL`, and
`OLLAMA_NUM_CTX`. The Settings panel can also manage OpenRouter, LM Studio, and
any OpenAI-compatible chat-completions endpoint. Those settings are protected
by a password, **`Gnome` by default**. Anyone who knows the default can switch or
download models, so on a server reachable by others set `GNOME_ADMIN_TOKEN` to
your own password (a long random value is safest); Settings warns while the
default is in use. Set `GNOME_DEPLOYMENT_SECRET` to a different persistent secret
of at least 32 characters before saving API keys, which it encrypts. Provider
keys never enter history or backups.

### Choosing a model

The default is `qwen3:4b-instruct`, which fits a 6 GB CPU-only server with the context
at 4096. Settings → AI connections lists recommended small models and can
download them (Ollama only). Models marked 🧠 can **think**: turn on "Let the
oracle think before answering" and the reasoning stays hidden under a
"The oracle ponders…" hint that can be expanded. Critter quips never think.

| Model | Size | RAM needed | Notes |
|---|---|---|---|
| `qwen3:4b-instruct` | 2.5 GB | ~5 GB | Default; best persona voice and snappiest quips (not plain `qwen3:4b`, which leaks its reasoning) |
| `gemma3:4b` | 3.3 GB | ~5 GB | Just as good an all-rounder |
| `qwen3:1.7b` 🧠 | 1.4 GB | ~3 GB | Best small pick; accurate, thinks natively |
| `phi4-mini` | 2.5 GB | ~4 GB | Great short quips; weak at maths |
| `gemma3:1b` | 0.8 GB | ~2 GB | Fastest; gets facts wrong |
| `gemma4:e4b` 🧠 | 9.6 GB | ~10 GB | Best quality tested, if you add RAM |

Any model can use "Let the oracle think": models without 🧠 work the answer
out step by step in a separate pass first. **Serious mode** (a switch next to
Response style) lowers the temperature, puts accuracy first, and always works
answers out; it's off by default so the jokes stay at full strength.

The Performance section sets the context budget, reply length, how long the
model stays loaded (reloading is the slowest step on CPU), and CPU threads.
`deploy/install-linux.sh` also tunes Ollama for small servers (one parallel
slot, one loaded model, flash attention, and a q8_0 KV cache); set
`SKIP_OLLAMA_TUNING=1` to skip that.

### Web search

Settings → AI connections → "Look things up on the web" turns on a local
[SearXNG](https://docs.searxng.org/) search. Turning it on starts SearXNG
(about 200 MB of RAM); turning it off stops it. While it's on, each question
(not critter quips) is searched first, the top results are given to the model,
and the answer shows its sources. `deploy/install-linux.sh` installs it as a
Docker container behind a `gnome-searxng` systemd unit that the app may start
and stop (and nothing else). Set `SKIP_SEARXNG=1` to leave it out. On a dev
machine with Docker, the app runs the container itself (`SEARXNG_CONTROL=docker`,
the default).

For installed Windows, Linux, and Android builds, see
[README-NATIVE.md](README-NATIVE.md). Android `localhost` means the phone, so a
model server on a computer must be configured with that computer's LAN address.
