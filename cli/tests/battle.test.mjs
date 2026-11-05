import test from "node:test";
import assert from "node:assert/strict";
import { base62, battleLink, encodeValues, isUuid, parseBattleLink, parseSetting } from "../src/battle.mjs";
import { DEFAULTS, IDS, MAX, MIN, NAMES, indexOfId, isDelta, isFlag } from "../src/params.mjs";

const SCRIPT = "01a1796b-7367-7d34-8f74-a49118c053cb";

test("parameters match the Android app", () => {
  assert.equal(IDS.length, 32);
  assert.equal(NAMES.length, 32);
  assert.equal(DEFAULTS.length, 32);
  assert.equal(MIN.length, 32);
  assert.equal(MAX.length, 32);
  assert.equal(indexOfId("08d59fd7-b5ba-41c0-ac91-0ec36ad2fda7"), 0);
  assert.equal(indexOfId("e42bf28e-fb71-473e-a90c-e8181a1caf2c"), 31);
  assert.equal(NAMES[3], "Уровень боя");
  assert.equal(NAMES[26], "Разрешить ранний выход");
  assert.equal(DEFAULTS[23], -1, "ограничение входа по умолчанию -1");
  assert.equal(isFlag(23), true);
  assert.equal(isDelta(3), true);
  assert.equal(isDelta(20), false);
});

test("base62 matches the Java implementation, including leading zero bytes", () => {
  assert.equal(base62(Buffer.from([1])), "1");
  assert.equal(base62(Buffer.from([62])), "10");
  assert.equal(base62(Buffer.from([0, 1])), "01");
  assert.equal(base62(Buffer.from([0, 0, 1])), "001");
  assert.equal(base62(Buffer.from("A", "utf8")), "13");
  assert.equal(base62(Buffer.from([0x41, 0x41])), "4LR");
});

test("values are validated against the service ranges", () => {
  assert.deepEqual(encodeValues(DEFAULTS), DEFAULTS.map((value, index) => (isDelta(index) ? 0 : value)));
  assert.throws(() => encodeValues([1, 2]), /32 параметра/);
  assert.throws(() => encodeValues(DEFAULTS.map((value, index) => (index === 0 ? 999 : value))), /Уровень здоровья/);
  assert.throws(() => encodeValues(DEFAULTS.map((value, index) => (index === 0 ? 1.5 : value))), /целое число/);
});

test("a battle link round-trips and carries the bans and the map", () => {
  const values = DEFAULTS.map((value, index) => (index === 3 ? 5 : value));
  const link = battleLink({ script: SCRIPT, token: "token.value", values, banned: [7, 5, 5], map: "CR0URL08P:9LUGCUGQYQ8" });
  assert.match(link, /^nullsbrawl:\/\/createAndJoinRoom\?roomname=params:v2:[0-9A-Za-z]+&friendly=1&side=0$/);
  const parsed = parseBattleLink(link);
  assert.equal(parsed.script, SCRIPT);
  assert.deepEqual(parsed.values, values);
  assert.deepEqual(parsed.banned, [5, 7], "bans are unique and sorted");
  assert.equal(parsed.map, "CR0URL08P:9LUGCUGQYQ8");
});

test("a link without a map omits the field", () => {
  const link = battleLink({ script: SCRIPT, token: "t", values: DEFAULTS });
  assert.equal(parseBattleLink(link).map, null);
});

test("bad input is rejected before a link is built", () => {
  assert.throws(() => battleLink({ script: "nope", token: "t", values: DEFAULTS }), /UUID/);
  assert.throws(() => battleLink({ script: SCRIPT, token: "", values: DEFAULTS }), /токена/);
  assert.equal(isUuid(SCRIPT), true);
  assert.equal(isUuid("nope"), false);
  assert.throws(() => parseBattleLink("https://example.com"), /не ссылка на бой/);
});

test("--set accepts a name, a partial name and an index", () => {
  assert.deepEqual(parseSetting("Уровень боя=5"), { index: 3, value: 5 });
  assert.deepEqual(parseSetting("3=5"), { index: 3, value: 5 });
  assert.deepEqual(parseSetting("уровень боя=5"), { index: 3, value: 5 });
  assert.throws(() => parseSetting("Уровень боя"), /параметр=значение/);
  assert.throws(() => parseSetting("Нет такого=1"), /Неизвестный параметр/);
  assert.throws(() => parseSetting("Уровень боя=999"), /допустимо/);
});

test("the encoded link is pinned, so the format cannot drift silently", () => {
  // These strings were produced by the web build and the Android app for the same
  // input. If this test fails, one of the three implementations changed the
  // payload and battle links would stop working across clients.
  const SCRIPT = "01a1260f-3d94-763c-9ece-b1ec0e0583ba";
  const defaults = battleLink({ script: SCRIPT, token: "tok.en", values: [...DEFAULTS] });
  assert.equal(defaults, "nullsbrawl://createAndJoinRoom?roomname=params:v2:Pj3j9U0uoOci1MeN7XaeHdTJmVX6f9EaIGSfYhNwNIvG5xBHnCZ2CDRhKGpbxGIbMRweDQ1P0BVtZspparyAJWbTJuR2LG9Z1GZqHj8m8Zh2sKZexHcH4jJDRtzQ1oeGdbY8vJ5oY77YcY4C7KOcjnar0mGnTXmCld9W5y0AwJpHGlTYc3PJCYdzEvEpfkfuXQQNzsKZU9kRQMsKA7h9UoW2vGrZ3EldPtZv42lE0ov7qbeMvMtvNHvwpbZ0CzsS8MP0Mr338OT9KQd5Xcajn8qWWF202m2woaYSPW5jyREyr&friendly=1&side=0");

  const values = [...DEFAULTS];
  values[3] = 5;
  values[4] = 150;
  const changed = battleLink({ script: SCRIPT, token: "tok.en", values, banned: [5, 7] });
  assert.equal(changed, "nullsbrawl://createAndJoinRoom?roomname=params:v2:820PCcatMgazIIbNL4gLzJt75HF7KlKoXpwNjq2uEoMF8c7wMFWHyhxp9g7tGn3Yk8AagyvCA9V4yEAnTDPsT8aQ4YhbWWsBXK2BFg5mhlL8iYDHWOcwyGAGyXK1XyHIPFb165JtfHoDZufTmuhtmvod7aFAvfiPPipfvrrh0KVvfXEvk3bXvWXuITVUEzwlrFSsbtSFEo5FAZu3bu5Hgd5cyMtZLAudHoEJAsVjkrbW1EgShumIzUlJCQkzkMQrquXvYsZIbSNXKdGoHfeKBQSS4trw6x0FdrRmjsffkEx5gQb2DuOr&friendly=1&side=0");
});
