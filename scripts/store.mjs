import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validate, FILES } from "./validate.mjs";

const path = (name) => fileURLToPath(new URL(`../data/${name}.json`, import.meta.url));

export const load = (name) => JSON.parse(readFileSync(path(name), "utf8"));

// Writes data/<name>.json, validates every file, and restores the old file if anything fails.
export function save(name, data) {
  const before = readFileSync(path(name), "utf8");
  writeFileSync(path(name), `${JSON.stringify(data, null, 2)}\n`);
  const errors = validate(FILES, () => {});
  if (errors.length === 0) return true;
  writeFileSync(path(name), before);
  for (const e of errors) console.error(`ERR ${e}`);
  console.error(`data/${name}.json restored; nothing changed`);
  return false;
}

export function option(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
}

export function logOf(id) {
  if (id?.startsWith("en-")) return "english";
  if (id?.startsWith("st-")) return "strategy";
  fail(`"${id}" is not an English (en-…) or strategy (st-…) id`);
}

export function fail(message) {
  console.error(`ERR ${message}`);
  process.exit(1);
}
