// Tiny argument parser. No dependencies keeps the install fast on every platform.
export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  const lists = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith("--")) {
      const equal = token.indexOf("=");
      const name = equal > 0 ? token.slice(2, equal) : token.slice(2);
      const inline = equal > 0 ? token.slice(equal + 1) : null;
      const takesValue = inline === null && argv[index + 1] !== undefined && !argv[index + 1].startsWith("--");
      const value = inline !== null ? inline : takesValue ? argv[++index] : true;
      if (name === "set" || name === "ban" || name === "tag") {
        lists[name] = [...(lists[name] || []), value];
      } else {
        flags[name] = value;
      }
      continue;
    }
    if (token.startsWith("-") && token.length > 1) {
      for (const letter of token.slice(1)) flags[letter] = true;
      continue;
    }
    positionals.push(token);
  }
  return { positionals, flags, lists };
}

export const asBool = value => value === true || value === "true" || value === "1" || value === "yes";
export const asNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
