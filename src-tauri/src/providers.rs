use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, State, ipc::Channel};
use tokio_util::sync::CancellationToken;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    id: String, name: String, kind: String, base_url: String, model: String,
    #[serde(default = "default_budget")] context_budget: u32,
    #[serde(default)] has_api_key: bool,
}
fn default_budget() -> u32 { 12000 }
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Profiles { profiles: Vec<Profile>, active_profile_id: Option<String> }
#[derive(Clone)]
struct Snapshot { profile: Profile, key: Option<String>, created: Instant }
pub struct ProviderState {
    directory: PathBuf, profiles: Mutex<Profiles>, snapshots: Mutex<HashMap<String, Snapshot>>,
    requests: Mutex<HashMap<String, CancellationToken>>, client: reqwest::Client,
}
impl ProviderState {
    pub fn open(directory: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let path = directory.join("providers.json");
        let profiles = if path.exists() { serde_json::from_slice(&std::fs::read(path)?)? } else { Profiles { profiles: vec![Profile { id: "ollama-default".into(), name: "Local Ollama".into(), kind: "ollama".into(), base_url: "http://127.0.0.1:11434".into(), model: "gemma2:2b".into(), context_budget: 8192, has_api_key: false }], active_profile_id: Some("ollama-default".into()) } };
        Ok(Self { directory, profiles: Mutex::new(profiles), snapshots: Mutex::default(), requests: Mutex::default(),
            client: reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(15)).timeout(Duration::from_secs(600)).build()? })
    }
    fn persist(&self, profiles: &Profiles) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(profiles).map_err(|_| "Could not encode profiles")?;
        let temporary = self.directory.join("providers.pending.json");
        std::fs::write(&temporary, bytes).map_err(|_| "Could not save connection profiles")?;
        std::fs::rename(temporary, self.directory.join("providers.json")).map_err(|_| "Could not replace connection profiles".to_string())
    }
}
fn secret_get(app: &AppHandle, id: &str) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    { tauri_plugin_gnome_mobile::secret_get(app, id) }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let entry = keyring::Entry::new("com.weirmoon.gnomeoracle", id).map_err(|_| "Credential store unavailable")?;
        match entry.get_password() { Ok(key) => Ok(Some(key)), Err(keyring::Error::NoEntry) => Ok(None), Err(_) => Err("Unlock the operating system credential store and try again".into()) }
    }
}
fn secret_set(app: &AppHandle, id: &str, key: Option<&str>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    { tauri_plugin_gnome_mobile::secret_set(app, id, key) }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let entry = keyring::Entry::new("com.weirmoon.gnomeoracle", id).map_err(|_| "Credential store unavailable")?;
        match key {
            Some(value) => entry.set_password(value).map_err(|_| "Could not save the API key in the operating system credential store".into()),
            None => match entry.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(_) => Err("Could not remove the saved API key".into()) },
        }
    }
}
fn parse_profile(raw: &Value, existing: Option<&Profile>) -> Result<Profile, String> {
    let value = |key: &str| raw.get(key).and_then(Value::as_str).unwrap_or("").trim().to_string();
    let kind = value("kind");
    if !["ollama", "openrouter", "lmstudio", "openai-compatible"].contains(&kind.as_str()) { return Err("Choose a supported provider type".into()); }
    let mut url = reqwest::Url::parse(&value("baseUrl")).map_err(|_| "Enter a valid HTTP or HTTPS base URL")?;
    if !["http", "https"].contains(&url.scheme()) || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() { return Err("Use an HTTP or HTTPS base URL without credentials, query, or fragment".into()); }
    let trimmed = url.path().trim_end_matches('/').to_string(); url.set_path(&trimmed);
    let name = value("name"); let model = value("model");
    if name.is_empty() || name.len() > 100 || model.len() > 300 { return Err("Enter a profile name (up to 100 characters) and valid model".into()); }
    Ok(Profile { id: existing.map(|p| p.id.clone()).unwrap_or_else(|| uuid::Uuid::new_v4().to_string()), name, kind, base_url: url.as_str().trim_end_matches('/').to_string(), model,
        context_budget: raw.get("contextBudget").and_then(Value::as_u64).unwrap_or(12000).clamp(1000, 128000) as u32,
        has_api_key: existing.map(|p| p.has_api_key).unwrap_or(false) })
}
#[tauri::command]
pub fn provider_list(state: State<'_, ProviderState>) -> Result<Value, String> {
    serde_json::to_value(&*state.profiles.lock().map_err(|_| "Profiles unavailable")?).map_err(|_| "Could not read profiles".into())
}
#[tauri::command]
pub fn provider_save(app: AppHandle, state: State<'_, ProviderState>, profile: Value) -> Result<Value, String> {
    let mut saved = state.profiles.lock().map_err(|_| "Profiles unavailable")?;
    let existing = profile.get("id").and_then(Value::as_str).and_then(|id| saved.profiles.iter().find(|p| p.id == id));
    let mut parsed = parse_profile(&profile, existing)?;
    let clear = profile.get("clearApiKey").and_then(Value::as_bool).unwrap_or(false);
    let new_key = profile.get("apiKey").and_then(Value::as_str).filter(|key| !key.is_empty());
    if let Some(key) = new_key {
        if key.len() > 8192 { return Err("API key is too long".into()); }
        secret_set(&app, &parsed.id, Some(key))?; parsed.has_api_key = true;
    } else if clear { secret_set(&app, &parsed.id, None)?; parsed.has_api_key = false; }
    let mut updated = saved.clone();
    updated.profiles.retain(|p| p.id != parsed.id); updated.profiles.push(parsed.clone());
    state.persist(&updated)?; *saved = updated;
    Ok(json!({ "profile": parsed }))
}
#[tauri::command]
pub fn provider_activate(state: State<'_, ProviderState>, id: String) -> Result<(), String> {
    let mut saved = state.profiles.lock().map_err(|_| "Profiles unavailable")?;
    let profile = saved.profiles.iter().find(|p| p.id == id).ok_or("Profile not found")?;
    if profile.model.is_empty() { return Err("Select a model before activating this profile".into()); }
    let mut updated = saved.clone(); updated.active_profile_id = Some(id); state.persist(&updated)?; *saved = updated; Ok(())
}
#[tauri::command]
pub fn provider_delete(app: AppHandle, state: State<'_, ProviderState>, id: String) -> Result<(), String> {
    let mut saved = state.profiles.lock().map_err(|_| "Profiles unavailable")?;
    if saved.active_profile_id.as_ref() == Some(&id) { return Err("Activate another connection before deleting this one".into()); }
    if let Some(profile) = saved.profiles.iter().find(|p| p.id == id) { if profile.has_api_key { secret_set(&app, &id, None)?; } }
    let mut updated = saved.clone(); updated.profiles.retain(|p| p.id != id);
    state.persist(&updated)?; *saved = updated; Ok(())
}
#[tauri::command]
pub fn provider_snapshot(app: AppHandle, state: State<'_, ProviderState>, profile_id: Option<String>, draft: Option<Value>) -> Result<Value, String> {
    let saved = state.profiles.lock().map_err(|_| "Profiles unavailable")?;
    let id = draft.as_ref().and_then(|d| d.get("id")).and_then(Value::as_str).map(String::from).or(profile_id).or(saved.active_profile_id.clone());
    let existing = id.as_ref().and_then(|id| saved.profiles.iter().find(|p| &p.id == id));
    let profile = match &draft { Some(value) => parse_profile(value, existing)?, None => existing.cloned().ok_or("Open Settings and activate an AI connection first")? };
    let clear = draft.as_ref().and_then(|d| d.get("clearApiKey")).and_then(Value::as_bool).unwrap_or(false);
    let new_key = draft.as_ref().and_then(|d| d.get("apiKey")).and_then(Value::as_str).filter(|k| !k.is_empty()).map(String::from);
    let key = if new_key.is_some() { new_key } else if !clear && profile.has_api_key { secret_get(&app, &profile.id)? } else { None };
    let token = uuid::Uuid::new_v4().to_string();
    let mut snapshots = state.snapshots.lock().map_err(|_| "Connection unavailable")?;
    snapshots.retain(|_, s| s.created.elapsed() < Duration::from_secs(3600));
    if snapshots.len() >= 128 { if let Some(oldest) = snapshots.iter().min_by_key(|(_, s)| s.created).map(|(key, _)| key.clone()) { snapshots.remove(&oldest); } }
    snapshots.insert(token.clone(), Snapshot { profile: profile.clone(), key, created: Instant::now() });
    Ok(json!({ "profile": profile, "token": token }))
}
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HttpEvent { Headers { status: u16 }, Chunk { bytes: Vec<u8> } }
#[tauri::command]
pub async fn provider_http(state: State<'_, ProviderState>, token: String, operation: String, body: Option<Value>, request_id: String, channel: Channel<HttpEvent>) -> Result<(), String> {
    let snapshot = state.snapshots.lock().map_err(|_| "Connection unavailable")?.get(&token).cloned().ok_or("Connection expired; retry the request")?;
    let cancellation = CancellationToken::new();
    state.requests.lock().map_err(|_| "Connection unavailable")?.insert(request_id.clone(), cancellation.clone());
    let result = async {
        let suffix = match (operation.as_str(), snapshot.profile.kind.as_str()) { ("models", "ollama") => "/api/tags", ("models", _) => "/models", ("chat", "ollama") => "/api/chat", ("chat", _) => "/chat/completions", _ => return Err("Unsupported provider operation".to_string()) };
        let url = format!("{}{}", snapshot.profile.base_url.trim_end_matches('/'), suffix);
        let mut request = if operation == "models" { state.client.get(url) } else {
            let mut body = body.ok_or("Missing chat request")?;
            body["model"] = Value::String(snapshot.profile.model.clone());
            state.client.post(url).json(&body)
        };
        if let Some(key) = snapshot.key { request = request.bearer_auth(key); }
        let response = tokio::select! {
            _ = cancellation.cancelled() => return Err("Request cancelled".to_string()),
            response = request.send() => response.map_err(|_| "Could not reach this provider. Check the base URL, server, and network connection")?,
        };
        channel.send(HttpEvent::Headers { status: response.status().as_u16() }).map_err(|_| "Response receiver closed")?;
        if !response.status().is_success() { return Ok(()); } // Do not forward provider error bodies that could echo secrets.
        let mut stream = response.bytes_stream();
        loop {
            tokio::select! {
                _ = cancellation.cancelled() => return Err("Request cancelled".to_string()),
                next = stream.next() => match next {
                    Some(Ok(bytes)) => channel.send(HttpEvent::Chunk { bytes: bytes.to_vec() }).map_err(|_| "Response receiver closed")?,
                    Some(Err(_)) => return Err("The provider connection closed unexpectedly".to_string()),
                    None => break,
                }
            }
        }
        Ok(())
    }.await;
    state.requests.lock().map_err(|_| "Connection unavailable")?.remove(&request_id);
    result
}
#[tauri::command]
pub fn provider_cancel(state: State<'_, ProviderState>, request_id: String) {
    if let Ok(requests) = state.requests.lock() { if let Some(request) = requests.get(&request_id) { request.cancel(); } }
}
