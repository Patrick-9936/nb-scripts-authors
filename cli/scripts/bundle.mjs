// Builds one self-contained file that runs with plain `node`.
//
// Publishing to a registry is not required: the bundle can be downloaded from a
// GitHub release and executed directly, which also helps on machines where
// installing global packages is not allowed.
//
// Each module keeps its own scope, so two files may declare the same helper name
// without clashing. Node built-ins are hoisted once at the top; relative imports
// are rewritten to read from the module that was emitted before them.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const read = path => readFileSync(join(root, path), "utf8");

// Emission order: a module appears before every module that imports it.
const MODULES = [
  "src/params.mjs",
  "src/battle.mjs",
  "src/args.mjs",
  "src/format.mjs",
  "src/store.mjs",
  "src/api.mjs",
  "src/catalog.mjs",
  "src/open.mjs",
  "src/update.mjs",
  "src/commands.mjs",
  "src/cli.mjs",
];

const IMPORT = /^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+["']([^"']+)["'];?$/gm;
const EXPORT_DECL = /^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST = /^export\s*\{([^}]*)\};?$/gm;

const builtins = new Map();
const emitted = new Map();

function moduleName(path) {
  return path.replace(/^src\//, "").replace(/\.mjs$/, "");
}

function transform(path, source) {
  const relative = [];
  const names = [];

  let body = source.replace(IMPORT, (match, namespace, named, from) => {
    if (from.startsWith("node:")) {
      const existing = builtins.get(from) || new Set();
      if (namespace) existing.add(`*:${namespace}`);
      else for (const item of named.split(",")) if (item.trim()) existing.add(item.trim());
      builtins.set(from, existing);
      return "";
    }
    const target = moduleName(from.replace(/^\.\//, ""));
    if (!emitted.has(target)) throw new Error(`${path} импортирует ${from}, который ещё не собран`);
    const variable = emitted.get(target);
    if (namespace) {
      relative.push(`const ${namespace} = ${variable};`);
      return "";
    }
    const list = named.split(",").map(item => item.trim()).filter(Boolean);
    names.push(...list);
    return `const { ${list.join(", ")} } = ${variable};`;
  });

  body = body.replace(EXPORT_DECL, (match, kind, name) => {
    names.push(name);
    return `${kind} ${name}`;
  });
  body = body.replace(EXPORT_LIST, (match, list) => {
    const items = list.split(",").map(item => item.trim()).filter(Boolean);
    names.push(...items);
    return "";
  });

  const unique = [...new Set(names)];
  const header = relative.length ? `${relative.join("\n")}\n` : "";
  const footer = unique.length ? `\nreturn { ${unique.join(", ")} };` : "\nreturn {};";
  return `const ${emitted.get(moduleName(path))} = (() => {\n${header}${body.trim()}${footer}\n})();`;
}

const parts = [];
for (const path of MODULES) {
  const name = moduleName(path);
  const variable = `__${name.replace(/[^A-Za-z0-9_$]/g, "_")}`;
  emitted.set(name, variable);
  parts.push(transform(path, read(path)));
}

const builtinLines = [...builtins.entries()].map(([from, set]) => {
  const names = [...set].filter(item => !item.startsWith("*:"));
  const namespaces = [...set].filter(item => item.startsWith("*:")).map(item => item.slice(2));
  const clauses = [];
  if (names.length) clauses.push(`{ ${names.join(", ")} }`);
  for (const namespace of namespaces) clauses.push(`* as ${namespace}`);
  return `import ${clauses.join(", ")} from ${JSON.stringify(from)};`;
});

const bundle = [
  "#!/usr/bin/env node",
  "// Script Library CLI — собранный файл.",
  "// Запуск: node script-library.mjs <команда>",
  "// Исходники: https://github.com/Patrick-9936/nb-scripts-authors/tree/android-script-library/cli",
  "",
  ...builtinLines,
  "",
  ...parts,
  "",
  "const argv = process.argv.slice(2);",
  "try {",
  "  const code = argv.length ? await __cli.run(argv) : await __cli.interactive();",
  "  process.exitCode = typeof code === \"number\" ? code : 0;",
  "} catch (failure) {",
  "  __format.error(failure?.message || String(failure));",
  "  if (process.env.SCRIPT_LIBRARY_DEBUG) console.error(failure);",
  "  process.exitCode = 1;",
  "}",
  "",
].join("\n");

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/script-library.mjs"), bundle);
console.log("Собран один файл:", Buffer.byteLength(bundle), "байт");
