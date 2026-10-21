# AGENTS.md

A small Astro site. Its content lives in `data/*.json` on `main`. See README.md for the entry formats.

## Adding entries (most tasks)

1. `git pull`
2. `node scripts/append.mjs <english|strategy|scenarios> '<entry JSON>'`. This appends the entry, adds an `id` to log entries, and validates. On failure it changes nothing and exits 1.
3. `git commit -am "<file>: <date>" && git push`

Do not edit code, rebuild or deploy to add data. The live page fetches `data/*.json` from `main` on raw.githubusercontent.com at load time, which caches for about 5 minutes.
If you edit a data file by hand, `node scripts/validate.mjs` must print `ok` for all three files before you push.
Keep `data/scenarios.json` fields as they are. Kanha owns the bank. Log entries point to it with `scenarioId`.

## Changing code

- Every tab goes through `mountLog()` in `src/lib/table.mjs`. To add a tab, add a config to `tabs` in `src/lib/app.mjs`, a button, and a section in `index.astro`. Don't copy the renderer.
- Never put data into `innerHTML`. Use `el()` or `textContent`.
- Deploy with `npm run deploy` (builds, then pushes `dist/` to `gh-pages`). Don't commit `.github/workflows/`, because our token can't push it.

## Verify (run it, don't assume)

```sh
node scripts/validate.mjs
npm run build && (npm run preview &) && node scripts/verify-ui.mjs                                  # local
node scripts/verify-ui.mjs https://g-savitha.github.io/speaking-notebook/ /tmp/shots                # live
```

`verify-ui.mjs` uses headless Chrome at `CHROME_PATH` (default `/usr/bin/google-chrome`). It loads the page at desktop size and at
iPhone size (402×874). For every tab it checks that all rows render, that search and every filter work, that the reveal sections
start closed and open on click, that rows stack as cards with no horizontal scroll on the phone, and that the console has no errors. It exits 1 on any failure.

### UI hooks

| Selector | Meaning |
| --- | --- |
| `#app[data-state]` | `loading`, then `loaded` or `error` (the message is in `[data-component="status"]`) |
| `#app[data-source]` | `live` (fetched from main) or `bundled` (fallback copy from build time) |
| `#app[data-tab]` | active tab: `english`, `strategy` or `scenarios`. Also deep-linkable as `#english` and so on. |
| `button[data-tab="…"]` | tab buttons (`aria-selected`) |
| `[data-panel="…"]` | tab panels |
| `[data-table="…"][data-component="log-table"]` | `data-total` = entries in the file, `data-count` = rows after search and filter |
| `[data-action-id="search"]`, `[data-action-id="filter-<field>"]` | search box and filter selects inside each panel |
| `tr[data-entry-id]`, `td[data-key]` | a row by entry id, a cell by field |
| `details[data-component="reveal"]` | scenario debrief, closed by default |

To check a data push quickly on the live page, wait for `#app[data-state="loaded"]`. Then confirm that
`[data-table="english"]`'s `data-total` matches the array length in `data/english.json` on main, and that `data-source` is `live`.
