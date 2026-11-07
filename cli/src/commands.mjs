// Command implementations. Each one returns the process exit code.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Api, ApiError, connect, persist } from "./api.mjs";
import { fetchRegistry, loadCatalog, reference, search, sortScripts } from "./catalog.mjs";
import { battleLink, isUuid, parseBattleLink, parseSetting } from "./battle.mjs";
import { DEFAULTS, IDS, MAX, MIN, NAMES, indexOfId, isFlag } from "./params.mjs";
import { authorTable, bold, bytes, cyan, dim, error, green, info, magenta, parameterTable, relative, scriptTable, table, warn, yellow } from "./format.mjs";
import { clearSession, configDir, loadSettings, rememberRecent, saveSession, saveSettings, toggleFavorite, updateSettings } from "./store.mjs";
import { synchronizeSettings } from "./settings-sync.mjs";
import { canOpen, openTarget } from "./open.mjs";
import { compareVersions, latestRelease } from "./update.mjs";

const out = value => process.stdout.write(`${value}\n`);
const emit = (json, value) => (json ? out(JSON.stringify(value, null, 2)) : null);

function settings() {
  return loadSettings();
}

/** Loads the catalog with a short cache so repeated commands stay fast. */
async function catalog(flags = {}) {
  const config = settings();
  const cacheFile = join(configDir(), "catalog-cache.json");
  const ttl = 10 * 60 * 1000;
  if (!flags.refresh && existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (cached.expires > Date.now() && cached.api === config.api) return cached.data;
    } catch { /* A broken cache is simply ignored. */ }
  }
  const progress = flags.json || flags.quiet ? null : (done, total) => {
    if (done === total || done % 5 === 0) process.stderr.write(`\r${dim(`Загружаю авторов ${done}/${total}…`)}`);
  };
  const data = await loadCatalog({ registry: config.registry, api: config.api, onProgress: progress });
  if (progress) process.stderr.write("\r\u001b[K");
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ expires: Date.now() + ttl, api: config.api, data }));
  } catch { /* The cache is optional. */ }
  return data;
}

async function requireLogin() {
  const config = settings();
  const api = await connect({ base: config.api });
  if (!api) throw new ApiError(401, "Сначала войдите: script-library login");
  return api;
}

function findScript(scripts, value) {
  const id = String(value || "").toLowerCase();
  const found = scripts.find(script => script.uuid === id)
    || scripts.find(script => script.uuid.startsWith(id) && id.length >= 4);
  if (!found) throw new Error(`Скрипт не найден: ${value}`);
  return found;
}

export async function login(flags) {
  const config = settings();
  const username = flags.user || flags.username || process.env.SCRIPT_LIBRARY_USER;
  const password = flags.password || process.env.SCRIPT_LIBRARY_PASSWORD;
  if (!username || !password) {
    throw new Error("Укажите --user и --password или переменные SCRIPT_LIBRARY_USER и SCRIPT_LIBRARY_PASSWORD");
  }
  const api = new Api({ base: config.api });
  const me = await api.login(username, password);
  saveSession(api.session());
  if (flags.json) return emit(true, { uuid: me.uuid, username: me.username, name: me.name });
  out(`${green("Вход выполнен")} ${bold(me.name || me.username)} ${dim(`@${me.username}`)}`);
  info(dim(`Сессия сохранена в ${config.downloadDir ? "" : ""}${process.platform === "win32" ? "%APPDATA%" : "~/.config"}/script-library/session.json`));
  return 0;
}

export async function logout(flags) {
  clearSession();
  if (flags.json) return emit(true, { ok: true });
  out("Сессия удалена.");
  return 0;
}

export async function whoami(flags) {
  const api = await requireLogin();
  if (flags.json) return emit(true, api.identity);
  out(`${bold(api.identity.name || api.identity.username)} ${dim(`@${api.identity.username}`)}\n${api.identity.uuid}`);
  return 0;
}

export async function sync(flags) {
  const api = await requireLogin();
  const result = await synchronizeSettings(api, loadSettings(), saveSettings);
  saveSettings(result.settings);
  const account = api.identity;
  const summary = {
    uuid: account.uuid,
    username: account.username,
    initialized: result.initialized,
    pending: result.pending,
    blockedAuthors: result.settings.blockedAuthors.length,
    blockedScripts: result.settings.blockedScripts.length,
    battles: Object.keys(result.settings.battles).length,
  };
  if (flags.json) return emit(true, summary);
  out(`${green("Синхронизировано")} ${dim(`@${account.username || account.uuid}`)}`);
  info(dim(`${summary.blockedAuthors} авторов · ${summary.blockedScripts} скриптов · ${summary.battles} боёв`));
  if (result.pending) info(yellow(`Осталось отправить изменений: ${result.pending}. Повторите script-library sync.`));
  return 0;
}

export async function list(flags) {
  const data = await catalog(flags);
  const config = settings();
  let scripts = data.scripts.filter(script => !config.blockedScripts.includes(script.uuid) && !config.blockedAuthors.includes(script.author_uuid));
  if (flags.author) {
    const handle = String(flags.author).replace(/^@/, "").toLowerCase();
    scripts = scripts.filter(script => script.author_username.toLowerCase() === handle);
  }
  if (flags.search) scripts = search(scripts, flags.search, flags.scope || "all");
  scripts = sortScripts(scripts, flags.sort || "new");
  const limit = Number(flags.limit || 20);
  const shown = scripts.slice(0, limit);
  if (flags.json) return emit(true, { total: scripts.length, scripts: shown });
  out(scriptTable(shown));
  if (scripts.length > shown.length) info(dim(`Показано ${shown.length} из ${scripts.length}. Увеличьте --limit.`));
  else info(dim(`${scripts.length} скриптов · ${data.authors.length} авторов`));
  return 0;
}

export async function searchCommand(query, flags) {
  if (!query) throw new Error("Укажите запрос: script-library search <текст>");
  return list({ ...flags, search: query });
}

export async function show(value, flags) {
  const data = await catalog(flags);
  const script = findScript(data.scripts, value);
  rememberRecent(script);
  if (flags.json) return emit(true, script);
  const config = settings();
  out(`${bold(script.name)}\n${cyan(`@${script.author_username}`)}  ${dim(script.uuid)}`);
  if (script.description) out(`\n${script.description}`);
  out("");
  out(table(["Поле", "Значение"], [
    ["Опубликован", relative(script.published_at)],
    ["Обновлён", relative(script.updated_at)],
    ["Создан", relative(script.created_at)],
    ["Карта", script.user_map_internal_id || "нет"],
    ["В избранном", config.favorites.includes(script.uuid) ? "да" : "нет"],
  ]));
  return 0;
}

export async function code(value, flags) {
  const config = settings();
  const api = await requireLogin();
  const uuid = isUuid(value) ? value.toLowerCase() : findScript((await catalog(flags)).scripts, value).uuid;
  const result = await api.scriptContent(uuid);
  const content = String(result.content ?? "");
  if (flags.out) {
    const target = resolve(String(flags.out));
    writeFileSync(target, content, "utf8");
    if (flags.json) return emit(true, { uuid, path: target, bytes: Buffer.byteLength(content) });
    out(`${green("Сохранено")} ${target} ${dim(bytes(Buffer.byteLength(content)))}`);
    return 0;
  }
  if (flags.json) return emit(true, { uuid, content });
  out(content);
  return 0;
}

export async function download(value, flags) {
  const config = settings();
  const api = await requireLogin();
  const script = isUuid(value) ? { uuid: value.toLowerCase(), name: value } : findScript((await catalog(flags)).scripts, value);
  const result = await api.scriptContent(script.uuid);
  const directory = resolve(String(flags.out || config.downloadDir));
  mkdirSync(directory, { recursive: true });
  const safe = String(script.name || script.uuid).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80) || script.uuid;
  const target = join(directory, `${safe}.lua`);
  writeFileSync(target, String(result.content ?? ""), "utf8");
  if (flags.json) return emit(true, { uuid: script.uuid, path: target, bytes: Buffer.byteLength(String(result.content ?? "")) });
  out(`${green("Скачано")} ${target}`);
  return 0;
}

export async function authors(flags) {
  const data = await catalog(flags);
  if (flags.json) return emit(true, { total: data.authors.length, authors: data.authors });
  out(authorTable(data.authors));
  info(dim(`${data.authors.length} авторов · ${data.scripts.length} скриптов`));
  return 0;
}

export async function author(value, flags) {
  if (!value) throw new Error("Укажите автора: script-library author @handle");
  const data = await catalog(flags);
  const handle = String(value).replace(/^@/, "").toLowerCase();
  const found = data.authors.find(item => item.username.toLowerCase() === handle || item.uuid === handle);
  if (!found) throw new Error(`Автор не найден: ${value}`);
  const scripts = sortScripts(data.scripts.filter(script => script.author_uuid === found.uuid), "new");
  if (flags.json) return emit(true, { ...found, scripts });
  out(`${bold(found.name)} ${cyan(`@${found.username}`)}\n${dim(found.uuid)}\n`);
  out(scriptTable(scripts.slice(0, Number(flags.limit || 20))));
  info(dim(`${scripts.length} скриптов`));
  return 0;
}

export async function favorites(flags) {
  const config = settings();
  const data = await catalog(flags);
  const scripts = data.scripts.filter(script => config.favorites.includes(script.uuid));
  if (flags.json) return emit(true, { total: scripts.length, scripts });
  out(scriptTable(scripts));
  if (!scripts.length) info(dim("Добавьте: script-library favorite <uuid>"));
  return 0;
}

export async function favorite(value, flags) {
  if (!value) throw new Error("Укажите скрипт: script-library favorite <uuid>");
  const data = await catalog(flags);
  const script = findScript(data.scripts, value);
  const added = toggleFavorite(script.uuid);
  if (flags.json) return emit(true, { uuid: script.uuid, favorite: added });
  out(added ? `${green("Добавлено в избранное")} ${script.name}` : `${yellow("Убрано из избранного")} ${script.name}`);
  return 0;
}

export async function recent(flags) {
  const config = settings();
  const data = await catalog(flags);
  const scripts = config.recent.map(entry => data.scripts.find(script => script.uuid === entry.uuid) || entry).filter(Boolean);
  if (flags.json) return emit(true, { total: scripts.length, scripts });
  out(scriptTable(scripts.slice(0, Number(flags.limit || 20))));
  if (!scripts.length) info(dim("История пуста."));
  return 0;
}

export async function params(flags) {
  if (flags.json) {
    return emit(true, NAMES.map((name, index) => ({
      index, name, id: IDS[index], default: DEFAULTS[index], min: MIN[index], max: MAX[index], flag: isFlag(index),
    })));
  }
  out(parameterTable());
  return 0;
}

export async function battle(value, flags) {
  if (!value) throw new Error("Укажите скрипт: script-library battle <uuid>");
  const config = settings();
  const data = await catalog(flags);
  const script = isUuid(value) ? { uuid: value.toLowerCase(), name: value } : findScript(data.scripts, value);
  const stored = config.battles[script.uuid] || {};
  const values = [...(stored.values || DEFAULTS)];
  const banned = new Set(stored.banned || []);

  if (flags.reset) {
    for (let index = 0; index < 32; index += 1) values[index] = DEFAULTS[index];
    banned.clear();
  }
  for (const expression of flags.set || []) {
    const { index, value: setting } = parseSetting(expression);
    values[index] = setting;
  }
  for (const expression of flags.ban || []) {
    for (const part of String(expression).split(",")) {
      const id = Number(part.trim());
      if (Number.isInteger(id) && id >= 0) banned.add(id);
    }
  }
  if (flags.unban) banned.clear();

  if (flags.save) {
    updateSettings({ battles: { ...config.battles, [script.uuid]: { values, banned: [...banned] } } });
    if (!flags.json) out(`${green("Параметры сохранены")} для ${script.name}`);
  }

  const changed = NAMES.map((name, index) => ({ name, index, value: values[index] })).filter(item => item.value !== DEFAULTS[item.index]);
  if (flags.json && !flags.link && !flags.launch) {
    return emit(true, { uuid: script.uuid, values, banned: [...banned], changed });
  }
  if (!flags.quiet) {
    out(`${bold(script.name)} ${dim(script.uuid)}`);
    if (changed.length) out(table(["#", "Параметр", "Значение", "По умолчанию"], changed.map(item => [String(item.index), item.name, String(item.value), String(DEFAULTS[item.index])])));
    else out(dim("Все параметры по умолчанию."));
    if (banned.size) out(`${dim("Заблокированы бойцы:")} ${[...banned].sort((a, b) => a - b).join(", ")}`);
  }

  if (!flags.link && !flags.launch) {
    if (flags.json) return emit(true, { uuid: script.uuid, values, banned: [...banned], changed });
    info(dim("Добавьте --link, чтобы получить ссылку, или --launch, чтобы открыть игру."));
    return 0;
  }

  const api = await requireLogin();
  const token = await api.shareToken(script.uuid);
  const link = battleLink({
    script: script.uuid,
    token: token.token,
    values,
    banned: [...banned],
    map: script.user_map_internal_id || null,
    origin: config.api,
  });
  if (flags.json) return emit(true, { uuid: script.uuid, values, banned: [...banned], link });
  out(link);
  if (flags.launch) {
    if (!canOpen()) warn("В этой среде нет графической сессии, ссылку нужно открыть вручную.");
    else {
      openTarget(link);
      info(dim("Открываю Null’s Brawl…"));
    }
  }
  return 0;
}

export async function importBattle(link, flags) {
  if (!link) throw new Error("Укажите ссылку: script-library import-battle \"nullsbrawl://…\"");
  const parsed = parseBattleLink(link);
  const data = await catalog(flags);
  const script = parsed.script ? data.scripts.find(item => item.uuid === parsed.script) : null;
  if (flags.json) return emit(true, { ...parsed, name: script?.name ?? null });
  if (script) out(`${bold(script.name)} ${cyan(`@${script.author_username}`)}`);
  else out(dim("Скрипт не найден в каталоге."));
  const changed = NAMES.map((name, index) => ({ name, index, value: parsed.values[index] })).filter(item => item.value !== DEFAULTS[item.index]);
  if (changed.length) out(table(["#", "Параметр", "Значение"], changed.map(item => [String(item.index), item.name, String(item.value)])));
  else out(dim("Все параметры по умолчанию."));
  if (parsed.banned.length) out(`${dim("Заблокированы бойцы:")} ${parsed.banned.join(", ")}`);
  if (parsed.map) out(`${dim("Карта:")} ${parsed.map}`);
  return 0;
}

export async function mine(flags) {
  const api = await requireLogin();
  const list = await api.userScripts(api.identity.uuid);
  const scripts = (list.scripts || []).map(item => ({
    uuid: item.uuid || item.script_id,
    name: item.name || "",
    description: item.description || "",
    published_at: item.published_at || "",
    updated_at: item.updated_at || "",
    author_uuid: api.identity.uuid,
    author_name: api.identity.name,
    author_username: api.identity.username,
  }));
  if (flags.json) return emit(true, { total: scripts.length, scripts });
  out(scriptTable(scripts));
  info(dim(`${scripts.length} скриптов · черновики отмечены пустой датой`));
  return 0;
}

export async function create(flags) {
  const api = await requireLogin();
  const name = String(flags.name || "").trim();
  if (name.length < 3 || name.length > 32) throw new Error("Название: от 3 до 32 символов");
  const content = flags.file ? readFileSync(resolve(String(flags.file)), "utf8") : String(flags.content || "");
  if (!content.trim()) throw new Error("Код пустой. Укажите --file или --content");
  const created = await api.createScript(name, content);
  const uuid = created.uuid || created.script_id;
  if (flags.description) await api.updateDescription(uuid, String(flags.description));
  if (flags.json) return emit(true, { uuid, name });
  out(`${green("Черновик создан")} ${bold(name)}\n${dim(uuid)}`);
  info(dim(`Опубликовать: script-library publish ${uuid}`));
  return 0;
}

export async function publish(value, flags) {
  if (!value) throw new Error("Укажите скрипт: script-library publish <uuid>");
  const api = await requireLogin();
  await api.publish(value);
  if (flags.json) return emit(true, { uuid: value, published: true });
  out(`${green("Опубликовано")} ${value}`);
  return 0;
}

export async function remove(value, flags) {
  if (!value) throw new Error("Укажите скрипт: script-library delete <uuid>");
  if (!flags.yes) throw new Error("Удаление необратимо. Добавьте --yes, чтобы подтвердить.");
  const api = await requireLogin();
  await api.deleteScript(value);
  if (flags.json) return emit(true, { uuid: value, deleted: true });
  out(`${yellow("Удалено")} ${value}`);
  return 0;
}

export async function update(flags) {
  const release = await latestRelease();
  const installed = flags.installed ? String(flags.installed) : null;
  if (flags.json) return emit(true, release);
  out(`${bold(release.version)} ${dim(relative(release.published_at))}`);
  if (release.size) out(dim(bytes(release.size)));
  if (installed) {
    const comparison = compareVersions(release.version, installed);
    out(comparison > 0 ? yellow(`Установлено ${installed} — есть обновление.`) : green(`Установлено ${installed} — актуальная версия.`));
  }
  if (release.notes) out(`\n${release.notes}`);
  if (release.url) out(`\n${cyan(release.url)}`);
  return 0;
}

export async function config(flags) {
  const current = settings();
  if (flags.set) {
    const change = {};
    for (const expression of flags.set) {
      const split = String(expression).indexOf("=");
      if (split < 1) throw new Error(`Ожидается "ключ=значение": ${expression}`);
      change[String(expression).slice(0, split).trim()] = String(expression).slice(split + 1).trim();
    }
    const next = updateSettings(change);
    if (flags.json) return emit(true, next);
    out(JSON.stringify(next, null, 2));
    return 0;
  }
  if (flags.json) return emit(true, current);
  out(JSON.stringify(current, null, 2));
  return 0;
}

export async function doctor(flags) {
  const config = settings();
  const checks = [];
  const check = async (name, run) => {
    try {
      const detail = await run();
      checks.push({ name, ok: true, detail });
    } catch (error) {
      checks.push({ name, ok: false, detail: error.message });
    }
  };
  await check("Node", async () => process.version);
  await check("Платформа", async () => `${process.platform} ${process.arch}`);
  await check("Каталог настроек", async () => config.downloadDir);
  await check("Список авторов", async () => {
    const list = await fetchRegistry(config.registry);
    return `${list.length} авторов`;
  });
  await check("API", async () => {
    const api = new Api({ base: config.api });
    const profile = await api.user("@ishak");
    return profile.name || profile.username;
  });
  await check("Сессия", async () => {
    const api = await connect({ base: config.api });
    return api ? `вход как @${api.identity.username}` : "не выполнен";
  });
  await check("Последний релиз", async () => (await latestRelease()).version);
  if (flags.json) return emit(true, checks);
  out(table(["Проверка", "Результат"], checks.map(item => [item.name, `${item.ok ? green("ок") : yellow("нет")} ${item.detail}`])));
  return checks.some(item => !item.ok && item.name !== "Сессия") ? 1 : 0;
}
