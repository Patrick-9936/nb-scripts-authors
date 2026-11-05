import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { configDir } from "../src/store.mjs";

test("the config directory follows each platform's convention", () => {
  const directory = configDir();
  assert.ok(directory.includes("script-library"), "must be namespaced");
  if (process.platform === "win32") assert.ok(directory.includes("AppData") || directory.includes("APPDATA"));
  else if (process.platform === "darwin") assert.ok(directory.includes("Application Support"));
  else assert.ok(directory.includes(".config") || process.env.XDG_CONFIG_HOME);
});

test("download names are safe on Windows and Linux", () => {
  // The same rule the download command uses; a name with separators must not
  // escape the target directory on either platform.
  const safe = name => String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80);
  assert.equal(safe("a/b\\c:d*e?f\"g<h>i|j"), "a_b_c_d_e_f_g_h_i_j");
  assert.equal(safe("x".repeat(200)).length, 80);
  assert.equal(safe("обычное имя"), "обычное имя");
  assert.ok(!safe("../../etc/passwd").includes("/"));
  assert.ok(!safe("..\\..\\windows\\system32").includes("\\"));
});
