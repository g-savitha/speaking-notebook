// node scripts/review.mjs <id> got|again [--date YYYY-MM-DD]
// Run after testing her on a due item. got: next interval (1, 3, 7, 21 days); got at the last step: mastered.
// again: back to step 0 (due the next day), seen+1, lastSeen = date.
import { localToday, review } from "../src/lib/revisit.mjs";
import { fail, load, logOf, option, save } from "./store.mjs";

const args = process.argv.slice(2);
const date = option(args, "--date") ?? localToday();
const [id, result] = args;
if (!id || !["got", "again"].includes(result)) {
  console.error("usage: node scripts/review.mjs <id> got|again [--date YYYY-MM-DD]");
  process.exit(2);
}
const name = logOf(id);
const data = load(name);
const i = data.findIndex((e) => e.id === id);
if (i === -1 || data[i].type === "metric") fail(`no reviewable entry ${id} in data/${name}.json`);
data[i] = review(data[i], result, date);
if (!save(name, data)) process.exit(1);
const { status, seen, revisit } = data[i];
console.log(`${id}: ${result} -> ${status === "mastered" ? "mastered" : `step ${revisit.step}, due ${revisit.due}`} (seen ${seen})`);
