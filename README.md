# Vencera AI — HackAlem MVP

Working, responsive contractor-matching MVP for Kazakhstan. The browser bundles the official anonymized 66-profile CSV for a reliable offline demo. A small optional Node API serves the same matcher.

## Run

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Run `npm test` for the CSV/acceptance checks and `npm run build` for the production check. `Vencera-AI-demo.html` is a standalone, directly openable build for sharing; regenerate it after changes with `npm run build` then `node scripts/create-standalone.mjs`.

With Node.js 24, `npm run build && npm run serve` starts the production static server and `POST /api/match` on `http://127.0.0.1:4173`. The endpoint accepts the PDF's `budget_kzt`, `duration_hours`, `must_keep`, and `preferences` fields, and returns status, up to three cards, structured/source-text evidence, diagnostics, decision trace, and scoring version. The UI calls the same matcher locally so the standalone HTML also works without the server.

## Data and import

`data/contractors.csv` is a byte-for-byte copy of the user-supplied hackathon CSV. The original Downloads file is untouched. `src/data/contractors.json` is the parsed app data. Regenerate both with:

```bash
node scripts/import-csv.mjs "path/to/hackathon dataset anonymized .csv"
```

The importer checks the exact column schema, 66 unique IDs, 13 synthetic profiles, 8 imputed cities, and 18 imputed prices. The app displays these flags per card. Descriptions are labeled as profile statements, not verified portfolio or third-party evidence.

## Matching rules

`src/matcher.ts` applies exact city and category matching, then event format, starting price ≤ budget, required language, applicable duration, and exact busy-date exclusion. `max_hours: null` means not applicable. No result is marked available outside the CSV calendar (23 September–31 December 2026). The user can mark date or budget flexible and language required or desired; alternatives never change fixed conditions.

Eligible profiles are ranked deterministically by a versioned (`csv-v1`) overlap between request words and the profile description, then starting price ascending, then ID ascending. Only the first three are shown. The same query and data always give the same IDs and order. The interface shows structured evidence, a source excerpt, a material unknown, a follow-up question, and a Decision Trace with sequential filter counts. Rejection counts use the first failing condition in the fixed filter order.

Prices are explicitly **starting prices**, not a final quote. Source descriptions are self-reported claims. There are no fabricated ratings, reviews, guarantees, or availability outside the dataset.

## Demo checks

Use the on-screen scenario buttons or query parameters:

- `?demo=popular`: five eligible wedding hosts in Almaty at 8 hours; top three shown.
- `?demo=duration`: same criteria at 10 hours; three eligible. The sensitivity note explains the change.
- `?demo=rare`: ceremony-host category; two actual matches, including synthetic-source marking where relevant.
- `?demo=rescue`: Astana florist busy on 24 September; no booked profile shown; 25 September proposed only because the date is flexible.
- `?demo=missing`: no instrumentalist category in Astana.

Change a fixed condition and submit to verify that it is not relaxed. Select a date outside the calendar to see the unverified-availability state.

## Architecture and limits

- `src/App.tsx`: search, validation, result/empty/unverified states, evidence cards, Decision Trace.
- `src/matcher.ts`: deterministic filtering, ranking, diagnostics, permitted alternatives, shared with the optional API.
- `server.mjs`: production static server and `POST /api/match` adapter.
- `src/demo.ts`: real CSV demo queries, not fake profiles.
- `src/types.ts`: interface contract.
- `src/styles.css`: responsive design.

This hackathon build does not persist user data, and its optional API is not a hardened public deployment. The PDF's portfolio-media phase is intentionally not implemented: the CSV has no rights-cleared project photos or videos, and `description` is not a portfolio. Booking, payments, accounts, notifications, face/emotion/age inference, and ratings are also outside MVP scope. Before a public portfolio launch, confirm consent, image rights, Kazakh data residency, retention/deletion, moderation, and applicable law with qualified counsel.

The [Figma handoff](https://www.figma.com/design/CZg4hdmY8aqptG3db2L2CZ) reflects the earlier UI baseline. The code is the current source of truth for the CSV-powered MVP.
