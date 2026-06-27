# gnome-oracle
The Oracle of Truth

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
