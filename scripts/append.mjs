// Usage: node scripts/append.mjs <english|strategy|scenarios> '<entry JSON object or array of objects>'
// Appends to data/<file>.json, fills in "id" (<date>-<n>) when missing, then runs validate.mjs.
// If validation fails the file is restored unchanged and the exit code is 1.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [name, json] = process.argv.slice(2);
if (!["english", "strategy", "scenarios"].includes(name) || !json) {
  console.error("usage: node scripts/append.mjs <english|strategy|scenarios> '<entry JSON>'");
  process.exit(2);
}
const path = fileURLToPath(new URL(`../data/${name}.json`, import.meta.url));
const before = readFileSync(path, "utf8");
const data = JSON.parse(before);
const incoming = [JSON.parse(json)].flat();
for (const [i, entry] of incoming.entries()) {
  if (!entry.id && entry.date) {
    const n = data.filter((e) => e.id?.startsWith(`${entry.date}-`)).length + 1;
    incoming[i] = { id: `${entry.date}-${n}`, ...entry };
  }
  data.push(incoming[i]);
}
writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("validate.mjs", import.meta.url)), name], { stdio: "inherit" });
  console.log(`appended ${incoming.map((e) => e.id).join(", ")}`);
} catch {
  writeFileSync(path, before);
  console.error(`data/${name}.json restored; nothing appended`);
  process.exit(1);
}
