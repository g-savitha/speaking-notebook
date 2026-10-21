// Usage: node scripts/verify-ui.mjs [url] [screenshotDir]
// url defaults to the local preview (npm run build && npm run preview). Live: https://g-savitha.github.io/speaking-notebook/
// Needs Chrome at CHROME_PATH (default /usr/bin/google-chrome); playwright-core is a devDependency.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [url = "http://localhost:4321/speaking-notebook/", shots] = process.argv.slice(2);
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures.push(msg); };

const viewports = {
  desktop: { viewport: { width: 1280, height: 900 } },
  iphone: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

for (const [label, options] of Object.entries(viewports)) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    const fromLiveData = m.location().url.startsWith("https://raw.githubusercontent.com/");
    if (m.type() === "error" && !fromLiveData) errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForSelector('#app:not([data-state="loading"])');
  check((await page.getAttribute("#app", "data-state")) === "loaded", `${label}: app data-state=loaded`);
  console.log(`info ${label}: data-source=${await page.getAttribute("#app", "data-source")} (live = raw.githubusercontent.com main, bundled = build-time copy)`);

  for (const tab of await page.locator("button[data-tab]").evaluateAll((bs) => bs.map((b) => b.dataset.tab))) {
    await page.click(`button[data-tab="${tab}"]`);
    const panel = `[data-panel="${tab}"]`;
    const table = `${panel} [data-component="log-table"]`;
    check(await page.isVisible(table), `${label}/${tab}: table visible`);
    const total = Number(await page.getAttribute(table, "data-total"));
    const count = () => page.getAttribute(table, "data-count").then(Number);
    check((await count()) === total, `${label}/${tab}: shows all ${total} entries`);
    const rows = await page.locator(`${table} tbody tr:not(:has(td.empty))`).count();
    check(rows === total, `${label}/${tab}: ${rows} rendered rows match data-total`);

    if (total > 0) {
      const sample = (await page.locator(`${table} tbody tr`).first().locator("td").nth(1).textContent()).trim().split(/\s+/).slice(0, 2).join(" ");
      await page.fill(`${panel} [data-action-id="search"]`, sample);
      const hits = await count();
      check(hits >= 1 && hits <= total, `${label}/${tab}: search "${sample}" -> ${hits} of ${total}`);
    }
    await page.fill(`${panel} [data-action-id="search"]`, "zzqx-no-such-text");
    check((await count()) === 0 && (await page.isVisible(`${table} td.empty`)), `${label}/${tab}: nonsense search -> 0 rows + empty message`);
    await page.fill(`${panel} [data-action-id="search"]`, "");

    for (const select of await page.locator(`${panel} select[data-filter]`).all()) {
      const key = await select.getAttribute("data-filter");
      for (const value of (await select.locator("option").allTextContents()).slice(1)) {
        await select.selectOption(value);
        const cells = await page.locator(`${table} tbody td[data-key="${key}"]`).allTextContents();
        check(cells.length === (await count()) && cells.every((c) => c === value), `${label}/${tab}: filter ${key}="${value}" -> ${cells.length} rows, all match`);
      }
      await select.selectOption("");
      check((await count()) === total, `${label}/${tab}: clearing filter restores ${total}`);
    }

    const reveals = page.locator(`${table} details[data-component="reveal"]`);
    if ((await reveals.count()) > 0) {
      const openCount = await reveals.evaluateAll((ds) => ds.filter((d) => d.open).length);
      check(openCount === 0, `${label}/${tab}: all ${await reveals.count()} reveal sections closed by default`);
      const first = reveals.first();
      check(!(await first.locator("p").first().isVisible()), `${label}/${tab}: sample response hidden before reveal`);
      await first.locator("summary").click();
      check(await first.locator("p").first().isVisible(), `${label}/${tab}: clicking "Reveal after answering" shows the debrief`);
      if (shots) await first.screenshot({ path: `${shots}/${label}-${tab}-revealed.png` });
      await first.locator("summary").click();
    }

    if (label === "iphone") {
      const layout = await page.evaluate((sel) => {
        const row = document.querySelector(`${sel} tbody tr`);
        return { rowDisplay: row && getComputedStyle(row).display, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, table);
      check(layout.rowDisplay === "block" && layout.overflow <= 0, `${label}/${tab}: rows stack as cards, no horizontal scroll (overflow ${layout.overflow}px)`);
    }
    if (shots) await page.screenshot({ path: `${shots}/${label}-${tab}.png`, fullPage: true });
  }
  check(errors.length === 0, `${label}: no console errors${errors.length ? ` (${errors.join("; ")})` : ""}`);
  await page.close();
}
await browser.close();
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
