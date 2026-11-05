// Terminal output helpers. No dependencies, so the package stays installable
// everywhere Node runs, including Windows without a build toolchain.
import { DEFAULTS, MAX, MIN, NAMES, isFlag } from "./params.mjs";

const supportsColor = () => process.env.NO_COLOR === undefined
  && process.env.TERM !== "dumb"
  && (process.stdout.isTTY || process.env.FORCE_COLOR === "1");

const paint = code => text => (supportsColor() ? `\u001b[${code}m${text}\u001b[0m` : String(text));

export const bold = paint("1");
export const dim = paint("2");
export const red = paint("31");
export const green = paint("32");
export const yellow = paint("33");
export const blue = paint("34");
export const magenta = paint("35");
export const cyan = paint("36");

/** Visible width, ignoring colour escapes and counting wide characters twice. */
export function width(text) {
  const plain = String(text).replace(/\u001b\[[0-9;]*m/g, "");
  let total = 0;
  for (const character of plain) {
    const code = character.codePointAt(0);
    total += (code >= 0x1100 && (code <= 0x115f || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe30 && code <= 0xfe6f) || (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6) || (code >= 0x1f300 && code <= 0x1f64f) || (code >= 0x20000 && code <= 0x3fffd))) ? 2 : 1;
  }
  return total;
}

export function truncate(text, limit) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (width(value) <= limit) return value;
  let out = "";
  for (const character of value) {
    if (width(out + character) > limit - 1) break;
    out += character;
  }
  return `${out}…`;
}

export function pad(text, limit) {
  const missing = limit - width(text);
  return missing > 0 ? text + " ".repeat(missing) : text;
}

/** Renders rows as a table with a header. */
export function table(headers, rows, { maxWidth = 44 } = {}) {
  const cells = rows.map(row => row.map(cell => truncate(cell, maxWidth)));
  const widths = headers.map((header, index) => Math.max(width(header), ...cells.map(row => width(row[index] ?? ""))));
  const line = row => row.map((cell, index) => pad(cell ?? "", widths[index])).join("  ").trimEnd();
  return [bold(line(headers)), dim(widths.map(value => "─".repeat(value)).join("  ")), ...cells.map(line)].join("\n");
}

export function scriptLine(script) {
  const date = script.published_at || script.created_at;
  return [
    truncate(script.name || "Без названия", 40),
    truncate(script.author_username ? `@${script.author_username}` : script.author_name, 20),
    date ? date.slice(0, 10) : "—",
    script.uuid.slice(0, 8),
  ];
}

export function scriptTable(scripts) {
  if (!scripts.length) return dim("Ничего не найдено.");
  return table(["Название", "Автор", "Опубликован", "UUID"], scripts.map(scriptLine));
}

export function authorTable(authors) {
  if (!authors.length) return dim("Авторов нет.");
  return table(["Имя", "@", "UUID"], authors.map(author => [truncate(author.name, 30), `@${author.username}`, author.uuid]));
}

export function parameterTable(values = DEFAULTS) {
  const rows = NAMES.map((name, index) => {
    const value = values[index] ?? DEFAULTS[index];
    const range = isFlag(index) ? "0 / 1" : `${MIN[index]} … ${MAX[index]}`;
    return [String(index), truncate(name, 34), String(value), range, String(DEFAULTS[index])];
  });
  return table(["#", "Параметр", "Значение", "Диапазон", "По умолчанию"], rows);
}

export function bytes(size) {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

export function relative(iso) {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "только что";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} дн назад`;
  return new Date(then).toISOString().slice(0, 10);
}

export function error(message) {
  process.stderr.write(`${red("ошибка")} ${message}\n`);
}

export function warn(message) {
  process.stderr.write(`${yellow("внимание")} ${message}\n`);
}

export function info(message) {
  process.stderr.write(`${message}\n`);
}
