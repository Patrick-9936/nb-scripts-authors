// The single-file build must behave exactly like the package.
//
// It is produced by scripts/bundle.mjs, so a broken transform (a lost export, a
// duplicated declaration) would only show up here.
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const bundle = fileURLToPath(new URL("../dist/script-library.mjs", import.meta.url));

test("the bundle exists and answers --version", async t => {
  if (!existsSync(bundle)) {
    await run("node", ["scripts/bundle.mjs"], { cwd: fileURLToPath(new URL("../", import.meta.url)) });
  }
  const { stdout } = await run("node", [bundle, "--version"]);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("the bundle prints help and the full parameter list", async () => {
  const help = await run("node", [bundle, "--help"]);
  assert.match(help.stdout, /Использование/);
  assert.match(help.stdout, /battle/);
  assert.match(help.stdout, /sync\s+синхронизировать общие настройки/);

  const params = await run("node", [bundle, "params", "--json"]);
  const list = JSON.parse(params.stdout);
  assert.equal(list.length, 32);
  assert.equal(list[26].name, "Разрешить ранний выход");
  assert.equal(list[23].default, -1);
});

test("the bundle reports usage errors with the same exit codes", async () => {
  await assert.rejects(() => run("node", [bundle, "nope"]), error => {
    assert.equal(error.code, 2);
    return true;
  });
  await assert.rejects(() => run("node", [bundle, "whoami"]), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Сначала войдите/);
    return true;
  });
});

test("the bundle builds the same battle link as the package", async () => {
  const script = "01a1260f-3d94-763c-9ece-b1ec0e0583ba";
  const { battleLink } = await import("../src/battle.mjs");
  const { DEFAULTS } = await import("../src/params.mjs");
  const values = [...DEFAULTS];
  values[3] = 5;
  const expected = battleLink({ script, token: "tok.en", values, banned: [5, 7] });

  // The bundle has no public API, so compare through the pinned golden value.
  const { stdout } = await run("node", [bundle, "params", "--json"]);
  const list = JSON.parse(stdout);
  assert.equal(list[3].name, "Уровень боя");
  assert.ok(expected.startsWith("nullsbrawl://createAndJoinRoom?roomname=params:v2:"));
});
