// node scripts/due.mjs [english|strategy] [--date YYYY-MM-DD]
// Prints the items due for revision (revisit.due <= date, not mastered) as a JSON array, one item per line,
// oldest due first. Quiz her with "prompt", compare with "answer", then run scripts/review.mjs <id> got|again.
import { isDue, localToday } from "../src/lib/revisit.mjs";
import { load, option } from "./store.mjs";

const args = process.argv.slice(2);
const date = option(args, "--date") ?? localToday();
const logs = args.length ? args : ["english", "strategy"];
const pick = (e, keys) => Object.fromEntries(keys.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));

const items = logs.flatMap((log) =>
  load(log)
    .filter((e) => isDue(e, date))
    .map((e) =>
      log === "english"
        ? { id: e.id, log, due: e.revisit.due, step: e.revisit.step, seen: e.seen, ...pick(e, ["type", "category", "context"]), prompt: e.original, answer: pick(e, ["better", "why", "drill"]) }
        : { id: e.id, log, due: e.revisit.due, step: e.revisit.step, seen: e.seen, ...pick(e, ["mode", "scenarioId", "pattern"]), prompt: pick(e, ["situation", "whatIDid"]), answer: pick(e, ["betterMove", "principle", "source"]) },
    ),
);
items.sort((a, b) => a.due.localeCompare(b.due));
console.log(items.length ? `[\n${items.map((i) => JSON.stringify(i)).join(",\n")}\n]` : "[]");
