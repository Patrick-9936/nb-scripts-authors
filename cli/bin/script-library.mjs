#!/usr/bin/env node
// Script Library CLI. Works on Windows, Linux and macOS on any Node 18+ build.
import { run, interactive } from "../src/cli.mjs";
import { error } from "../src/format.mjs";

const argv = process.argv.slice(2);
try {
  const code = argv.length ? await run(argv) : await interactive();
  process.exitCode = typeof code === "number" ? code : 0;
} catch (failure) {
  error(failure?.message || String(failure));
  if (process.env.SCRIPT_LIBRARY_DEBUG) console.error(failure);
  process.exitCode = 1;
}
