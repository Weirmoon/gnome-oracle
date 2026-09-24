use tauri::AppHandle;

#[tauri::command]
pub async fn export_file(app: AppHandle, filename: String, bytes: Vec<u8>, mime: String) -> Result<(), String> {
    if filename.is_empty() || filename.contains(['/', '\\']) || filename == "." || filename == ".." || bytes.len() > 100 * 1024 * 1024 { return Err("Invalid export filename or oversized file".into()); }
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let directory = app.path().app_cache_dir().map_err(|_| "Export directory unavailable")?.join("shared");
        std::fs::create_dir_all(&directory).map_err(|_| "Could not prepare export directory")?;
        let path = directory.join(&filename);
        std::fs::write(&path, bytes).map_err(|_| "Could not write export")?;
        tauri_plugin_gnome_mobile::share_file(&app, &path.to_string_lossy(), &mime)
    }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_dialog::DialogExt;
        let _ = mime;
        let (sender, receiver) = tokio::sync::oneshot::channel();
        app.dialog().file().set_file_name(&filename).save_file(move |path| { let _ = sender.send(path); });
        if let Some(path) = receiver.await.map_err(|_| "Save dialog closed")? {
            let path = path.into_path().map_err(|_| "Choose a local file location")?;
            std::fs::write(path, bytes).map_err(|_| "Could not write the exported file")?;
        }
        Ok(())
    }
}
#[tauri::command]
pub async fn native_speak(app: AppHandle, text: String, rate: f64, pitch: f64, volume: f64) -> Result<(), String> {
    #[cfg(target_os = "android")]
    { tauri::async_runtime::spawn_blocking(move || tauri_plugin_gnome_mobile::speak(&app, &text, rate, pitch, volume)).await.map_err(|_| "Speech service unavailable")? }
    #[cfg(not(target_os = "android"))]
    { let _ = (app, text, rate, pitch, volume); Err("Use system browser speech on this platform".into()) }
}
#[tauri::command]
pub async fn native_speech_cancel(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    { tauri_plugin_gnome_mobile::cancel_speech(&app) }
    #[cfg(not(target_os = "android"))]
    { let _ = app; Ok(()) }
}
