import { el, tags } from "./table.mjs";

const field = (label, text) => (text ? el("div", { class: "field" }, el("span", { class: "label" }, label), el("p", {}, text)) : null);

function card({ log, entry }, onReview) {
  const english = log === "english";
  const prompt = english
    ? [field("You said", entry.original)]
    : [field("Situation", entry.situation), field("What you did", entry.whatIDid)];
  const answer = english
    ? [field("Better", entry.better), field("Why", entry.why), field("Drill", entry.drill)]
    : [field("Better move", entry.betterMove), field("Principle", entry.principle), field("Source", entry.source)];
  const buttons = el(
    "div",
    { class: "review-buttons" },
    el("button", { type: "button", "data-action-id": "review-got" }, "Got it"),
    el("button", { type: "button", "data-action-id": "review-again" }, "Again"),
  );
  buttons.addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.actionId;
    if (action) onReview(log, entry.id, action === "review-got" ? "got" : "again");
  });
  const details = el("details", { "data-component": "answer" }, el("summary", { "data-action-id": "reveal-answer" }, "Show answer"), ...answer, buttons);
  const label = english ? ["english", entry.category, entry.context] : ["strategy", entry.mode, entry.pattern];
  return el(
    "article",
    { class: "card", "data-component": "revise-card", "data-log": log, "data-entry-id": entry.id },
    el("p", { class: "kicker" }, label.filter(Boolean).join(" · ")),
    tags(entry, ["seen"]),
    ...prompt,
    details,
  );
}

export function mountRevise(container, { items, today, onReview }) {
  container.dataset.dueCount = String(items.length);
  const heading = el("p", { class: "count" }, items.length ? `${items.length} due today (${today})` : `Nothing due today (${today}).`);
  const note = el("p", { class: "note" }, "Got it / Again taps are saved on this device only. Valmiki and Kanha record reviews in the notebook.");
  container.replaceChildren(heading, ...items.map((item) => card(item, onReview)), note);
}
