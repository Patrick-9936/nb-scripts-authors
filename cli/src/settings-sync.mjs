// Adapter for the shared account_settings contract used by web and Android.
// Favorites/recent stay in the CLI's local settings; unsupported shared values
// (such as Android presets) are retained verbatim in the per-account snapshot.
import { DEFAULTS } from "./params.mjs";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const same = (left, right) => stable(left) === stable(right);

function positive(values) {
  const clean = {};
  for (const [key, value] of Object.entries(values || {})) {
    if ((key.startsWith("author:") || key.startsWith("script:")) && value === false) continue;
    clean[key] = value;
  }
  return clean;
}

/** Convert CLI config to the shared key/value representation. */
export function localSettingsSnapshot(settings) {
  const result = {};
  for (const kind of ["blockedAuthors", "blockedScripts"]) {
    const prefix = kind === "blockedAuthors" ? "author:" : "script:";
    for (const value of Array.isArray(settings[kind]) ? settings[kind] : []) {
      const id = String(value).toLowerCase();
      if (UUID.test(id)) result[`${prefix}${id}`] = true;
    }
  }
  for (const [rawId, value] of Object.entries(settings.battles || {})) {
    const id = String(rawId).toLowerCase();
    if (!UUID.test(id) || !value || typeof value !== "object") continue;
    const values = Array.isArray(value.values) ? value.values : [...DEFAULTS];
    if (values.length !== 32 || !values.every(Number.isInteger)) continue;
    const banned = [...new Set((Array.isArray(value.banned) ? value.banned : [])
      .map(Number).filter(item => Number.isInteger(item) && item >= 0 && item <= 1024))].sort((a, b) => a - b).slice(0, 256);
    result[`battle:${id}`] = values;
    result[`brawlers:${id}`] = banned;
  }
  return result;
}

function applySharedSettings(settings, values) {
  const next = { ...settings };
  const authors = [];
  const scripts = [];
  const battles = {};
  const ids = new Set();
  for (const [key, value] of Object.entries(values || {})) {
    const match = /^(author|script|battle|brawlers):([0-9a-f-]+)$/i.exec(key);
    if (!match || !UUID.test(match[2])) continue;
    const [, kind, rawId] = match;
    const id = rawId.toLowerCase();
    if (kind === "author" && value === true) authors.push(id);
    if (kind === "script" && value === true) scripts.push(id);
    if (kind === "battle" && Array.isArray(value) && value.length === 32 && value.every(Number.isInteger)) {
      ids.add(id);
      battles[id] = { ...(battles[id] || {}), values: [...value] };
    }
    if (kind === "brawlers" && Array.isArray(value) && value.every(item => Number.isInteger(item) && item >= 0 && item <= 1024)) {
      ids.add(id);
      battles[id] = { ...(battles[id] || {}), banned: [...new Set(value)].sort((a, b) => a - b) };
    }
  }
  for (const id of ids) {
    battles[id] = {
      values: battles[id].values || [...DEFAULTS],
      banned: battles[id].banned || [],
    };
  }
  next.blockedAuthors = [...new Set(authors)];
  next.blockedScripts = [...new Set(scripts)];
  next.battles = battles;
  return next;
}

function localChanges(previous, current) {
  const changes = {};
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (same(previous[key], current[key])) continue;
    if (Object.hasOwn(current, key)) changes[key] = current[key];
    else if (key.startsWith("author:") || key.startsWith("script:")) changes[key] = false;
    else if (key.startsWith("brawlers:")) changes[key] = [];
    // The server has no delete value for battle arrays. `battle --reset --save`
    // is the portable way to replace one with defaults.
  }
  return changes;
}

function cleanSyncState(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value : { known: false, values: {}, pending: {} };
}

/**
 * Sync shared settings for the currently authenticated account.
 * onPending receives the updated settings before the request, so a failed
 * network call still leaves a durable outbox when the caller supplies it.
 */
export async function synchronizeSettings(api, settings, onPending = () => {}) {
  const account = String(api?.identity?.uuid || "").toLowerCase();
  if (!UUID.test(account)) throw new Error("Сначала войдите: script-library login");

  let next = { ...settings };
  const storedAccounts = settings.syncAccounts && typeof settings.syncAccounts === "object" && !Array.isArray(settings.syncAccounts)
    ? settings.syncAccounts : {};
  let accounts = { ...storedAccounts };
  let currentAccount = String(settings.syncCurrentAccount || "").toLowerCase();
  if (currentAccount !== account) {
    if (currentAccount) {
      const old = cleanSyncState(accounts[currentAccount]);
      accounts[currentAccount] = { ...old, local: localSettingsSnapshot(settings) };
    } else {
      next.syncGuest = localSettingsSnapshot(settings);
    }
    const target = cleanSyncState(accounts[account]);
    const initialLocal = target.local || (currentAccount ? {} : next.syncGuest || localSettingsSnapshot(settings));
    next = applySharedSettings(next, initialLocal);
    next.syncCurrentAccount = account;
    accounts[account] = { ...target, local: localSettingsSnapshot(next) };
  }

  const state = cleanSyncState(accounts[account]);
  const current = localSettingsSnapshot(next);
  const previous = positive(state.values);
  const delta = state.known ? localChanges(previous, current) : current;
  const pending = { ...(state.pending || {}), ...delta };
  const initialize = state.known !== true;
  const queued = {
    ...next,
    syncCurrentAccount: account,
    syncAccounts: { ...accounts, [account]: { ...state, known: state.known === true, values: state.values || {}, pending, local: current } },
  };
  onPending(queued);

  const data = await api.syncSettings({ initialize, changes: pending }, account);
  if (String(data.user_uuid || "").toLowerCase() !== account || !data.values || typeof data.values !== "object" || Array.isArray(data.values) || typeof data.initialized !== "boolean") {
    throw new Error("Сервис вернул некорректный ответ синхронизации.");
  }
  const serverValues = positive(data.values);
  let remaining = {};
  if (!(initialize && data.initialized !== true)) {
    for (const [key, value] of Object.entries(pending)) {
      if (!same(data.values[key], value)) remaining[key] = value;
    }
  }
  const effective = { ...serverValues, ...remaining };
  next = applySharedSettings(next, effective);
  const finished = {
    ...state,
    known: true,
    values: data.values,
    pending: remaining,
    local: localSettingsSnapshot(next),
  };
  accounts[account] = finished;
  next.syncCurrentAccount = account;
  next.syncAccounts = accounts;
  return { settings: next, initialized: data.initialized === true, pending: Object.keys(remaining).length };
}
