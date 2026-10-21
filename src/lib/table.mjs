export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
  node.append(...children.filter((c) => c !== undefined && c !== null && c !== ""));
  return node;
}

export function tags(entry, keys) {
  const wrap = el("span", { class: "tags" });
  for (const key of keys) if (entry[key] !== undefined) wrap.append(el("span", { class: "tag", "data-tag": key }, key === "seen" ? `seen ×${entry.seen}` : String(entry[key])));
  return wrap;
}

function sortNewestFirst(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (b.entry.date ?? "").localeCompare(a.entry.date ?? "") || b.index - a.index)
    .map(({ entry }) => entry);
}

function matches(entry, columns, query, filterValues) {
  for (const [key, value] of Object.entries(filterValues)) {
    if (value && entry[key] !== value) return false;
  }
  if (!query) return true;
  return columns.some(({ key, render, search }) => {
    const text = search ? search(entry) : render ? "" : entry[key];
    return String(text ?? "").toLowerCase().includes(query);
  });
}

export function mountLog(container, { name, columns, filters = [], entries, layout = "table", newestFirst = true }) {
  const rows = newestFirst ? sortNewestFirst(entries) : entries;
  const controls = el("div", { class: "controls" });
  const search = el("input", { type: "search", placeholder: "Search…", "aria-label": `Search ${name}`, "data-action-id": "search" });
  controls.append(search);
  const selects = filters.map(({ key, label, options = [...new Set(rows.map((e) => e[key]))].sort() }) => {
    const select = el("select", { "aria-label": label, "data-action-id": `filter-${key}`, "data-filter": key });
    select.append(el("option", { value: "" }, `Any ${label.toLowerCase()}`));
    for (const option of options) select.append(el("option", { value: option }, option));
    controls.append(select);
    return select;
  });

  const count = el("p", { class: "count", "aria-live": "polite" });
  const table = el("table", { "data-component": "log-table", "data-table": name, "data-total": String(rows.length), "data-layout": layout });
  const headRow = el("tr");
  for (const { label } of columns) headRow.append(el("th", { scope: "col" }, label));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(headRow);

  function render() {
    const query = search.value.trim().toLowerCase();
    const filterValues = Object.fromEntries(selects.map((s) => [s.dataset.filter, s.value]));
    const visible = rows.filter((entry) => matches(entry, columns, query, filterValues));
    const body = el("tbody");
    for (const entry of visible) {
      const tr = el("tr", { "data-entry-id": entry.id });
      for (const { key } of filters) if (entry[key] !== undefined) tr.setAttribute(`data-filter-${key}`, entry[key]);
      for (const { key, label, render } of columns) {
        const td = el("td", { "data-key": key, "data-label": label });
        if (render) td.append(render(entry));
        else td.textContent = entry[key] ?? "";
        tr.append(td);
      }
      body.append(tr);
    }
    if (visible.length === 0) {
      const tr = el("tr");
      tr.append(el("td", { class: "empty", colspan: String(columns.length) }, rows.length ? "No matching entries." : "No entries yet."));
      body.append(tr);
    }
    table.tBodies[0].replaceWith(body);
    table.dataset.count = String(visible.length);
    count.textContent = `${visible.length} of ${rows.length} entries`;
  }

  search.addEventListener("input", render);
  for (const s of selects) s.addEventListener("change", render);
  container.replaceChildren(controls, count, table);
  render();
}
