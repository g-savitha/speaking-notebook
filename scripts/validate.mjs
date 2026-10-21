// Usage: node scripts/validate.mjs [english|strategy|scenarios|patterns ...]   (no args = all)
// Checks data/<name>.json against data/<name>.schema.json (the JSON Schema subset those files use),
// plus rules a schema can't express: unique ids, real dates, scenarioId only for mode "scenario" and present
// in the bank, pattern listed in data/patterns.json, lastSeen not before date.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FILES = ["english", "strategy", "scenarios", "patterns"];
const root = fileURLToPath(new URL("../data/", import.meta.url));
const read = (file) => JSON.parse(readFileSync(`${root}${file}`, "utf8"));

const typeOf = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);

function isRealDate(value) {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function check(value, schema, at, rootSchema) {
  if (schema.$ref) return check(value, schema.$ref.split("/").slice(1).reduce((s, k) => s[k], rootSchema), at, rootSchema);
  if (schema.oneOf) {
    const results = schema.oneOf.map((branch) => check(value, branch, at, rootSchema));
    return results.find((r) => r.length === 0) ?? results.reduce((a, b) => (b.length < a.length ? b : a));
  }
  const actual = typeOf(value);
  if (actual !== schema.type && !(schema.type === "number" && actual === "integer")) return [`${at}: must be ${schema.type}, got ${actual}`];
  const errors = [];
  if ("const" in schema && value !== schema.const) errors.push(`${at}: must be "${schema.const}"`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: "${value}" is not one of ${schema.enum.map((v) => `"${v}"`).join(", ")}`);
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: must be >= ${schema.minimum}`);
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: must be <= ${schema.maximum}`);
  if (actual === "string") {
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${at}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: "${value}" does not match ${schema.pattern}`);
    else if (schema.format === "date" && !isRealDate(value)) errors.push(`${at}: "${value}" is not a real calendar date`);
  }
  if (actual === "array") {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errors.push(`${at}: items must be unique`);
    value.forEach((item, i) => errors.push(...check(item, schema.items, `${at}[${i}]`, rootSchema)));
  }
  if (actual === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at}: missing required field "${key}"`);
    for (const [key, v] of Object.entries(value)) {
      const rule = schema.properties?.[key] ?? (typeof schema.additionalProperties === "object" ? schema.additionalProperties : null);
      if (rule) errors.push(...check(v, rule, `${at}.${key}`, rootSchema));
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown field "${key}" (allowed: ${Object.keys(schema.properties).join(", ")})`);
    }
  }
  return errors;
}

function crossChecks(name, data) {
  const errors = [];
  const at = (i) => `data/${name}.json[${i}]`;
  const ids = new Set();
  data.forEach((entry, i) => {
    if (!entry?.id) return;
    if (ids.has(entry.id)) errors.push(`${at(i)}.id: duplicate id "${entry.id}"`);
    ids.add(entry.id);
    if (entry.lastSeen && entry.date && entry.lastSeen < entry.date) errors.push(`${at(i)}.lastSeen: before date`);
  });
  if (name === "strategy") {
    const bank = new Set(read("scenarios.json").map((s) => s.id));
    const patterns = read("patterns.json");
    data.forEach((entry, i) => {
      if (entry.mode === "scenario" && !entry.scenarioId) errors.push(`${at(i)}: mode "scenario" needs scenarioId`);
      if (entry.mode === "debrief" && entry.scenarioId) errors.push(`${at(i)}.scenarioId: only allowed for mode "scenario"`);
      if (entry.scenarioId && !bank.has(entry.scenarioId)) errors.push(`${at(i)}.scenarioId: "${entry.scenarioId}" is not an id in data/scenarios.json`);
      if (entry.pattern && !patterns.includes(entry.pattern)) errors.push(`${at(i)}.pattern: "${entry.pattern}" is not in data/patterns.json (${patterns.join(", ")})`);
    });
  }
  return errors;
}

export function validate(names = FILES, log = console.log) {
  const unknown = names.filter((n) => !FILES.includes(n));
  if (unknown.length) return [`unknown data file(s): ${unknown.join(", ")} (expected ${FILES.join(", ")})`];
  return names.flatMap((name) => {
    let data;
    try {
      data = read(`${name}.json`);
    } catch (e) {
      return [`data/${name}.json: not valid JSON (${e.message})`];
    }
    const schema = read(`${name}.schema.json`);
    const errors = check(data, schema, `data/${name}.json`, schema);
    if (Array.isArray(data) && name !== "patterns") errors.push(...crossChecks(name, data));
    if (errors.length === 0) log(`ok  data/${name}.json (${data.length} entries)`);
    return errors;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validate(process.argv.length > 2 ? process.argv.slice(2) : FILES);
  for (const e of errors) console.error(`ERR ${e}`);
  process.exit(errors.length ? 1 : 0);
}
