// Public catalog: the author registry plus every published script.
//
// The registry is a plain text file in the repository, so adding an author does
// not require a new release. One slow author must not fail the whole refresh, so
// failures are counted and reported instead of thrown.
import { Api } from "./api.mjs";

const UUID = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
const HANDLE = /^[A-Za-z0-9_.-]{1,64}$/;

/** Extracts @handles from the registry text, in order, without duplicates. */
export function handles(text) {
  const found = new Set();
  for (const match of String(text || "").matchAll(/https:\/\/scripting\.(?:donutquine\.dev|nulls\.gg)\/(?:users\/)?@([A-Za-z0-9_.-]{1,64})/g)) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

export async function fetchRegistry(url) {
  const response = await fetch(`${url}?refresh=${Date.now()}`, {
    headers: { "user-agent": "script-library-cli", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Список авторов недоступен (${response.status})`);
  const text = await response.text();
  const list = handles(text);
  if (!list.length) throw new Error("Список авторов пуст");
  return list;
}

/**
 * Loads every author and their published scripts.
 * @param {object} options
 * @param {string} options.registry registry URL
 * @param {string} options.api base API URL
 * @param {number} options.concurrency parallel author requests
 * @param {(done:number,total:number)=>void} options.onProgress
 */
export async function loadCatalog({ registry, api, concurrency = 10, onProgress } = {}) {
  const names = await fetchRegistry(registry);
  const client = new Api({ base: api });
  const authors = [];
  const scripts = [];
  const failed = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < names.length) {
      const handle = names[cursor++];
      try {
        const profile = await client.user(`@${encodeURIComponent(handle)}`);
        const uuid = profile.uuid || profile.user_id || "";
        if (!UUID.test(uuid)) throw new Error("нет идентификатора");
        const list = await client.userScripts(uuid);
        authors.push({
          uuid,
          name: profile.name || handle,
          username: profile.username || handle,
        });
        for (const item of list.scripts || []) {
          const id = item.uuid || item.script_id || "";
          if (!item.published_at || !UUID.test(id)) continue;
          scripts.push({
            uuid: id,
            name: item.name || "",
            description: item.description || "",
            created_at: item.created_at || "",
            updated_at: item.updated_at || "",
            published_at: item.published_at || "",
            author_uuid: uuid,
            author_name: item.author_name || profile.name || handle,
            author_username: profile.username || handle,
            user_map_id: item.user_map_id || null,
            user_map_internal_id: item.user_map_internal_id || null,
          });
        }
      } catch (error) {
        failed.push({ handle, reason: error.message });
      } finally {
        done += 1;
        onProgress?.(done, names.length);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, worker));
  if (names.length && !authors.length) throw new Error("Не удалось получить авторов. Проверьте соединение.");
  authors.sort((a, b) => a.username.localeCompare(b.username));
  return { authors, scripts, failed, listed: names.length, refreshed_at: new Date().toISOString() };
}

/** Case-insensitive search across the fields the site searches. */
export function search(scripts, query, scope = "all") {
  const needle = String(query || "").toLocaleLowerCase().trim();
  if (!needle) return scripts;
  return scripts.filter(script => {
    const fields = {
      title: script.name,
      author: `${script.author_name} ${script.author_username}`,
      description: script.description,
      uuid: script.uuid,
      all: [script.name, script.author_name, script.author_username, script.description, script.uuid].join(" "),
    };
    return String(fields[scope] ?? fields.all).toLocaleLowerCase().includes(needle);
  });
}

export const SORTS = {
  new: (a, b) => String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at)),
  old: (a, b) => String(a.published_at || a.created_at).localeCompare(String(b.published_at || b.created_at)),
  updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)),
  az: (a, b) => a.name.localeCompare(b.name, "ru"),
  za: (a, b) => b.name.localeCompare(a.name, "ru"),
};

export function sortScripts(scripts, mode = "new") {
  const compare = SORTS[mode];
  if (!compare) return scripts;
  return [...scripts].sort((a, b) => compare(a, b) || a.uuid.localeCompare(b.uuid));
}

/** Accepts a UUID, a scripting URL or a bare handle and returns what it is. */
export function reference(value) {
  const text = String(value || "").trim();
  if (UUID.test(text)) return { kind: "script", value: text.toLowerCase() };
  const url = /^https?:\/\/scripting\.(?:donutquine\.dev|nulls\.gg)\/(.+)$/.exec(text);
  if (url) {
    const path = url[1];
    const script = /^scripts\/([0-9a-fA-F-]{36})\/?$/.exec(path);
    if (script && UUID.test(script[1])) return { kind: "script", value: script[1].toLowerCase() };
    const author = /^(?:users\/)?@?([A-Za-z0-9_.-]{1,64})\/?$/.exec(path);
    if (author) return { kind: "author", value: author[1].toLowerCase() };
  }
  if (text.startsWith("@")) return { kind: "author", value: text.slice(1).toLowerCase() };
  if (HANDLE.test(text)) return { kind: "author", value: text.toLowerCase() };
  return null;
}
