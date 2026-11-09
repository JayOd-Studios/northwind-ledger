# Northwind Ledger — sample reconciliation workspace

A self-contained sample site: a dark reconciliation workspace with a light
"ledger paper" theme, a queue that drives the whole page, a sortable/searchable
ledger, CSV export, undo, and a chart you can inspect with a pointer or keyboard.
It is a **portfolio template**, not a working product — there is no backend, and
every figure is fictional.

Fictional company. Do not present it as client work.

- Sector: Fintech dashboard / internal tool
- Runtime: static HTML, CSS and vanilla JavaScript. No runtime dependencies, build step, webfonts, CDN or tracking.
- Dev-only QA: Playwright and axe-core. Neither is loaded by the deployed sample.
- Run: `python3 -m http.server 3000` in this folder.
- Files: `index.html`, `styles.css`, `ledger.js`, `main.js`, `theme-boot.js`, `check.mjs`, `package.json`, `package-lock.json`, `playwright.config.js`, `tests/`, `README.md`.

## The idea

The first version was a dashboard with four KPI cards and a chart. This version is
built around the job the product actually does: **close the books**. The hero is a
reconciliation queue, not a scoreboard. It states how many payments need a second
pair of eyes, shows the next one, and keeps the queue clear card ready for the
moment the last exception is resolved. The balance, unmatched count, cleared
count and progress bar all derive from the same records as the table.

The creative direction is unchanged: numbers first, mint on ink, mono for money
and references, serif for the one human sentence per screen. A second theme
turns the ink into warm ledger paper without rebranding the product.

## What it demonstrates

- **One source of truth.** `ledger.js` holds nine payments, the summary figures and
  three chart ranges. The hero counts, review queue, next-exception card, table,
  chips, progress bar and activity log are rendered from it.
- **Reconciliation that responds.** Mark a row matched (or click its status), use
  the dialog on a queue item, or bulk-match a selection. Counts, progress, the
  next card and the empty queue state update together. Every change can be undone
  from the toast.
- **A real ledger table.** Search across accounts, references, dates and amounts;
  filter by status; sort every column with `aria-sort`; select visible rows;
  export all visible rows or just the selection as CSV.
- **A chart with a scale.** 9W / 6M / 1Y ranges, five y-axis labels, an authored
  area/line path, hover and tap inspection, Arrow/Home/End keyboard inspection,
  and a "View the numbers" table as the non-visual alternative.
- **A theme that does not flash.** `theme-boot.js` applies the stored theme before
  the stylesheet paints. Dark is the default; light is a warm paper deck; the
  choice is remembered in this browser.
- **A sample that behaves like a sample.** Native `<dialog>` for the matching
  decision, a polite toast with undo, a live activity trail, local-only
  persistence and a reset control. No network calls, no fake server.
- **An honest accessibility pass.** 40px primary/icon/search controls; 28–30px
  compact controls; visible focus; a skip link; labelled progress, dialog and
  chart; a mobile drawer that is inert when closed; reduced-motion handling;
  print styles that remove the interactive chrome.

## Brand kit

| Item | Value |
| --- | --- |
| Name | Northwind Ledger |
| One-liner | Reconciliation that closes the books on Friday, not Monday. |
| Audience | Bookkeeping teams of 2–15 people handling 200–2,000 payments a month. |
| Tone | Plain, precise, slightly dry. Numbers are the voice. |
| Accent | Mint `#6EE7B7` on ink `#0C121C`; light deck uses deep verdigris on paper |
| Type | System sans for UI, serif for display, monospace for money and references |
| Radius | 12px panels, 9px controls, 999px pills |

## Screen inventory

1. **Sidebar + top bar** — workspace navigation, search, theme switch, sample avatar.
2. **Reconciliation hero** — the sentence that says what needs doing, a live
   progress meter, and the next exception with its invoice/payment/difference.
3. **Ruled summary** — balance, unmatched, cleared, runway. No card grid.
4. **Net movement** — period tabs, an SVG chart with a visible y-scale and an
   inspectable readout, plus a numbers table.
5. **Needs review** — the queue, with the actual reason and a direct review action.
6. **Ledger** — status filters, sortable columns, row selection, bulk match,
   CSV export, empty and filtered states.
7. **Activity** — the last few decisions, stored in this browser only.
8. **Dialog + toast** — a matching decision with the evidence, and an undo path.

## Sample data

- Balance **$284,102**, **+12.4%** month on month.
- **1,207** payments in the close, **1,204** cleared, **3** unmatched, **38** days runway.
- Nine recent payments: six matched, three exceptions.
- Exceptions: Ridgeway Studio (amount differs by **$12.00**), Bell & Sons (no
  matching reference), Pennant Group (duplicate of INV-2024 suspected).
- Chart totals: 9 weeks **$284,102** (+$31,342), 6 months **$1,420,880**
  (+$214,900), 12 months **$2,864,000** (+$512,400).
- Snapshot ends **Tuesday, 3 November 2026, 09:41**. The page date is deliberately
  fixed; this is a sample, not a live ledger.

## Make it yours

Edit `ledger.js` first. Amounts are integer cents, dates are ISO calendar dates,
and each payment has `expected` (the invoice total, or `null` when it is missing), a
`status` of `matched` or `review`, a short `reason` and a `note` used in the dialog.
The three `ranges` hold 0–1 values, labels, net figures and five y-tick labels; keep
the array lengths aligned.

Then update the invented brand, copy, title/description/canonical URL and favicon.
If you replace the data with a real feed, render it on the server and keep the same
status vocabulary. The CSV export and localStorage are conveniences for a sample,
not an audit trail.

## Checks

Runtime checks (zero dependencies):

```sh
node check.mjs
node --check ledger.js
node --check theme-boot.js
node --check main.js
```

`check.mjs` verifies the IDs shared by `index.html` and `main.js`, local asset
paths, the CSP and absence of inline script/style, the ledger shape and totals,
colour contrast in both token decks (4.5:1 text, 3:1 control borders), target
sizes, external requests, the README's claims and the dev-only QA boundary. It
is a guardrail, not a substitute for a validator or a browser pass.

Browser QA (dev-only):

```sh
npm install
npx playwright install chromium
npm test
npm run test:a11y
```

`npm test` starts a Python static server on port 4173 and runs the desktop and
mobile projects. The interaction suite covers the queue, undo, persistence,
search, filtering, bulk matching, the native dialog, chart tabs and keyboard
inspection, CSV download, theme persistence, the inert mobile drawer and the
absence of console errors or external requests. The axe suite scans both themes
and the open matching dialog against WCAG A/AA. In a Linux CI container, use
`npx playwright install --with-deps chromium` once instead of the plain install.

This package is intentionally dev-only. The deployed page does not load
Playwright, axe or any other third-party code.

## Limits

- No authentication, routing, server or database. Statuses and the activity trail
  live in this browser's `localStorage`; **Reset sample data** clears them.
- The CSV is generated in the browser with a Blob download, so it behaves differently
  in browsers that block downloads.
- The chart is illustrative, not a financial report; the y-tick labels and totals
  are authored sample values.
- This folder is published as its own GitHub Pages site. On `*.github.io`, the
  "All samples" link is removed because the gallery is not part of this repo; the
  local copy keeps it.
- The accessibility work here is a considered pass, not a certification. Test with
  real assistive technology before presenting it as production-ready.
