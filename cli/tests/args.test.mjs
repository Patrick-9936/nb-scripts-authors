import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, asBool, asNumber } from "../src/args.mjs";

test("flags, values and repeated options are parsed", () => {
  const parsed = parseArgs(["battle", "abc", "--set", "a=1", "--set", "b=2", "--ban", "5,7", "--launch", "--limit", "5"]);
  assert.deepEqual(parsed.positionals, ["battle", "abc"]);
  assert.deepEqual(parsed.lists.set, ["a=1", "b=2"]);
  assert.deepEqual(parsed.lists.ban, ["5,7"]);
  assert.equal(parsed.flags.launch, true);
  assert.equal(parsed.flags.limit, "5");
});

test("--key=value and short flags work", () => {
  const parsed = parseArgs(["--limit=10", "-v", "--", "--not-a-flag"]);
  assert.equal(parsed.flags.limit, "10");
  assert.equal(parsed.flags.v, true);
  assert.deepEqual(parsed.positionals, ["--not-a-flag"]);
});

test("a flag followed by another flag stays boolean", () => {
  const parsed = parseArgs(["--json", "--refresh"]);
  assert.equal(parsed.flags.json, true);
  assert.equal(parsed.flags.refresh, true);
});

test("coercion helpers behave", () => {
  assert.equal(asBool("true"), true);
  assert.equal(asBool(undefined), false);
  assert.equal(asNumber("5", 1), 5);
  assert.equal(asNumber("nope", 1), 1);
});

test("--help and --version succeed, a missing command is a usage error", async () => {
  const { run } = await import("../src/cli.mjs");
  const quiet = async argv => {
    const write = process.stdout.write;
    process.stdout.write = () => true;
    try { return await run(argv); } finally { process.stdout.write = write; }
  };
  assert.equal(await quiet(["--help"]), 0);
  assert.equal(await quiet(["-h"]), 0);
  assert.equal(await quiet(["--version"]), 0);
  assert.equal(await quiet([]), 1);
  assert.equal(await quiet(["nope"]), 2);
});
