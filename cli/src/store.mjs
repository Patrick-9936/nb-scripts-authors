// Configuration and session storage.
//
// Everything lives in one directory per user, chosen the way each platform
// expects. The session file is written with owner-only permissions where the
// platform supports it; on Windows the file inherits the profile ACL.
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, chmodSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export function configDir() {
  const home = homedir();
  if (platform() === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "script-library");
  }
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", "script-library");
  }
  return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "script-library");
}

const file = name => join(configDir(), name);

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value, secret = false) {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), { encoding: "utf8", mode: secret ? 0o600 : 0o644 });
  if (secret && platform() !== "win32") {
    try { chmodSync(path, 0o600); } catch { /* Best effort on unusual filesystems. */ }
  }
}

export const sessionPath = () => file("session.json");
export const settingsPath = () => file("settings.json");

export function loadSession() {
  const value = readJson(sessionPath(), null);
  if (!value || typeof value !== "object") return null;
  if (value.expires && value.expires < Date.now()) return null;
  return value;
}

export function saveSession(value) {
  writeJson(sessionPath(), value, true);
}

export function clearSession() {
  try { rmSync(sessionPath(), { force: true }); } catch { /* Already gone. */ }
}

export function loadSettings() {
  return { ...defaults(), ...readJson(settingsPath(), {}) };
}

export function saveSettings(value) {
  writeJson(settingsPath(), value);
}

function defaults() {
  return {
    registry: "https://raw.githubusercontent.com/Patrick-9936/nb-scripts-authors/android-script-library/list.txt",
    api: "https://scripting.nulls.gg/api",
    downloadDir: join(homedir(), "Downloads", "script_library"),
    recent: [],
    favorites: [],
    blockedAuthors: [],
    blockedScripts: [],
    battles: {},
  };
}

export function updateSettings(change) {
  const next = { ...loadSettings(), ...change };
  saveSettings(next);
  return next;
}

export function rememberRecent(entry) {
  const settings = loadSettings();
  const recent = [entry, ...settings.recent.filter(item => item.uuid !== entry.uuid)].slice(0, 50);
  saveSettings({ ...settings, recent });
}

export function toggleFavorite(uuid) {
  const settings = loadSettings();
  const favorites = settings.favorites.includes(uuid)
    ? settings.favorites.filter(item => item !== uuid)
    : [...settings.favorites, uuid];
  saveSettings({ ...settings, favorites });
  return favorites.includes(uuid);
}

export function isConfigured() {
  return existsSync(configDir());
}
