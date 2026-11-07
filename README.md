# Northwind Ledger — sample fintech dashboard

A self-contained sample site: dark reconciliation workspace with live balances, a
searchable ledger, a period-switching chart and a review queue. It is a
**portfolio template**, not a working product — there is no backend and every
button that would write data is inert.

Fictional company. Do not present it as client work.

- Sector: Fintech dashboard / internal tool
- Stack: static HTML, CSS and vanilla JS. No build step, no webfonts, no CDN.
- Run: `python3 -m http.server 3000` in this folder.
- Files: `index.html`, `styles.css`, `main.js`.

## The brand, as written

| Item | Value |
| --- | --- |
| Name | Northwind Ledger |
| One-liner | Reconciliation that closes the books on Friday, not Monday. |
| Audience | Bookkeeping teams of 2–15 people handling 200–2,000 payments a month. |
| Tone | Plain, precise, slightly dry. Numbers are the voice. |
| Accent | Mint `#6EE7B7` on ink `#0C121C` |
| Type | Inter or system sans; monospace for money and references |
| Radius | 12px cards, 9px controls, 999px pills |

### Screen inventory

1. **Sidebar + top bar** — workspace navigation, global search, avatar.
2. **Page head** — date, greeting, the one sentence that says what needs doing.
3. **KPI row** — balance, unmatched, cleared, runway, each with a sparkline.
4. **Net movement** — 9-week / 6-month / 1-year switch, area chart, total and delta.
5. **Needs review** — three exceptions with the actual reason, not just "error".
6. **Ledger table** — status filter chips, search, per-row status toggle, select all.

### Sample data

- Balance $284,102, +12.4% month on month. Unmatched 3. Cleared 1,204. Runway 38 days.
- 9-week movement $284,102 (+$31,480), 6-month $1,420,880, 12-month $2,864,000.
- Accounts: Northwind Ltd, Hopwood & Co, Ridgeway Studio, Carrow Studio, Bell & Sons, Orchard Lane, Pennant Group.
- Exceptions: Ridgeway (amount differs by $12.00), Bell & Sons (no matching reference), Pennant (duplicate suspected).

## What to show it for

Use it when pitching data-heavy interface work: it demonstrates table density,
numeric alignment, status design that never relies on colour alone, a real chart
with a real scale, and an accessibility pass (skip link, labelled controls,
`aria-pressed` filters, 44px-ish targets, reduced-motion support).

## Make it yours

- Brand: `--mint`, `--bg`, `--panel`, the `.mark` letter and the `<title>`.
- Chart: edit the `ranges` object in `main.js` — values are 0–1 and labels must match the count.
- Rows: copy a `<tr>`, set `data-status="matched"` or `"review"`, and keep the status button's `aria-label` in sync.
- Real data: replace the table markup with rendered data, and move the filter/search to the server when the ledger gets long.

## Limits

No authentication, no routing, no persistence: reloading resets the status
toggles. The chart is drawn, not fetched. That is deliberate for a sample; say so
when you show it.
