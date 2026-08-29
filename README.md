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
