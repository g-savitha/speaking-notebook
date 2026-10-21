// Usage: node scripts/verify-ui.mjs [url] [screenshotDir] [--bundled]
// url defaults to the local preview (npm run build && npm run preview). Live: https://g-savitha.github.io/speaking-notebook/
// --bundled blocks raw.githubusercontent.com so the page uses the data bundled at build time (for testing sample data).
// Needs Chrome at CHROME_PATH (default /usr/bin/google-chrome); playwright-core is a devDependency.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const bundledOnly = args.includes("--bundled");
const [url = "http://localhost:4321/speaking-notebook/", shots] = args.filter((a) => a !== "--bundled");
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failures.push(msg);
};
const viewports = {
  desktop: { viewport: { width: 1280, height: 900 } },
  iphone: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

async function checkLog(page, label, tab) {
  const panel = `[data-panel="${tab}"]`;
  const table = `${panel} [data-component="log-table"]`;
  check(await page.isVisible(table), `${label}/${tab}: table visible`);
  const total = Number(await page.getAttribute(table, "data-total"));
  const count = () => page.getAttribute(table, "data-count").then(Number);
  const rows = await page.locator(`${table} tbody tr:not(:has(td.empty))`).count();
  check(rows === total && (await count()) === total, `${label}/${tab}: ${rows} rows rendered = data-total ${total}`);
  if (total > 0) {
    const text = await page.locator(`${table} tbody tr`).first().locator('td:not([data-key="date"]):not([data-key="id"]):not([data-key="tags"])').first().textContent();
    const sample = text.trim().split(/\s+/).slice(0, 2).join(" ");
    await page.fill(`${panel} [data-action-id="search"]`, sample);
    const hits = await count();
    check(hits >= 1 && hits <= total, `${label}/${tab}: search "${sample}" -> ${hits} of ${total}`);
  }
  await page.fill(`${panel} [data-action-id="search"]`, "zzqx-no-such-text");
  check((await count()) === 0 && (await page.isVisible(`${table} td.empty`)), `${label}/${tab}: nonsense search -> 0 rows + empty message`);
  await page.fill(`${panel} [data-action-id="search"]`, "");
  for (const select of await page.locator(`${panel} select[data-filter]`).all()) {
    const key = await select.getAttribute("data-filter");
    const results = [];
    for (const value of (await select.locator("option").evaluateAll((os) => os.map((o) => o.value))).slice(1)) {
      await select.selectOption(value);
      const attrs = await page.locator(`${table} tbody tr:not(:has(td.empty))`).evaluateAll((trs, k) => trs.map((tr) => tr.getAttribute(`data-filter-${k}`)), key);
      results.push(attrs.length === (await count()) && attrs.every((a) => a === value) ? attrs.length : NaN);
    }
    await select.selectOption("");
    check(!results.some(Number.isNaN) && (await count()) === total, `${label}/${tab}: filter ${key} (${results.length} options, rows per option ${results.join("/")}) all match, clearing restores ${total}`);
  }
}

for (const [label, options] of Object.entries(viewports)) {
  const page = await browser.newPage(options);
  if (bundledOnly) await page.route("https://raw.githubusercontent.com/**", (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.startsWith("https://raw.githubusercontent.com/")) errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForSelector('#app:not([data-state="loading"])');
  check((await page.getAttribute("#app", "data-state")) === "loaded", `${label}: app data-state=loaded`);
  console.log(`info ${label}: data-source=${await page.getAttribute("#app", "data-source")}, today=${await page.getAttribute("#app", "data-today")}`);
  check((await page.getAttribute("#app", "data-tab")) === "revise", `${label}: opens on Revise`);

  for (const tab of await page.locator("button[data-tab]").evaluateAll((bs) => bs.map((b) => b.dataset.tab))) {
    await page.click(`button[data-tab="${tab}"]`);
    const panel = `[data-panel="${tab}"]`;
    if (await page.locator(`${panel} [data-component="log-table"]`).count()) await checkLog(page, label, tab);

    if (tab === "revise") {
      const due = () => page.getAttribute(panel, "data-due-count").then(Number);
      const before = await due();
      const cards = await page.locator(`${panel} [data-component="revise-card"]`).count();
      check(cards === before, `${label}/revise: ${cards} cards = data-due-count ${before}`);
      if (before > 0) {
        const first = page.locator(`${panel} [data-component="revise-card"]`).first();
        const id = await first.getAttribute("data-entry-id");
        check(!(await first.locator('[data-action-id="review-got"]').isVisible()), `${label}/revise: answer hidden before reveal`);
        await first.locator('[data-action-id="reveal-answer"]').click();
        check(await first.locator('[data-component="answer"] .field').first().isVisible(), `${label}/revise: "Show answer" reveals the fix`);
        if (shots) await first.screenshot({ path: `${shots}/${label}-revise-revealed.png` });
        await first.locator('[data-action-id="review-got"]').click();
        check((await due()) === before - 1 && !(await page.locator(`${panel} [data-entry-id="${id}"]`).count()), `${label}/revise: "Got it" on ${id} removes it (${before} -> ${await due()})`);
        await page.reload();
        await page.waitForSelector('#app[data-state="loaded"]');
        check((await due()) === before - 1 && (await page.getAttribute("#app", "data-overlay-count")) === "1", `${label}/revise: tap survives reload via localStorage (overlay-count 1)`);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#app[data-state="loaded"]');
        check((await due()) === before, `${label}/revise: clearing localStorage restores repo state (${before} due)`);
      }
    }

    if (tab === "habits") {
      const points = Number(await page.getAttribute(`${panel} [data-component="filler-trend"]`, "data-points"));
      const bars = await page.locator(`${panel} [data-component="filler-trend"] rect`).count();
      check(bars === points, `${label}/habits: filler trend has ${bars} bars for ${points} metric entries`);
      const englishItems = await page.locator(`${panel} [data-component="habits-english"] li`).count();
      const englishTotal = await page.locator('[data-table="english"]').getAttribute("data-total");
      check(String(englishItems) === englishTotal, `${label}/habits: ${englishItems} English habits listed = ${englishTotal} logged mistakes`);
      const groups = await page.locator(`${panel} [data-pattern]`).evaluateAll((gs) => gs.map((g) => `${g.dataset.pattern}=${g.dataset.count}`));
      console.log(`info ${label}/habits: repeating=${await page.getAttribute(panel, "data-repeating")} improving=${await page.getAttribute(panel, "data-improving")} patterns: ${groups.join(", ") || "none"}`);
    }

    if (tab === "scenarios") {
      const reveals = page.locator(`${panel} details[data-component="reveal"]`);
      const open = await reveals.evaluateAll((ds) => ds.filter((d) => d.open).length);
      check((await reveals.count()) > 0 && open === 0, `${label}/scenarios: ${await reveals.count()} debriefs closed by default`);
      const attempt = page.locator(`${panel} [data-component="log-attempt"]`).first();
      check(!(await attempt.locator("pre").isVisible()), `${label}/scenarios: append command hidden until "Log my attempt"`);
      await attempt.locator("summary").click();
      const command = await attempt.locator("pre").textContent();
      const json = JSON.parse(command.match(/'(.*)'$/s)[1].replaceAll(`'\\''`, "'"));
      check(json.mode === "scenario" && /^S\d+$/.test(json.scenarioId) && json.situation, `${label}/scenarios: "Log my attempt" shows a command for ${json.scenarioId}`);
      if (shots) await attempt.screenshot({ path: `${shots}/${label}-bank-log-attempt.png` });
      await attempt.locator("summary").click();
    }

    if (label === "iphone") {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `${label}/${tab}: no horizontal scroll (overflow ${overflow}px)`);
    }
    if (shots) await page.screenshot({ path: `${shots}/${label}-${tab}.png`, fullPage: true });
  }
  check(errors.length === 0, `${label}: no console errors${errors.length ? ` (${errors.join("; ")})` : ""}`);
  await page.close();
}
await browser.close();
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
