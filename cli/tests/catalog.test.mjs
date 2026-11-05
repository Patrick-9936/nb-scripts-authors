import test from "node:test";
import assert from "node:assert/strict";
import { handles, reference, search, sortScripts } from "../src/catalog.mjs";

const scripts = [
  { uuid: "10000000-0000-0000-0000-000000000001", name: "Защита сейфа", description: "щит", author_name: "D2", author_username: "d2rkmean", published_at: "2026-09-30T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
  { uuid: "10000000-0000-0000-0000-000000000002", name: "Auto dodge", description: "уклонение", author_name: "Other", author_username: "other", published_at: "2026-10-02T00:00:00Z", updated_at: "2026-09-29T00:00:00Z" },
];

test("the registry parser keeps order, drops duplicates and ignores foreign hosts", () => {
  const text = [
    "1. https://scripting.donutquine.dev/@ban",
    "2. https://scripting.nulls.gg/users/@daily1337",
    "3. https://scripting.nulls.gg/@ban",
    "4. https://evil.example/@bad",
    "5. https://scripting.nulls.gg/users/dfae9193-f08a-4c72-8236-fb9d3f4d616f",
  ].join("\n");
  assert.deepEqual(handles(text), ["ban", "daily1337"]);
});

test("references are recognized as a script or an author", () => {
  assert.deepEqual(reference("01a1796b-7367-7d34-8f74-a49118c053cb"), { kind: "script", value: "01a1796b-7367-7d34-8f74-a49118c053cb" });
  assert.deepEqual(reference("https://scripting.nulls.gg/scripts/01a1796b-7367-7d34-8f74-a49118c053cb"), { kind: "script", value: "01a1796b-7367-7d34-8f74-a49118c053cb" });
  assert.deepEqual(reference("https://scripting.nulls.gg/@hello"), { kind: "author", value: "hello" });
  assert.deepEqual(reference("https://scripting.donutquine.dev/users/@daily1337"), { kind: "author", value: "daily1337" });
  assert.deepEqual(reference("@kyro"), { kind: "author", value: "kyro" });
  assert.equal(reference("https://evil.example/@bad"), null);
  assert.equal(reference(""), null);
});

test("search covers the same fields the site searches", () => {
  assert.equal(search(scripts, "сейф").length, 1);
  assert.equal(search(scripts, "d2rkmean").length, 1);
  assert.equal(search(scripts, "уклонение").length, 1);
  assert.equal(search(scripts, "10000000-0000-0000-0000-000000000002").length, 1);
  assert.equal(search(scripts, "сейф", "author").length, 0);
  assert.equal(search(scripts, "d2rkmean", "author").length, 1);
  assert.equal(search(scripts, "").length, 2);
});

test("sorting is stable and covers every mode", () => {
  assert.equal(sortScripts(scripts, "new")[0].name, "Auto dodge");
  assert.equal(sortScripts(scripts, "old")[0].name, "Защита сейфа");
  assert.equal(sortScripts(scripts, "updated")[0].name, "Защита сейфа");
  // Node's ru collation places Cyrillic before Latin, which is what the site does too.
  assert.equal(sortScripts(scripts, "az")[0].name, "Защита сейфа");
  assert.equal(sortScripts(scripts, "za")[0].name, "Auto dodge");
  assert.equal(sortScripts(scripts, "unknown").length, 2);
});
