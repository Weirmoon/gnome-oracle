mod database;
mod providers;
mod platform;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_gnome_mobile::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            app.manage(database::DatabaseState::open(&directory.join("gnome.db"))?);
            app.manage(providers::ProviderState::open(directory)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            database::db_query, database::db_execute, database::db_exec,
            providers::provider_list, providers::provider_save, providers::provider_delete,
            providers::provider_activate, providers::provider_snapshot,
            providers::provider_http, providers::provider_cancel,
            platform::export_file, platform::native_speak, platform::native_speech_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("Could not start Gnome Oracle");
}
