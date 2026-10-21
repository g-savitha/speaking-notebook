# Speaking notebook

Rakendu's second brain for the ~30-minute evening sessions. It records where she slips and the fix, and brings each
item back on a spaced schedule until she stops repeating it.

- **Revise**: items due today from both logs. Read the prompt, tap "Show answer", then mark "Got it" or "Again".
- **English**: Valmiki's log of what she said, the better version, and why.
- **Strategy**: Kanha's log of what she did, what went wrong, the better move, and the principle behind it.
- **Habits**: filler-word trend, English mistakes grouped by category, strategy mistakes grouped by pattern. Each item is marked *still repeating* or *improving*.
- **Bank**: Kanha's practice scenarios. The debrief stays hidden until she has answered. "Log my attempt" shows a ready-made append command.

Live: https://g-savitha.github.io/speaking-notebook/

There is no database. The data is JSON in `data/` on `main`. The page fetches those files from raw.githubusercontent.com
each time it loads, so a data push shows up within about 5 minutes without a rebuild. If that fetch fails, the page uses
the copy bundled at the last deploy.

## Spaced revisit

Each log entry has `revisit: {due, step}`. The steps are 0–3, with intervals of **1, 3, 7 and 21 days**.

- New entry, or a bump: step 0, due the day after.
- `got`: next step, due today + that step's interval. `got` at step 3 sets `status: "mastered"`, and the item is no longer due.
- `again`: step 0 (due tomorrow), `seen` + 1, `lastSeen` = today, `status: "practicing"`.
- *Still repeating* means `seen > 1` and seen within the last 14 days. *Improving* means not seen for 14+ days.

Taps in the browser are saved in that browser's localStorage only, on top of the repo data. The coaches record real
reviews with `scripts/review.mjs`. When the repo entry changes, the browser drops its local copy.

## Entry formats

You write the fields below. `scripts/append.mjs` fills in `id`, `status` ("new"), `seen` (1), `lastSeen` (= date) and
`revisit` (`{due: date+1, step: 0}`). The schemas (`data/*.schema.json`) list every field. Unknown fields fail validation.

**English mistake** (`data/english.json`, from Valmiki):
```json
{"date":"2026-10-21","type":"rephrasing","original":"I want to tell one thing.","better":"There's one thing I'd like to add.","category":"grammar","why":"'tell' needs an object; use 'add' or 'say'.","drill":"There's one thing I'd like to add about the rollout.","context":"meeting","notes":"optional"}
```
- `type`: phrase | rephrasing | diplomatic expression | feedback
- `category`: filler | pausing | grammar | word-choice | tone | structure | pronunciation | pacing
- `context` (optional): meeting | interview | demo | presentation | casual
- Optional fields: `drill`, `context`, `notes`.

**English filler metric** (`data/english.json`):
```json
{"date":"2026-10-21","type":"metric","fillers":{"um":4,"like":2,"so":1},"durationSec":600,"wpm":140,"notes":"optional"}
```

**Strategy entry** (`data/strategy.json`, from Kanha):
```json
{"date":"2026-10-21","mode":"debrief","situation":"peer presented my work to the director","whatIDid":"Stayed silent, vented to a colleague later","whatWentWrong":"Credit drifted, and the venting reached the peer","betterMove":"Add detail in the room: \"To add to that, the main gain came from moving pricing off the main thread.\"","principle":"Guard your reputation calmly and early.","source":"48 Laws of Power, Law 5","pattern":"giving away credit"}
```
- `mode`: debrief (something that happened) or scenario (a bank scenario). A `scenario` entry needs `"scenarioId":"S01"` (an existing bank id). A `debrief` entry must not have one.
- `situation`: roles only, no names.
- `betterMove`: includes the exact sentence to say next time.
- `principle`: one plain sentence.
- `source`: optional.
- `pattern`: one of `data/patterns.json` (overexplaining, reacting emotionally, giving away credit, avoiding conflict, oversharing, saying yes too fast). To add a pattern, append it to that file.

**Bank scenario** (`data/scenarios.json`, Kanha's format, every field required):
```json
{"id":"S26","title":"Short title","category":"Credit and visibility","difficulty":"medium","scenario":"What happened.","question":"What would you do?","principles":[{"source":"The 48 Laws of Power","citation":"Law 4: Always Say Less Than Necessary","idea":"Why it applies."}],"sampleResponse":"A strong answer.","commonMistake":"The usual wrong move."}
```

Ids: `en-YYYY-MM-DD-n` (English), `st-YYYY-MM-DD-n` (strategy), `S01`… (bank).

## Commands (Node 22+, no install needed for these)

```sh
git pull -q
node scripts/append.mjs english '<entry JSON>'          # add (an English "original" seen before bumps that entry instead)
node scripts/append.mjs strategy '<entry JSON>'
node scripts/append.mjs english --bump en-2026-10-21-1  # same mistake again: seen+1, back to step 0
node scripts/due.mjs                                    # due items (both logs) as JSON; or: due.mjs english --date 2026-10-22
node scripts/review.mjs en-2026-10-21-1 got             # or: again
node scripts/validate.mjs                               # check all data files
git commit -qam "notebook: 2026-10-21 session" && git push -q
```

Each write validates every data file. If anything is invalid, the file is restored and the command exits 1.

## Develop and deploy

```sh
npm install
npm run dev       # http://localhost:4321/speaking-notebook/  (add ?today=YYYY-MM-DD to preview another day)
npm run deploy    # validate, astro build, publish dist/ to the gh-pages branch (Pages serves gh-pages, root)
```

Only code changes need a deploy. Code layout:
- `src/lib/revisit.mjs`: spacing rules, shared by the page and the scripts.
- `src/lib/table.mjs`: one generic table, search and filter renderer driven by a column config.
- `src/lib/app.mjs`: data loading, the localStorage overlay, and the tab configs.
- `src/lib/revise.mjs` and `src/lib/habits.mjs`: the Revise and Habits views.

Data is always rendered with `textContent`, never as HTML.
