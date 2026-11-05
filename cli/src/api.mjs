// Client for the Null's scripting API.
//
// A CLI has no browser and therefore no CORS restriction, so it talks to the
// service directly. Transient failures are retried the same way the Android app
// retries them, because a single 429 used to abort a whole catalog refresh.
import { clearSession, loadSession, saveSession } from "./store.mjs";

const UUID = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
const TRANSIENT = new Set([429, 502, 503, 504]);
const ATTEMPTS = 4;
const USER_AGENT = "script-library-cli";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Minimal cookie jar: Node's fetch does not keep cookies between calls. */
export class Jar {
  constructor(cookies = {}) { this.cookies = { ...cookies }; }
  header() {
    const pairs = Object.entries(this.cookies).filter(([, value]) => value);
    return pairs.length ? pairs.map(([key, value]) => `${key}=${value}`).join("; ") : "";
  }
  absorb(response) {
    const lines = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookie(response.headers.get("set-cookie"));
    for (const line of lines) {
      const pair = line.split(";", 1)[0];
      const equal = pair.indexOf("=");
      if (equal < 1) continue;
      const name = pair.slice(0, equal).trim();
      const value = pair.slice(equal + 1).trim();
      if (!/^[A-Za-z0-9_!#$%&'*+.^`|~-]+$/.test(name)) continue;
      if (value) this.cookies[name] = value;
      else delete this.cookies[name];
    }
    return this;
  }
  toJSON() { return { ...this.cookies }; }
}

/** Splits a joined Set-Cookie header, keeping expiry dates intact. */
function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[A-Za-z0-9_!#$%&'*+.^`|~-]+\s*=)/).map(part => part.trim()).filter(Boolean);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function backoff(previous, attempt, retryAfter) {
  let wait = Math.min(8000, Math.max(previous * 2, 600 * 2 ** Math.min(attempt - 1, 4)));
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) wait = Math.min(30000, Math.max(wait, seconds * 1000));
  return wait + Math.random() * 250;
}

export class Api {
  constructor({ base = "https://scripting.nulls.gg/api", jar, bearer = "", timeout = 20000 } = {}) {
    this.base = base.replace(/\/$/, "");
    this.jar = jar instanceof Jar ? jar : new Jar(jar);
    this.bearer = bearer;
    this.timeout = timeout;
    this.identity = null;
  }

  static fromSession(session, base) {
    if (!session) return null;
    return new Api({ base, jar: session.cookies, bearer: session.bearer });
  }

  get authenticated() { return Boolean(this.identity); }

  session(expires) {
    return { cookies: this.jar.toJSON(), bearer: this.bearer, expires: expires ?? Date.now() + 604800000 };
  }

  async request(method, path, body, { auth = true, retries = ATTEMPTS } = {}) {
    if (!path.startsWith("/") || path.includes("..")) throw new Error("Некорректный путь API");
    let wait = 0;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.once(method, path, body, auth);
      } catch (error) {
        const retryable = (error instanceof ApiError && TRANSIENT.has(error.status))
          || error.name === "TimeoutError"
          || error.name === "AbortError"
          || error.code === "ECONNRESET"
          || error.code === "ECONNREFUSED"
          || error.code === "ENOTFOUND";
        if (!retryable || attempt >= retries) throw error;
        wait = backoff(wait, attempt, error.retryAfter);
        await sleep(wait);
      }
    }
  }

  async once(method, path, body, auth) {
    const headers = { accept: "application/json", "user-agent": USER_AGENT };
    const cookie = this.jar.header();
    if (cookie) headers.cookie = cookie;
    if (this.bearer) headers.authorization = `Bearer ${this.bearer}`;
    if (body !== undefined && body !== null) headers["content-type"] = "application/json";
    const response = await fetch(this.base + path, {
      method,
      headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(this.timeout),
    });
    this.jar.absorb(response);
    const text = await response.text();
    let value = {};
    try { value = text ? JSON.parse(text) : {}; } catch { value = { error: text.slice(0, 200) }; }
    if (!response.ok) {
      const error = new ApiError(response.status, message(response.status, value, path));
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) error.retryAfter = Number(retryAfter);
      throw error;
    }
    return value;
  }

  async login(username, password) {
    const result = await this.request("POST", "/auth/login", { username, password }, { auth: false });
    this.bearer = result.token || result.access_token || "";
    const me = await this.me();
    this.identity = me;
    return me;
  }

  async me() {
    const value = await this.request("GET", "/users/me");
    const uuid = value.uuid || value.user_id || "";
    if (!UUID.test(uuid)) throw new ApiError(502, "Сервис вернул некорректный профиль");
    this.identity = { ...value, uuid };
    return this.identity;
  }

  async restore() {
    try {
      return await this.me();
    } catch {
      return null;
    }
  }

  script(uuid) { return this.request("GET", `/scripts/${uuid}`); }
  scriptContent(uuid) { return this.request("GET", `/scripts/${uuid}/content`); }
  parameters(uuid) { return this.request("GET", `/scripts/${uuid}/parameters`); }
  shareToken(uuid) { return this.request("POST", `/scripts/${uuid}/share`); }
  releases(uuid) { return this.request("GET", `/scripts/${uuid}/releases`); }
  user(target) { return this.request("GET", `/users/${target}`); }
  userScripts(uuid) { return this.request("GET", `/users/${uuid}/scripts`); }
  favorites(uuid) { return this.request("GET", `/users/${uuid}/favorites`); }
  addFavorite(uuid, scriptId) { return this.request("POST", `/users/${uuid}/favorites`, { script_id: scriptId }); }
  removeFavorite(uuid, scriptId) { return this.request("DELETE", `/users/${uuid}/favorites`, { script_id: scriptId }); }
  createScript(name, content) { return this.request("POST", "/scripts", { name, content }); }
  updateContent(uuid, content) { return this.request("PUT", `/scripts/${uuid}/content`, { content }); }
  updateName(uuid, name) { return this.request("PUT", `/scripts/${uuid}/name`, { name }); }
  updateDescription(uuid, description) { return this.request("PUT", `/scripts/${uuid}/description`, { description }); }
  deleteDescription(uuid) { return this.request("DELETE", `/scripts/${uuid}/description`); }
  publish(uuid) { return this.request("POST", `/scripts/${uuid}/publish`); }
  deleteScript(uuid) { return this.request("DELETE", `/scripts/${uuid}`); }
}

function message(status, body, path) {
  const raw = String(body?.error || "");
  const lower = raw.toLowerCase();
  if (path.endsWith("/share") && [400, 403, 404].includes(status)) return "Этот скрипт нельзя использовать в бою, потому что его автор не подтверждён.";
  if (lower.includes("author is not verified") || lower.includes("author not verified") || lower.includes("author does not have connect")) {
    return "Этот скрипт нельзя использовать в бою, потому что его автор не подтверждён.";
  }
  if (status === 401) return path === "/auth/login" ? "Неверное имя пользователя или пароль." : "Сессия завершена. Войдите снова.";
  if (status === 403) return "Аккаунту недоступно это действие.";
  if (status === 404) return "Скрипт или автор не найден.";
  if (status === 429) return "Сервис ограничил частоту запросов. Повторите через минуту.";
  if (status === 409) return "Имя пользователя уже занято.";
  if (status === 400) return raw || "Сервис отклонил запрос. Проверьте параметры.";
  return raw || `Сервис ответил HTTP ${status}`;
}

/** Logs in with stored credentials and keeps the session for the next run. */
export async function connect({ base, remember = true } = {}) {
  const session = loadSession();
  if (!session) return null;
  const api = Api.fromSession(session, base);
  const me = await api.restore();
  if (!me) {
    clearSession();
    return null;
  }
  if (remember) saveSession(api.session(session.expires));
  return api;
}

export function persist(api, expires) {
  saveSession(api.session(expires));
}
