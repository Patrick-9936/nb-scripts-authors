// Battle link encoding, matching the Android app byte for byte.
//
// The game receives a Base62 payload that contains the script URL, the 32 battle
// values and the banned brawlers. Values are stored as an offset from the default
// for the parameters the service treats as deltas.
import { DEFAULTS, MAX, MIN, NAMES, isDelta } from "./params.mjs";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const UUID = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;

export const isUuid = value => UUID.test(String(value || ""));

/** Base62 of a byte string, most significant digit first. */
export function base62(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % 62n)] + out;
    value /= 62n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = "0" + out;
  }
  return out || "0";
}

/** Validates and converts values into the array the service expects. */
export function encodeValues(values) {
  if (!Array.isArray(values) || values.length !== 32) throw new Error("Нужно 32 параметра боя");
  return values.map((value, index) => {
    const number = Number(value);
    if (!Number.isInteger(number)) throw new Error(`${NAMES[index]}: нужно целое число`);
    if (number < MIN[index] || number > MAX[index]) throw new Error(`${NAMES[index]}: допустимо ${MIN[index]} … ${MAX[index]}`);
    return isDelta(index) ? number - DEFAULTS[index] : number;
  });
}

/** Builds the nullsbrawl:// link the game opens. */
export function battleLink({ script, token, values, banned = [], map = null, origin = "https://scripting.nulls.gg/api" }) {
  if (!isUuid(script)) throw new Error("Некорректный UUID скрипта");
  if (!token) throw new Error("Нет токена запуска");
  const payload = {
    realm: "experiment:scripts",
    script: `${origin}/scripts/${script}/content?token=${encodeURIComponent(token)}`,
    bp: encodeValues(values),
    bc: [...new Set(banned.map(Number))].sort((a, b) => a - b),
  };
  if (map) payload.map = String(map).trim();
  return `nullsbrawl://createAndJoinRoom?roomname=params:v2:${base62(Buffer.from(JSON.stringify(payload), "utf8"))}&friendly=1&side=0`;
}

/** Parses a nullsbrawl:// link back into its parts. */
export function parseBattleLink(link) {
  const match = /roomname=params:v2:([0-9A-Za-z]+)/.exec(String(link || ""));
  if (!match) throw new Error("Это не ссылка на бой");
  let value = 0n;
  for (const character of match[1]) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) throw new Error("Некорректная ссылка на бой");
    value = value * 62n + BigInt(digit);
  }
  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  const payload = JSON.parse(Buffer.from(bytes).toString("utf8"));
  const values = (payload.bp || []).map((item, index) => (isDelta(index) ? item + DEFAULTS[index] : item));
  const script = /\/scripts\/([0-9a-fA-F-]{36})\//.exec(payload.script || "");
  return { script: script ? script[1] : null, values, banned: payload.bc || [], map: payload.map || null };
}

/** Parses `--set "Уровень боя=5"` and `--set 3=5` into an index and a value. */
export function parseSetting(expression, names = NAMES) {
  const split = String(expression).indexOf("=");
  if (split < 1) throw new Error(`Ожидается "параметр=значение": ${expression}`);
  const key = String(expression).slice(0, split).trim();
  const raw = String(expression).slice(split + 1).trim();
  let index = /^\d+$/.test(key) ? Number(key) : names.findIndex(name => name.toLowerCase() === key.toLowerCase());
  if (index < 0 || index > 31) {
    index = names.findIndex(name => name.toLowerCase().includes(key.toLowerCase()));
  }
  if (index < 0 || index > 31) throw new Error(`Неизвестный параметр: ${key}`);
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${key}: нужно целое число`);
  if (value < MIN[index] || value > MAX[index]) throw new Error(`${key}: допустимо ${MIN[index]} … ${MAX[index]}`);
  return { index, value };
}
