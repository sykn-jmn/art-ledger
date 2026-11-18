# ArtLedger

Lightweight tax and bookkeeping web app for a freelance digital artist in the Philippines.

ArtLedger runs entirely in the browser. Financial data is stored locally with **Dexie.js (IndexedDB)** — no server database, auth provider, or paid APIs required. Suitable for Vercel Hobby static hosting.

## Technology stack

- Next.js (App Router) + TypeScript
- React + Tailwind CSS
- Dexie.js + dexie-react-hooks
- Zod + React Hook Form
- Lucide React
- ExcelJS
- Decimal.js for money math
- Vitest + fake-indexeddb

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test
```

## Production build

```bash
npm run build
```

Static output is written to `out/` (`output: "export"` in `next.config.ts`).

## Vercel deployment

1. Push this repository to GitHub (or import the folder in Vercel).
2. Create a new Vercel project with framework preset **Next.js**.
3. No environment variables are required for core functionality.
4. Deploy. The site is a static export and works on the free Hobby plan.

## Local-only storage

- All transactions, fees, conversions, tax payments, opening balances, and settings are stored in **this browser’s IndexedDB**.
- Data does **not** sync across devices, browsers, or domains.
- Clearing site data or using a different browser removes access to the local ledger.

## Backup and restore

1. Open **Settings**.
2. **Export JSON backup** to download a full snapshot (includes schema version).
3. **Import backup** to replace local data after confirmation.

Export backups before clearing browser storage or switching devices.

## Workflow

**Open ArtLedger → Select Year/Quarter → Enter Transactions → Review → Books of Accounts → Tax Summary → Export.**

Primary screens:

1. Add Income  
2. Add Expense  
3. Add Currency Conversion  
4. Spreadsheet Quick-Entry  
5. Transaction History  
6. Books of Accounts (CRJ / CDJ / GL)  
7. Tax Summary  

## Tax estimate assumptions (MVP)

Qualified purely self-employed individual using the Philippine **8%** income tax option:

- `Taxable Income = MAX(0, Annual Gross Income − ₱250,000)`
- `Estimated Tax = Taxable Income × 8%`

Gross income uses stored PHP tax valuations. Platform fees, operating expenses, and revenue sharing are **not** deducted from this 8% base. Currency conversions are not income.

These are estimates for personal bookkeeping — not filing advice or official BIR returns.

## Known limitations

- Currency conversion and some foreign-currency expenses are flagged for account-mapping review rather than inventing GL postings.
- Foreign income without a manual PHP tax valuation is auto-filled via Frankfurter (ECB) and marked “needs review” until you Finalize it on the transaction details; tax/journal totals stay incomplete until then.
- Revenue-share “calculated” amounts never auto-create payments.
- Single-browser storage only; backups are manual.
- Fee rules are configurable estimates, not live provider rates.

## Project layout

```text
src/
  app/                 # Routes (dashboard, transactions, books, tax, settings…)
  components/          # Layout, forms, transactions UI
  db/                  # Dexie schema + CRUD
  lib/calculations/    # Fees, balances, taxes, journals
  lib/exports/         # Excel export
  lib/validation/      # Zod schemas
  tests/               # Vitest suites
reference-design/      # HTML visual references
```
