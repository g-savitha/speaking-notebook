// Spaced revisit rules, shared by the browser (src/lib) and the agent scripts (scripts/).
export const INTERVALS = [1, 3, 7, 21];
export const REPEAT_WINDOW_DAYS = 14;
export const PREFIX = { english: "en", strategy: "st" };

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const normalize = (text) => String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
export const isTracked = (entry) => entry.type !== "metric";
export const startRevisit = (date) => ({ due: addDays(date, INTERVALS[0]), step: 0 });

export function nextId(log, date, entries) {
  const stem = `${PREFIX[log]}-${date}-`;
  const used = entries.filter((e) => e.id?.startsWith(stem)).map((e) => Number(e.id.slice(stem.length)));
  return `${stem}${Math.max(0, ...used) + 1}`;
}

export function withDefaults(log, entry, entries) {
  const filled = { id: entry.id ?? nextId(log, entry.date, entries), ...entry };
  if (!isTracked(filled)) return filled;
  return { status: "new", seen: 1, lastSeen: filled.date, revisit: startRevisit(filled.date), ...filled };
}

export function bump(entry, date) {
  return {
    ...entry,
    seen: (entry.seen ?? 1) + 1,
    lastSeen: date,
    status: entry.status === "mastered" ? "practicing" : entry.status,
    revisit: startRevisit(date),
  };
}

export function review(entry, result, date) {
  if (result === "again") return { ...bump(entry, date), status: "practicing" };
  if (result !== "got") throw new Error(`result must be "got" or "again", not "${result}"`);
  const step = entry.revisit?.step ?? 0;
  if (step >= INTERVALS.length - 1) return { ...entry, status: "mastered" };
  return { ...entry, status: "practicing", revisit: { due: addDays(date, INTERVALS[step + 1]), step: step + 1 } };
}

export const isDue = (entry, date) => isTracked(entry) && entry.status !== "mastered" && entry.revisit?.due <= date;

export function trend(entry, today) {
  if (daysBetween(entry.lastSeen, today) >= REPEAT_WINDOW_DAYS) return "improving";
  return entry.seen > 1 ? "repeating" : "new";
}
