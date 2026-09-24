# Installed Gnome Oracle builds

The native shell is Tauri 2. It uses the same React screens as the website, but
stores history and custom personas in an app-local SQLite database. Credentials
are kept by the Windows/Linux credential store or Android Keystore and are not
included in backups.

```powershell
npm run native:dev
npm run tauri -- dev
npm run tauri -- build --bundles nsis
```

On Linux, use `npm run tauri -- build --bundles appimage,deb`. Android requires
Java 17, the Android SDK/NDK, and a connected emulator or device. The Android
Emulator can be launched with the `gnome-oracle-api35` AVD when it is installed.
`npm run tauri -- android build --apk` produces an APK for local installation;
add `--debug --target aarch64` for a debug-signed ARM64 build. The repository
workflow builds Windows, Linux, and Android artifacts on tag pushes or manual
dispatch.

When using a model server from Android, `127.0.0.1` is the phone. Enter the
computer's LAN address in the provider profile and enable LAN access in Ollama
or LM Studio. The installed app does not bundle a model.

The web deployment retains its server-side provider settings. Set
`GNOME_ADMIN_TOKEN` and `GNOME_DEPLOYMENT_SECRET` to different persistent values
of at least 32 characters before managing saved connections. The deployment
secret encrypts web API keys; changing it requires entering those keys again.
