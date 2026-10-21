import { el, mountLog, tags } from "./table.mjs";
import { mountRevise } from "./revise.mjs";
import { mountHabits } from "./habits.mjs";
import { isDue, localToday, review } from "./revisit.mjs";
import englishSchema from "../../data/english.schema.json";
import strategySchema from "../../data/strategy.schema.json";
import scenariosSchema from "../../data/scenarios.schema.json";

const LIVE_DATA = "https://raw.githubusercontent.com/g-savitha/speaking-notebook/main/data/";
const bundled = {
  english: () => import("../../data/english.json"),
  strategy: () => import("../../data/strategy.json"),
  scenarios: () => import("../../data/scenarios.json"),
  patterns: () => import("../../data/patterns.json"),
};
const OVERLAY_KEY = "speaking-notebook:reviews";

const app = document.getElementById("app");
const status = app.querySelector('[data-component="status"]');
const panel = (name) => app.querySelector(`[data-panel="${name}"]`);
const today = new URLSearchParams(location.search).get("today") ?? localToday();
const sources = {};

async function getData(name) {
  try {
    const res = await fetch(`${LIVE_DATA}${name}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("not an array");
    sources[name] = "live";
    return data;
  } catch (err) {
    console.warn(`data/${name}.json: live fetch failed (${err.message}); using the copy bundled at build time`);
    sources[name] = "bundled";
    return (await bundled[name]()).default;
  }
}

// Browser taps (Revise view) live in localStorage, keyed by entry id. Each one remembers the repo state it was
// based on; once the repo entry changes (an agent ran review.mjs or --bump), the local overlay is dropped.
const stamp = (e) => JSON.stringify([e.status, e.seen, e.lastSeen, e.revisit]);
function readOverlay() {
  try {
    return JSON.parse(localStorage.getItem(OVERLAY_KEY)) ?? {};
  } catch {
    return {};
  }
}
function applyOverlay(entries, overlay) {
  return entries.map((e) => (overlay[e.id]?.base === stamp(e) ? { ...e, ...overlay[e.id].fields } : e));
}

const state = {};

function onReview(log, id, result) {
  const repoEntry = state.repo[log].find((e) => e.id === id);
  const current = state.view[log].find((e) => e.id === id);
  const { status: s, seen, lastSeen, revisit } = review(current, result, today);
  const overlay = readOverlay();
  overlay[id] = { base: stamp(repoEntry), fields: { status: s, seen, lastSeen, revisit } };
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  render();
}

const englishEnum = (key) => englishSchema.$defs.mistake.properties[key].enum;
const strategyEnum = (key) => strategySchema.items.properties[key].enum;
const block = (...parts) => el("span", { class: "stack" }, ...parts.filter(Boolean));
const small = (label, text) => (text ? el("span", { class: "sub" }, `${label}: ${text}`) : null);
const quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;

function attemptCommand(scenario) {
  const entry = { date: today, mode: "scenario", scenarioId: scenario.id, situation: scenario.title, whatIDid: "", whatWentWrong: "", betterMove: "", principle: "", source: "", pattern: "" };
  const command = `node scripts/append.mjs strategy ${quote(JSON.stringify(entry))}`;
  const copy = el("button", { type: "button", "data-action-id": "copy-command" }, "Copy");
  copy.addEventListener("click", () => navigator.clipboard?.writeText(command).then(() => (copy.textContent = "Copied")));
  return el(
    "details",
    { "data-component": "log-attempt" },
    el("summary", { "data-action-id": "log-attempt" }, "Log my attempt"),
    el("p", { class: "note" }, `Fill in the empty fields (pattern: one of ${state.patterns.join(", ")}), then run in the repo:`),
    el("pre", { "data-component": "append-command" }, command),
    copy,
  );
}

function debrief(entry) {
  const details = el("details", { "data-component": "reveal" }, el("summary", {}, "Reveal after answering"), el("h3", {}, "Principles"));
  details.append(el("ul", {}, ...entry.principles.map(({ source, citation, idea }) => el("li", {}, el("strong", {}, `${source}, ${citation}. `), idea))));
  details.append(el("h3", {}, "Sample response"), el("p", {}, entry.sampleResponse), el("h3", {}, "Common mistake"), el("p", {}, entry.commonMistake));
  return details;
}

const views = {
  english: () =>
    mountLog(panel("english"), {
      name: "english",
      entries: state.view.english.filter((e) => e.type !== "metric"),
      columns: [
        { key: "date", label: "Date" },
        { key: "original", label: "Original" },
        { key: "better", label: "Better version" },
        { key: "why", label: "Why", render: (e) => block(e.why, small("Drill", e.drill), small("Notes", e.notes)), search: (e) => [e.why, e.drill, e.notes].join(" ") },
        { key: "tags", label: "Tags", render: (e) => tags(e, ["type", "category", "context", "status", "seen"]), search: (e) => [e.type, e.category, e.context].join(" ") },
      ],
      filters: ["type", "category", "context", "status"].map((key) => ({ key, label: key[0].toUpperCase() + key.slice(1), options: englishEnum(key) })),
    }),
  strategy: () =>
    mountLog(panel("strategy"), {
      name: "strategy",
      layout: "cards",
      entries: state.view.strategy,
      columns: [
        { key: "date", label: "Date" },
        { key: "tags", label: "", render: (e) => tags(e, ["mode", "scenarioId", "pattern", "status", "seen"]), search: (e) => [e.pattern, e.scenarioId].join(" ") },
        { key: "situation", label: "Situation" },
        { key: "whatIDid", label: "What I did" },
        { key: "whatWentWrong", label: "What went wrong" },
        { key: "betterMove", label: "Better move" },
        { key: "principle", label: "Principle", render: (e) => block(e.principle, small("Source", e.source)), search: (e) => `${e.principle} ${e.source ?? ""}` },
      ],
      filters: [
        { key: "mode", label: "Mode", options: strategyEnum("mode") },
        { key: "pattern", label: "Pattern", options: state.patterns },
        { key: "status", label: "Status", options: strategyEnum("status") },
      ],
    }),
  revise: () => {
    const items = ["english", "strategy"]
      .flatMap((log) => state.view[log].filter((e) => isDue(e, today)).map((entry) => ({ log, entry })))
      .sort((a, b) => a.entry.revisit.due.localeCompare(b.entry.revisit.due));
    mountRevise(panel("revise"), { items, today, onReview });
  },
  habits: () => mountHabits(panel("habits"), { english: state.view.english, strategy: state.view.strategy, patterns: state.patterns, today }),
  scenarios: () =>
    mountLog(panel("scenarios"), {
      name: "scenarios",
      layout: "cards",
      newestFirst: false,
      entries: state.scenarios,
      columns: [
        { key: "id", label: "Id" },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "difficulty", label: "Difficulty" },
        { key: "scenario", label: "Scenario" },
        { key: "question", label: "Question" },
        { key: "reveal", label: "Debrief", render: debrief },
        { key: "attempt", label: "", render: attemptCommand },
      ],
      filters: [
        { key: "category", label: "Category" },
        { key: "difficulty", label: "Difficulty", options: scenariosSchema.items.properties.difficulty.enum },
      ],
    }),
};

function render() {
  const overlay = readOverlay();
  state.view = { english: applyOverlay(state.repo.english, overlay), strategy: applyOverlay(state.repo.strategy, overlay) };
  const applied = [...state.repo.english, ...state.repo.strategy].filter((e) => overlay[e.id]?.base === stamp(e)).length;
  app.dataset.overlayCount = String(applied);
  for (const mount of Object.values(views)) mount();
}

function selectTab(name) {
  if (!(name in views)) name = "revise";
  app.dataset.tab = name;
  for (const btn of app.querySelectorAll("[role=tab]")) btn.setAttribute("aria-selected", String(btn.dataset.tab === name));
  for (const section of app.querySelectorAll("[role=tabpanel]")) section.hidden = section.dataset.panel !== name;
}

for (const btn of app.querySelectorAll("[role=tab]")) {
  btn.addEventListener("click", () => {
    history.replaceState(null, "", `#${btn.dataset.tab}`);
    selectTab(btn.dataset.tab);
  });
}
selectTab(location.hash.slice(1));

try {
  const [english, strategy, scenarios, patterns] = await Promise.all(["english", "strategy", "scenarios", "patterns"].map(getData));
  Object.assign(state, { repo: { english, strategy }, scenarios, patterns });
  render();
  app.dataset.today = today;
  app.dataset.source = [...new Set(Object.values(sources))].join(" ");
  app.dataset.state = "loaded";
} catch (err) {
  app.dataset.state = "error";
  status.textContent = `Could not load data: ${err.message}`;
}
