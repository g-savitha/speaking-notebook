# AGENTS.md

A tutor log, not a diary. Each entry is a mistake with its fix, and it comes back on a 1/3/7/21-day schedule.
The data is JSON in `data/` on `main`. README.md has the exact entry formats.

## Session-start routine (Valmiki: English, Kanha: strategy)

1. `git pull -q && node scripts/due.mjs english` (Kanha: `strategy`). The output is a JSON array of due items. Each has `id`, `prompt` and `answer`.
2. Quiz her on each item from `prompt`, without showing `answer`. Then record the result:
   `node scripts/review.mjs <id> got` if she produced the fix (or close to it), otherwise `node scripts/review.mjs <id> again`.
3. During the session, log new mistakes:
   - `node scripts/append.mjs english '<json>'` or `node scripts/append.mjs strategy '<json>'`.
   - If it's a repeat, use `--bump <id>` instead of adding a duplicate.
   - English entries whose `original` matches an existing one (ignoring case and spacing) are bumped automatically. The script prints `bumped …` or `appended …`.
   - Valmiki: also add one `metric` entry per session with the filler counts.
4. `git commit -qam "<english|strategy>: <date> session" && git push -q`. The live page shows it within about 5 minutes. Don't rebuild or deploy for data.

Rules:
- Fill in `why` (English) and `principle` (strategy) as one plain line.
- Put the exact sentence to say next time in `betterMove`.
- Strategy `situation` names roles, not people.
- Don't hand-edit `seen`, `lastSeen`, `revisit` or `status`. The scripts own them (`src/lib/revisit.mjs` holds the rules).
- Hand edits are fine for typos, but `node scripts/validate.mjs` must print `ok` for every file before you push.
- `data/scenarios.json` is Kanha's bank. Keep its fields as they are.

## Changing code

- Logs go through `mountLog()` (`src/lib/table.mjs`), configured in `views` in `src/lib/app.mjs`. Add a config there; don't copy the renderer.
- No `innerHTML` with data. Use `el()`.
- Deploy with `npm run deploy` (Node 22+). Never commit `.github/workflows/`, because the token can't push it.

## Verify (run it, don't assume)

```sh
node scripts/validate.mjs
npm run build && (npm run preview &) && node scripts/verify-ui.mjs                 # local, live data
node scripts/verify-ui.mjs <url> <shotsDir> --bundled                             # use build-time data
node scripts/verify-ui.mjs <url> <shotsDir> --data /tmp/sample/data               # serve sample data files instead of main
node scripts/verify-ui.mjs https://g-savitha.github.io/speaking-notebook/ /tmp/shots   # live
```

`verify-ui.mjs` runs headless Chrome (`CHROME_PATH`, default `/usr/bin/google-chrome`) at desktop and iPhone (402×874) sizes. It checks:
- every log renders all rows, and search and every filter option work;
- in Revise, the answer stays hidden until revealed, "Got it" removes the item, the tap survives a reload, and clearing localStorage restores the repo state;
- the Habits filler bars match the metric entries;
- the Bank debriefs start closed, and "Log my attempt" shows a valid command;
- on the phone there's no horizontal scroll, and the console has no errors.

It exits 1 on any failure. To test with sample data, copy the repo to /tmp, seed it with `append.mjs`, and run with `--data <copy>/data` (works against the live URL too). Never commit sample data.

### UI hooks

| Selector | Meaning |
| --- | --- |
| `#app[data-state]` | `loading`, then `loaded` or `error` |
| `#app[data-source]` | `live` (main on raw.githubusercontent.com) or `bundled` |
| `#app[data-today]`, `#app[data-overlay-count]` | the date used for "due" (`?today=YYYY-MM-DD` overrides it), and the number of local browser taps applied |
| `#app[data-tab]`, `button[data-tab]`, `[data-panel]` | `revise`, `english`, `strategy`, `habits`, `scenarios`. Deep links work: `#habits` |
| `[data-table][data-component="log-table"]` | `data-total` (entries) and `data-count` (rows after search and filter). Rows have `data-entry-id` and `data-filter-<field>` |
| `[data-action-id="search"]`, `[data-action-id="filter-<field>"]` | search box and filter selects |
| `[data-panel="revise"][data-due-count]`, `[data-component="revise-card"][data-entry-id][data-log]` | due items |
| `[data-action-id="reveal-answer" / "review-got" / "review-again"]` | Revise controls |
| `[data-panel="habits"][data-repeating][data-improving]` | trend counts |
| `[data-component="filler-trend"][data-points]` | filler chart (one `rect` per metric) |
| `[data-category][data-seen-total]`, `[data-pattern][data-count]` | habit groups. Items carry `li[data-trend="repeating"\|"improving"\|"new"]` |
| `details[data-component="reveal"]`, `[data-action-id="log-attempt"]`, `pre[data-component="append-command"]` | Bank debrief and the append command |

Quick live check after a data push: wait for `#app[data-state="loaded"]`, then compare `[data-table="english"]`'s `data-total`
with the number of non-metric entries in `data/english.json` on main.
