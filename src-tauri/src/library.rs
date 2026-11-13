use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

const LIBRARY_PATH_FILE: &str = "library-path.txt";
const BODY_LIMIT: usize = 1_000_000;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiskRecipe {
    pub filename: String,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub path: Option<String>,
    pub message: Option<String>,
    pub recipes: Vec<DiskRecipe>,
    pub categories: Option<serde_json::Value>,
    pub tags: Option<serde_json::Value>,
    pub categories_error: Option<String>,
    pub tags_error: Option<String>,
}

#[tauri::command]
pub fn load_library(app: tauri::AppHandle) -> Result<Library, String> {
    let config_dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(resolve_library(&config_dir, dev_data_dir()))
}

#[tauri::command]
pub fn set_library(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    remember_library(&config_dir, Path::new(&path))
}

#[tauri::command]
pub fn save_files(
    app: tauri::AppHandle,
    recipe_id: String,
    recipe_json: String,
    categories_json: Option<String>,
    tags_json: Option<String>,
) -> Result<(), String> {
    let dir = library_dir(&app)?;
    let id = safe_recipe_id(&recipe_id)?;
    let recipe_text = checked_recipe_json(&id, &recipe_json)?;
    let recipes_dir = dir.join("recipes");
    write_atomic(&recipes_dir.join(format!("{id}.json")), &recipe_text)?;
    if let Some(categories_json) = categories_json {
        let text = checked_object_json("Categories", &categories_json)?;
        write_atomic(&dir.join("categories.json"), &text)?;
    }
    if let Some(tags_json) = tags_json {
        let text = checked_object_json("Tags", &tags_json)?;
        write_atomic(&dir.join("tags.json"), &text)?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_recipe(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let dir = library_dir(&app)?;
    let id = safe_recipe_id(&id)?;
    let target = dir.join("recipes").join(format!("{id}.json"));
    if !target.is_file() {
        return Err("Recipe not found".to_string());
    }
    fs::remove_file(target).map_err(|_| "Couldn't delete this recipe.".to_string())
}

/// Debug builds open this repo's `data` folder until a folder is chosen.
fn dev_data_dir() -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data");
        if path.is_dir() {
            return Some(fs::canonicalize(&path).unwrap_or(path));
        }
    }
    None
}

pub fn resolve_library(config_dir: &Path, fallback: Option<PathBuf>) -> Library {
    if let Some(saved) = read_saved_path(config_dir) {
        if saved.is_dir() {
            return library_from_dir(saved);
        }
        return Library {
            path: Some(saved.display().to_string()),
            message: Some("That data folder isn't on this Mac.".to_string()),
            recipes: Vec::new(),
            categories: None,
            tags: None,
            categories_error: None,
            tags_error: None,
        };
    }

    if let Some(fallback) = fallback.filter(|path| path.is_dir()) {
        return library_from_dir(fallback);
    }

    Library {
        path: None,
        message: None,
        recipes: Vec::new(),
        categories: None,
        tags: None,
        categories_error: None,
        tags_error: None,
    }
}

pub fn remember_library(config_dir: &Path, path: &Path) -> Result<(), String> {
    if !path.is_dir() {
        return Err("Choose a folder.".to_string());
    }
    let canonical = fs::canonicalize(path).map_err(|err| err.to_string())?;
    let data = normalize_data_dir(&canonical);
    let data = if data.is_dir() {
        fs::canonicalize(&data).unwrap_or(data)
    } else {
        return Err("Choose a folder.".to_string());
    };
    fs::create_dir_all(config_dir).map_err(|err| err.to_string())?;
    fs::write(config_dir.join(LIBRARY_PATH_FILE), data.display().to_string())
        .map_err(|err| err.to_string())?;
    Ok(())
}

/// Accept the data folder, the repo root, or `data/recipes`.
pub fn normalize_data_dir(path: &Path) -> PathBuf {
    if path.join("recipes").is_dir() || path.join("categories.json").is_file() {
        return path.to_path_buf();
    }
    let nested = path.join("data");
    if nested.join("recipes").is_dir() || nested.join("categories.json").is_file() {
        return nested;
    }
    if path.file_name().and_then(|name| name.to_str()) == Some("recipes") {
        if let Some(parent) = path.parent() {
            if parent.join("categories.json").is_file() || parent.join("recipes").is_dir() {
                return parent.to_path_buf();
            }
        }
    }
    path.to_path_buf()
}

fn read_saved_path(config_dir: &Path) -> Option<PathBuf> {
    let text = fs::read_to_string(config_dir.join(LIBRARY_PATH_FILE)).ok()?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

fn library_from_dir(path: PathBuf) -> Library {
    let (categories, categories_error) = read_json_value(&path.join("categories.json"));
    let (tags, tags_error) = read_json_value(&path.join("tags.json"));
    match read_recipes(&path.join("recipes")) {
        Ok(recipes) => Library {
            path: Some(path.display().to_string()),
            message: None,
            recipes,
            categories,
            tags,
            categories_error,
            tags_error,
        },
        Err(message) => Library {
            path: Some(path.display().to_string()),
            message: Some(message),
            recipes: Vec::new(),
            categories,
            tags,
            categories_error,
            tags_error,
        },
    }
}

fn read_json_value(path: &Path) -> (Option<serde_json::Value>, Option<String>) {
    if !path.is_file() {
        return (None, None);
    }
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(_) => return (None, Some("Couldn't read this file.".to_string())),
    };
    match serde_json::from_str(&text) {
        Ok(value) => (Some(value), None),
        Err(_) => (None, Some("This file isn't valid JSON.".to_string())),
    }
}

pub fn read_recipes(dir: &Path) -> Result<Vec<DiskRecipe>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    if !dir.is_dir() {
        return Err("Couldn't read the recipes folder.".to_string());
    }
    let entries = fs::read_dir(dir).map_err(|_| "Couldn't read the recipes folder.".to_string())?;
    let mut recipes = Vec::new();
    for entry in entries {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if filename.starts_with('.') || !filename.to_ascii_lowercase().ends_with(".json") {
            continue;
        }
        recipes.push(recipe_from_file(&path, filename));
    }
    recipes.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(recipes)
}

fn recipe_from_file(path: &Path, filename: &str) -> DiskRecipe {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(_) => {
            return DiskRecipe {
                filename: filename.to_string(),
                data: None,
                error: Some("Couldn't read this file.".to_string()),
            }
        }
    };
    let text = match String::from_utf8(bytes) {
        Ok(text) => text,
        Err(_) => {
            return DiskRecipe {
                filename: filename.to_string(),
                data: None,
                error: Some("This file isn't UTF-8 text.".to_string()),
            }
        }
    };
    match serde_json::from_str(&text) {
        Ok(value) => DiskRecipe {
            filename: filename.to_string(),
            data: Some(value),
            error: None,
        },
        Err(_) => DiskRecipe {
            filename: filename.to_string(),
            data: None,
            error: Some("This file isn't valid JSON.".to_string()),
        },
    }
}

fn library_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    let library = resolve_library(&config_dir, dev_data_dir());
    let Some(path) = library.path else {
        return Err("Choose a data folder first.".to_string());
    };
    let path = PathBuf::from(path);
    if path.is_dir() {
        Ok(path)
    } else {
        Err("That data folder isn't on this Mac.".to_string())
    }
}

fn safe_recipe_id(id: &str) -> Result<String, String> {
    let mut chars = id.chars();
    let Some(first) = chars.next() else {
        return Err("Invalid recipe id".to_string());
    };
    if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return Err("Invalid recipe id".to_string());
    }
    let mut previous_hyphen = false;
    for ch in chars {
        if ch == '-' {
            if previous_hyphen {
                return Err("Invalid recipe id".to_string());
            }
            previous_hyphen = true;
            continue;
        }
        previous_hyphen = false;
        if !ch.is_ascii_lowercase() && !ch.is_ascii_digit() {
            return Err("Invalid recipe id".to_string());
        }
    }
    if id.ends_with('-') {
        return Err("Invalid recipe id".to_string());
    }
    Ok(id.to_string())
}

fn checked_recipe_json(id: &str, text: &str) -> Result<String, String> {
    let text = checked_object_json("Recipe", text)?;
    let value: serde_json::Value = serde_json::from_str(&text).map_err(|_| "Recipe is not valid JSON.".to_string())?;
    let file_id = value.get("id").and_then(|value| value.as_str());
    if file_id != Some(id) {
        return Err("Recipe id does not match the file.".to_string());
    }
    Ok(text)
}

fn checked_object_json(label: &str, text: &str) -> Result<String, String> {
    if text.len() > BODY_LIMIT {
        return Err(format!("{label} is too large to save."));
    }
    let value: serde_json::Value =
        serde_json::from_str(text).map_err(|_| format!("{label} is not valid JSON."))?;
    if !value.is_object() {
        return Err(format!("{label} is not a JSON object."));
    }
    if text.ends_with('\n') {
        Ok(text.to_string())
    } else {
        Ok(format!("{text}\n"))
    }
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Couldn't save this file.".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "Couldn't save this file.".to_string())?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Couldn't save this file.".to_string())?;
    let temporary = parent.join(format!(".{name}.tmp"));
    if let Err(error) = fs::write(&temporary, contents) {
        let _ = error;
        return Err("Couldn't save this file.".to_string());
    }
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        let _ = error;
        return Err("Couldn't save this file.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_workspace() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "recipes-app-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn lists_recipe_files_and_skips_the_rest() {
        let root = temp_workspace();
        let recipes = root.join("recipes");
        fs::create_dir_all(&recipes).unwrap();
        fs::write(recipes.join("bao.json"), r#"{"id":"bao"}"#).unwrap();
        fs::write(recipes.join("broken.json"), "{").unwrap();
        fs::write(recipes.join("notes.txt"), "nope").unwrap();
        fs::write(recipes.join(".secret.json"), r#"{"id":"secret"}"#).unwrap();
        fs::create_dir(recipes.join("nested")).unwrap();
        fs::write(root.join("categories.json"), r#"{"method":[]}"#).unwrap();

        let library = library_from_dir(root.clone());
        assert_eq!(library.recipes.len(), 2);
        assert_eq!(library.recipes[0].filename, "bao.json");
        assert!(library.recipes[0].error.is_none());
        assert_eq!(
            library.recipes[1].error.as_deref(),
            Some("This file isn't valid JSON.")
        );
        assert!(library.categories.is_some());
        assert!(library.message.is_none());

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn saved_folder_wins_over_the_fallback() {
        let root = temp_workspace();
        let saved = root.join("saved");
        let fallback = root.join("fallback");
        fs::create_dir_all(saved.join("recipes")).unwrap();
        fs::create_dir_all(fallback.join("recipes")).unwrap();
        fs::write(saved.join("recipes").join("bao.json"), r#"{"id":"bao"}"#).unwrap();
        fs::write(fallback.join("recipes").join("other.json"), r#"{"id":"other"}"#).unwrap();

        let config = root.join("config");
        remember_library(&config, &saved).unwrap();
        let resolved = resolve_library(&config, Some(fallback));
        assert_eq!(resolved.recipes.len(), 1);
        assert_eq!(resolved.recipes[0].filename, "bao.json");
        assert!(resolved.message.is_none());

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn missing_saved_folder_is_reported() {
        let root = temp_workspace();
        let config = root.join("config");
        fs::create_dir_all(&config).unwrap();
        fs::write(config.join(LIBRARY_PATH_FILE), "/missing/recipes-data").unwrap();

        let resolved = resolve_library(&config, None);
        assert_eq!(resolved.path.as_deref(), Some("/missing/recipes-data"));
        assert!(resolved.recipes.is_empty());
        assert!(resolved.message.is_some());

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn normalize_accepts_the_repo_root_and_the_recipes_folder() {
        let root = temp_workspace();
        fs::create_dir_all(root.join("data").join("recipes")).unwrap();
        fs::write(root.join("data").join("categories.json"), "{}").unwrap();

        let from_root = normalize_data_dir(&root);
        assert_eq!(from_root, root.join("data"));

        let from_recipes = normalize_data_dir(&root.join("data").join("recipes"));
        assert_eq!(from_recipes, root.join("data"));

        let from_data = normalize_data_dir(&root.join("data"));
        assert_eq!(from_data, root.join("data"));

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn save_keeps_the_text_and_rejects_a_bad_id() {
        let dir = temp_workspace();
        let recipe = "{\n  \"id\": \"bao\",\n  \"title\": \"Bao\"\n}\n";
        write_atomic(&dir.join("recipes").join("bao.json"), recipe).unwrap();
        let saved = fs::read_to_string(dir.join("recipes").join("bao.json")).unwrap();
        assert_eq!(saved, recipe);
        assert!(!dir.join("recipes").join(".bao.json.tmp").exists());

        assert!(safe_recipe_id("../bao").is_err());
        assert!(safe_recipe_id("Bao").is_err());
        assert!(checked_recipe_json("other", recipe).is_err());

        fs::remove_dir_all(&dir).unwrap();
    }
}
