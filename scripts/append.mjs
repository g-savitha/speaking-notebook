// node scripts/append.mjs <english|strategy|scenarios> '<entry JSON or array>'
//   English/strategy: fills id, status "new", seen 1, lastSeen = date, revisit {due: date+1, step 0}.
//   English: an entry whose "original" matches an existing one (ignoring case and spacing) bumps that entry instead.
// node scripts/append.mjs <english|strategy> --bump <id> [--date YYYY-MM-DD]
//   The same mistake came up again: seen+1, lastSeen = date (default today), revisit back to step 0 (due the next day).
import { bump, localToday, normalize, withDefaults } from "../src/lib/revisit.mjs";
import { fail, load, logOf, option, save } from "./store.mjs";

const args = process.argv.slice(2);
const bumpId = option(args, "--bump");
const date = option(args, "--date") ?? localToday();
const [name, json] = args;
const usage = "usage: node scripts/append.mjs <english|strategy|scenarios> '<entry JSON>'\n       node scripts/append.mjs <english|strategy> --bump <id> [--date YYYY-MM-DD]";
if (!["english", "strategy", "scenarios"].includes(name) || (!json && !bumpId)) {
  console.error(usage);
  process.exit(2);
}

const data = load(name);
const done = [];
const bumpAt = (i, on) => {
  data[i] = bump(data[i], on);
  done.push(`bumped ${data[i].id} (seen ${data[i].seen}, due ${data[i].revisit.due})`);
};

if (bumpId) {
  if (name === "scenarios" || logOf(bumpId) !== name) fail(`--bump ${bumpId} doesn't belong to ${name}`);
  const i = data.findIndex((e) => e.id === bumpId);
  if (i === -1) fail(`no entry ${bumpId} in data/${name}.json`);
  bumpAt(i, date);
} else {
  for (const entry of [JSON.parse(json)].flat()) {
    const match = name === "english" && entry.original ? data.findIndex((e) => normalize(e.original) === normalize(entry.original)) : -1;
    if (match !== -1) {
      bumpAt(match, entry.date ?? date);
      continue;
    }
    const added = name === "scenarios" ? entry : withDefaults(name, entry, data);
    data.push(added);
    done.push(`appended ${added.id}`);
  }
}
if (!save(name, data)) process.exit(1);
for (const line of done) console.log(line);
