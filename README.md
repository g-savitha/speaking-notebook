# Speaking notebook

Rakendu's revision log for the ~30-minute evening sessions:

- **English**: speaking practice with Valmiki (phrases, rephrasings, diplomatic expressions, feedback).
- **Strategy log**: scenario sessions with Kanha (her answer, feedback, source).
- **Scenario bank**: Kanha's practice scenarios. The debrief (principles, sample response, common mistake) stays collapsed under "Reveal after answering".

Live: https://g-savitha.github.io/speaking-notebook/

Astro, one page, vanilla JS in the browser, dark theme. The page reads `data/*.json` from `main` on
raw.githubusercontent.com when it loads, so **a push to `main` that only changes data shows up without a rebuild**
(raw.githubusercontent.com caches files for about 5 minutes). If that fetch fails, the page uses the copy bundled at the last deploy.

## Data files

Each file is a JSON array. Add new entries **at the end**. The page sorts the logs by date, newest first.
Every file has a schema next to it (`data/<name>.schema.json`). Unknown fields fail validation.

| File | Required | Optional |
| --- | --- | --- |
| `data/english.json` | `date`, `type`, `original`, `better` | `id`, `notes` |
| `data/strategy.json` | `date`, `scenario` | `id`, `scenarioId`, `answer`, `feedback`, `source` |
| `data/scenarios.json` | all fields | none |

- `date` is `YYYY-MM-DD` and must be a real date.
- `type` (English) is one of `phrase`, `rephrasing`, `diplomatic expression`, `feedback`.
- `id` in the two logs is optional and looks like `2026-10-21-1` (date, then a counter for that day). `scripts/append.mjs` fills it in for you, so leave it out.
- `scenarioId` (strategy log) is the bank id she practised, e.g. `S01`. It must exist in `data/scenarios.json`.
- Bank `id` is required: `S` plus two or more digits, unique. `difficulty` is `easy`, `medium` or `hard`. `category` is free text, and the filter lists whatever categories exist.

### English entry

```json
{
  "date": "2026-10-21",
  "type": "diplomatic expression",
  "original": "That won't work.",
  "better": "I'm not sure that will get us there. Could we look at another option?",
  "notes": "Softens a flat no and opens the discussion."
}
```

### Strategy log entry

```json
{
  "date": "2026-10-21",
  "scenario": "The Demo Where Your Work Became His",
  "scenarioId": "S01",
  "answer": "Add detail in the room, then send a write-up with metrics to my manager within 24 hours.",
  "feedback": "Good: claims ownership without accusing anyone. Next time, ask the manager for sponsorship explicitly.",
  "source": "48 Laws of Power, Law 5"
}
```

### Scenario bank entry

```json
{
  "id": "S26",
  "title": "Short title",
  "category": "Credit and visibility",
  "difficulty": "medium",
  "scenario": "What happened, in a few sentences.",
  "question": "What would you do?",
  "principles": [
    { "source": "The 48 Laws of Power", "citation": "Law 4: Always Say Less Than Necessary", "idea": "One line on why it applies." }
  ],
  "sampleResponse": "A strong answer.",
  "commonMistake": "The usual wrong move."
}
```

## Append, validate, push

`scripts/append.mjs` appends one entry (or an array of entries), adds an `id` to log entries that don't have one, and
runs the validator. If validation fails, the file is left unchanged and the command exits 1.

```sh
git pull -q && node scripts/append.mjs english '{"date":"2026-10-21","type":"phrase","original":"I will revert back.","better":"I will get back to you."}' && git commit -qam "english: 2026-10-21" && git push -q
```

Use `strategy` or `scenarios` instead of `english` for the other files. If you edit a file by hand, run
`node scripts/validate.mjs` before you push. It needs Node only, with no install.

## Develop and deploy

```sh
npm install
npm run dev          # http://localhost:4321/speaking-notebook/
npm run deploy       # validate, astro build, publish dist/ to the gh-pages branch
```

GitHub Pages serves the `gh-pages` branch (root). Only code changes need `npm run deploy`. Data changes only need a push to `main`.

Code: `src/pages/index.astro` (markup), `src/lib/table.mjs` (one generic table, search and filter renderer driven
by a column config), `src/lib/app.mjs` (the three tab configs and data loading), `src/styles/global.css`.
All data is written with `textContent`, never as HTML.

@fueledbycuriosity_
