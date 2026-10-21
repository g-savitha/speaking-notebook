import { el, mountLog } from "./table.mjs";
import englishSchema from "../../data/english.schema.json";
import scenariosSchema from "../../data/scenarios.schema.json";

const LIVE_DATA = "https://raw.githubusercontent.com/g-savitha/speaking-notebook/main/data/";
const bundled = {
  english: () => import("../../data/english.json"),
  strategy: () => import("../../data/strategy.json"),
  scenarios: () => import("../../data/scenarios.json"),
};

const app = document.getElementById("app");
const status = app.querySelector('[data-component="status"]');
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

function reveal(entry) {
  const details = el("details", { "data-component": "reveal" });
  details.append(el("summary", {}, "Reveal after answering"));
  details.append(el("h3", {}, "Principles"));
  const list = el("ul");
  for (const { source, citation, idea } of entry.principles) {
    const li = el("li");
    li.append(el("strong", {}, `${source}, ${citation}. `), idea);
    list.append(li);
  }
  details.append(list, el("h3", {}, "Sample response"), el("p", {}, entry.sampleResponse));
  details.append(el("h3", {}, "Common mistake"), el("p", {}, entry.commonMistake));
  return details;
}

const tabs = {
  english: async () => {
    const entries = await getData("english");
    return {
      columns: [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "original", label: "Original" },
        { key: "better", label: "Better version" },
        { key: "notes", label: "Notes" },
      ],
      filters: [{ key: "type", label: "Type", options: englishSchema.items.properties.type.enum }],
      entries,
    };
  },
  strategy: async () => ({
    columns: [
      { key: "date", label: "Date" },
      { key: "scenario", label: "Scenario" },
      { key: "scenarioId", label: "Bank" },
      { key: "answer", label: "Her answer" },
      { key: "feedback", label: "Feedback" },
      { key: "source", label: "Source" },
    ],
    entries: await getData("strategy"),
  }),
  scenarios: async () => {
    const entries = await getData("scenarios");
    return {
      layout: "cards",
      newestFirst: false,
      columns: [
        { key: "id", label: "Id" },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "difficulty", label: "Difficulty" },
        { key: "scenario", label: "Scenario" },
        { key: "question", label: "Question" },
        { key: "reveal", label: "Debrief", render: reveal },
      ],
      filters: [
        { key: "category", label: "Category" },
        { key: "difficulty", label: "Difficulty", options: scenariosSchema.items.properties.difficulty.enum },
      ],
      entries,
    };
  },
};

function selectTab(name) {
  if (!(name in tabs)) name = "english";
  app.dataset.tab = name;
  for (const btn of app.querySelectorAll("[role=tab]")) btn.setAttribute("aria-selected", String(btn.dataset.tab === name));
  for (const panel of app.querySelectorAll("[role=tabpanel]")) panel.hidden = panel.dataset.panel !== name;
}

for (const btn of app.querySelectorAll("[role=tab]")) {
  btn.addEventListener("click", () => {
    history.replaceState(null, "", `#${btn.dataset.tab}`);
    selectTab(btn.dataset.tab);
  });
}
selectTab(location.hash.slice(1));

try {
  const configs = await Promise.all(Object.values(tabs).map((load) => load()));
  Object.keys(tabs).forEach((name, i) => mountLog(app.querySelector(`[data-panel="${name}"]`), { name, ...configs[i] }));
  app.dataset.source = [...new Set(Object.values(sources))].join(" ");
  app.dataset.state = "loaded";
} catch (err) {
  app.dataset.state = "error";
  status.textContent = `Could not load data: ${err.message}`;
}
