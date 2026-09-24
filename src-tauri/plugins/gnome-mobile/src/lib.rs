use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
#[cfg(target_os = "android")]
use tauri::{Manager, AppHandle, plugin::PluginHandle};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("gnome-mobile").setup(|_app, _api| {
        #[cfg(target_os = "android")]
        {
            let handle = _api.register_android_plugin("com.weirmoon.gnomemobile", "GnomeMobilePlugin")?;
            _app.manage(Mobile(handle));
        }
        Ok(())
    }).build()
}
#[cfg(target_os = "android")]
struct Mobile<R: Runtime>(PluginHandle<R>);
#[cfg(target_os = "android")]
fn call(app: &AppHandle, command: &str, payload: serde_json::Value) -> Result<serde_json::Value, String> {
    app.state::<Mobile<tauri::Wry>>().0.run_mobile_plugin(command, payload).map_err(|_| "Android service unavailable; check device settings and try again".into())
}
#[cfg(target_os = "android")]
pub fn secret_get(app: &AppHandle, id: &str) -> Result<Option<String>, String> {
    let value = call(app, "secretGet", serde_json::json!({"id":id}))?;
    Ok(value.get("value").and_then(|v| v.as_str()).map(String::from))
}
#[cfg(target_os = "android")]
pub fn secret_set(app: &AppHandle, id: &str, key: Option<&str>) -> Result<(), String> {
    call(app, "secretSet", serde_json::json!({"id":id,"value":key})).map(|_| ())
}
#[cfg(target_os = "android")]
pub fn share_file(app: &AppHandle, path: &str, mime: &str) -> Result<(), String> {
    call(app, "shareFile", serde_json::json!({"path":path,"mime":mime})).map(|_| ())
}
#[cfg(target_os = "android")]
pub fn speak(app: &AppHandle, text: &str, rate: f64, pitch: f64, volume: f64) -> Result<(), String> {
    call(app, "speak", serde_json::json!({"text":text,"rate":rate,"pitch":pitch,"volume":volume})).map(|_| ())
}
#[cfg(target_os = "android")]
pub fn cancel_speech(app: &AppHandle) -> Result<(), String> {
    call(app, "cancelSpeech", serde_json::json!({})).map(|_| ())
}
