use rusqlite::{Connection, types::Value as SqlValue, params_from_iter};
use serde_json::{Value, Map};
use std::{path::Path, sync::Mutex};
use tauri::State;

pub struct DatabaseState(Mutex<Connection>);
impl DatabaseState {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let connection = Connection::open(path)?;
        connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")?;
        Ok(Self(Mutex::new(connection)))
    }
}
fn parameters(values: Vec<Value>) -> Result<Vec<SqlValue>, String> {
    values.into_iter().map(|value| match value {
        Value::Null => Ok(SqlValue::Null),
        Value::Bool(value) => Ok(SqlValue::Integer(i64::from(value))),
        Value::Number(value) => value.as_i64().map(SqlValue::Integer).or_else(|| value.as_f64().map(SqlValue::Real)).ok_or("Invalid number".into()),
        Value::String(value) => Ok(SqlValue::Text(value)),
        _ => Err("SQL parameters must be scalar values".into()),
    }).collect()
}
// No filesystem, ATTACH, or extension loading is exposed through this boundary.
fn validate(sql: &str) -> Result<(), String> {
    let upper = sql.to_uppercase();
    if upper.contains("ATTACH") || upper.contains("DETACH") || upper.contains("LOAD_EXTENSION") || upper.contains("VACUUM INTO") {
        Err("That SQL operation is unavailable".into())
    } else { Ok(()) }
}
#[tauri::command]
pub fn db_query(state: State<'_, DatabaseState>, sql: String, params: Vec<Value>) -> Result<Vec<Value>, String> {
    validate(&sql)?;
    let db = state.0.lock().map_err(|_| "Database lock unavailable")?;
    let mut statement = db.prepare(&sql).map_err(|e| e.to_string())?;
    let names: Vec<String> = statement.column_names().iter().map(|name| name.to_string()).collect();
    let values = parameters(params)?;
    let rows = statement.query_map(params_from_iter(values), |row| {
        let mut output = Map::new();
        for (index, name) in names.iter().enumerate() {
            let value: SqlValue = row.get(index)?;
            output.insert(name.clone(), match value {
                SqlValue::Null => Value::Null,
                SqlValue::Integer(v) => Value::from(v),
                SqlValue::Real(v) => Value::from(v),
                SqlValue::Text(v) => Value::from(v),
                SqlValue::Blob(_) => Value::Null,
            });
        }
        Ok(Value::Object(output))
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn db_execute(state: State<'_, DatabaseState>, sql: String, params: Vec<Value>) -> Result<Value, String> {
    validate(&sql)?;
    let db = state.0.lock().map_err(|_| "Database lock unavailable")?;
    let changes = db.execute(&sql, params_from_iter(parameters(params)?)).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"changes": changes, "lastInsertRowid": db.last_insert_rowid()}))
}
#[tauri::command]
pub fn db_exec(state: State<'_, DatabaseState>, sql: String) -> Result<(), String> {
    validate(&sql)?;
    state.0.lock().map_err(|_| "Database lock unavailable")?.execute_batch(&sql).map_err(|e| e.to_string())
}
