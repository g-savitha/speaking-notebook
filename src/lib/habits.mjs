import { el, tags } from "./table.mjs";
import { trend } from "./revisit.mjs";

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const sum = (values) => values.reduce((a, b) => a + b, 0);
const byNewest = (a, b) => b.lastSeen.localeCompare(a.lastSeen);
const TREND_LABEL = { repeating: "still repeating", improving: "improving", new: "new" };

function fillerTrend(metrics) {
  const wrap = el("section", { "data-component": "filler-trend", "data-points": String(metrics.length) }, el("h2", {}, "Filler words per session"));
  if (!metrics.length) return wrap.append(el("p", { class: "note" }, "No filler counts yet.")), wrap;
  const totals = metrics.map((m) => sum(Object.values(m.fillers)));
  const max = Math.max(...totals, 1);
  const chart = svg("svg", { viewBox: `0 0 ${metrics.length * 14} 44`, width: metrics.length * 28, height: 64, preserveAspectRatio: "none", role: "img", "aria-label": `Filler totals: ${totals.join(", ")}` });
  metrics.forEach((m, i) => {
    const h = Math.max(2, (totals[i] / max) * 40);
    const bar = svg("rect", { x: i * 14 + 2, y: 44 - h, width: 10, height: h, rx: 2, "data-total": totals[i] });
    const title = svg("title", {});
    title.textContent = `${m.date}: ${totals[i]} (${Object.entries(m.fillers).map(([w, n]) => `${w} ${n}`).join(", ")})`;
    bar.append(title);
    chart.append(bar);
  });
  const last = metrics.at(-1);
  const perMin = (totals.at(-1) / (last.durationSec / 60)).toFixed(1);
  wrap.append(chart, el("p", { class: "note" }, `${metrics[0].date} → ${last.date}. Latest: ${totals.at(-1)} fillers, ${perMin}/min${last.wpm ? `, ${last.wpm} wpm` : ""}.`));
  return wrap;
}

function item(entry, today, main, sub) {
  const state = trend(entry, today);
  return el(
    "li",
    { "data-entry-id": entry.id, "data-trend": state },
    el("span", { class: `trend trend-${state}` }, TREND_LABEL[state]),
    tags(entry, ["seen"]),
    el("p", {}, main),
    el("p", { class: "sub" }, sub),
  );
}

function englishHabits(mistakes, today) {
  const wrap = el("section", { "data-component": "habits-english" }, el("h2", {}, "English: most repeated"));
  const groups = Map.groupBy(mistakes, (e) => e.category);
  const ordered = [...groups].map(([category, list]) => ({ category, list: list.sort((a, b) => b.seen - a.seen || byNewest(a, b)), total: sum(list.map((e) => e.seen)) }));
  ordered.sort((a, b) => b.total - a.total);
  if (!ordered.length) wrap.append(el("p", { class: "note" }, "Nothing logged yet."));
  for (const { category, list, total } of ordered) {
    wrap.append(
      el(
        "div",
        { class: "group", "data-category": category, "data-seen-total": String(total) },
        el("h3", {}, `${category} · ${total}×`),
        el("ul", {}, ...list.map((e) => item(e, today, `${e.original} → ${e.better}`, e.why))),
      ),
    );
  }
  return wrap;
}

function strategyHabits(entries, patterns, today) {
  const wrap = el("section", { "data-component": "habits-strategy" }, el("h2", {}, "Strategy: recurring mistakes"));
  const rows = patterns
    .map((pattern) => {
      const list = entries.filter((e) => e.pattern === pattern).sort(byNewest);
      return { pattern, list, count: sum(list.map((e) => e.seen)) };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  if (!rows.length) wrap.append(el("p", { class: "note" }, "Nothing logged yet."));
  for (const { pattern, list, count } of rows) {
    wrap.append(
      el(
        "div",
        { class: "group", "data-pattern": pattern, "data-count": String(count) },
        el("h3", {}, `${pattern} · ${count}×`),
        el("ul", {}, ...list.slice(0, 3).map((e) => item(e, today, e.situation, e.betterMove))),
      ),
    );
  }
  return wrap;
}

export function mountHabits(container, { english, strategy, patterns, today }) {
  const tracked = [...english.filter((e) => e.type !== "metric"), ...strategy];
  const repeating = tracked.filter((e) => trend(e, today) === "repeating").length;
  const improving = tracked.filter((e) => trend(e, today) === "improving").length;
  container.dataset.repeating = String(repeating);
  container.dataset.improving = String(improving);
  const summary = el("p", { class: "count" }, `${repeating} still repeating (seen again in the last 14 days) · ${improving} improving (not seen for 14+ days)`);
  const metrics = english.filter((e) => e.type === "metric").sort((a, b) => a.date.localeCompare(b.date));
  container.replaceChildren(summary, fillerTrend(metrics), englishHabits(english.filter((e) => e.type !== "metric"), today), strategyHabits(strategy, patterns, today));
}
