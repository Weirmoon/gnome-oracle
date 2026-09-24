fn main() {
    // No JavaScript permissions are generated. Secrets are called only from Rust.
    tauri_plugin::Builder::new(&[]).android_path("android").build();
}
