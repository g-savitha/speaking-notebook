// Usage: node scripts/validate.mjs [english|strategy|scenarios ...]   (no args = all three)
// Checks data/<name>.json against data/<name>.schema.json (the subset of JSON Schema those files use),
// plus: real calendar dates, unique ids, and strategy.scenarioId pointing at an existing bank id.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ALL = ["english", "strategy", "scenarios"];
const root = fileURLToPath(new URL("../data/", import.meta.url));
const names = process.argv.length > 2 ? process.argv.slice(2) : ALL;
const read = (file) => JSON.parse(readFileSync(`${root}${file}`, "utf8"));

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  return value === null ? "null" : typeof value;
}

function isRealDate(value) {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function check(value, schema, at) {
  if (typeOf(value) !== schema.type) return [`${at}: must be ${schema.type}, got ${typeOf(value)}`];
  const errors = [];
  if (schema.type === "string") {
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${at}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: "${value}" does not match ${schema.pattern}`);
    else if (at.endsWith(".date") && !isRealDate(value)) errors.push(`${at}: "${value}" is not a real calendar date`);
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: "${value}" is not one of ${schema.enum.map((v) => `"${v}"`).join(", ")}`);
  }
  if (schema.type === "array") {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} item(s)`);
    value.forEach((item, i) => errors.push(...check(item, schema.items, `${at}[${i}]`)));
  }
  if (schema.type === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at}: missing required field "${key}"`);
    for (const [key, v] of Object.entries(value)) {
      if (schema.properties[key]) errors.push(...check(v, schema.properties[key], `${at}.${key}`));
      else errors.push(`${at}: unknown field "${key}" (allowed: ${Object.keys(schema.properties).join(", ")})`);
    }
  }
  return errors;
}

function validate(name) {
  let data;
  try {
    data = read(`${name}.json`);
  } catch (e) {
    return [`data/${name}.json: not valid JSON (${e.message})`];
  }
  const errors = check(data, read(`${name}.schema.json`), `data/${name}.json`);
  if (!Array.isArray(data)) return errors;
  const seen = new Set();
  data.forEach((entry, i) => {
    if (!entry?.id) return;
    if (seen.has(entry.id)) errors.push(`data/${name}.json[${i}].id: duplicate id "${entry.id}"`);
    seen.add(entry.id);
  });
  if (name === "strategy") {
    const bank = new Set(read("scenarios.json").map((s) => s.id));
    data.forEach((entry, i) => {
      if (entry?.scenarioId && !bank.has(entry.scenarioId)) errors.push(`data/strategy.json[${i}].scenarioId: "${entry.scenarioId}" is not an id in data/scenarios.json`);
    });
  }
  if (errors.length === 0) console.log(`ok  data/${name}.json (${data.length} entries)`);
  return errors;
}

const unknown = names.filter((n) => !ALL.includes(n));
if (unknown.length) {
  console.error(`unknown data file(s): ${unknown.join(", ")} (expected ${ALL.join(", ")})`);
  process.exit(2);
}
const errors = names.flatMap(validate);
for (const e of errors) console.error(`ERR ${e}`);
process.exit(errors.length ? 1 : 0);
