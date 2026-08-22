# Quickstart: Run, Verify, Deploy

## Requirements

- Node.js 20 or newer (developed on 22.x)
- npm 10 or newer

## Commands

```bash
npm install       # install dependencies
npm run dev       # Astro dev server on http://localhost:3000 (host 0.0.0.0)
npm run build     # static site into dist/
npm run preview   # serve the built site locally
npm run lint      # astro check — TypeScript and Astro diagnostics
```

## Manual verification

The project has no automated test suite. These scenarios map one-to-one to the acceptance
criteria in `spec.md` and are the release gate.

### V1 — Shell and navigation (FR-001 … FR-006)
1. Load the site. The **base algorithm** module is active.
2. Visit all seven modules; exactly one renders at a time.
3. Narrow the window to ~1280 px: the last three modules move into a **More** dropdown.
   Click outside it — it closes.
4. Narrow to ~500 px: navigation becomes a hamburger drawer listing all seven modules.
5. Open the documentation modal; it lists all six Git branches with working links.

### V2 — Language and theme (FR-007 … FR-010, SC-003, SC-004)
1. Switch ES → EN and walk every module looking for untranslated strings.
2. Toggle the theme; both themes stay legible.
3. Reload the page: language and theme are preserved, **with no flash of the wrong theme**.
4. Open in a private window with site data blocked: the page still loads with defaults.

### V3 — Base algorithm (FR-011 … FR-017, SC-008)
1. Press play; the simulation advances and stops at the last step.
2. Step backwards through several frames; highlighting and scores stay consistent.
3. Edit S1 to `AAAA` and press *Recompute*; the run regenerates from step 0.
4. Enter a pattern longer than the sequences; the app still reaches the final matrix step.
5. Re-enter the original inputs; the step count matches the first run exactly.

### V4 — Workload (FR-019 … FR-024, SC-005, SC-006)
1. Heterogeneous dataset, P = 32, cyclic: one rank is clearly taller, the imbalance KPI is
   above 2×, and the log warns about *Homo sapiens*.
2. Switch to block partitioning: rank 0 dominates the comparison metric.
3. Switch to the 64-species dataset: bars flatten — imbalance is geometric only.
4. Change any control: chart, all four KPIs and the log update within a second.
5. Copy the log; the clipboard holds the filtered lines as plain text.

### V5 — MPI communication (FR-025 … FR-028)
1. `metacache`: exactly one receiver is active per step.
2. `isend`: all four receivers compute concurrently and the PendingSend queue fills.
3. Advance to the synchronisation step: every request reads *completed*.
4. Reset returns to step 0 with playback stopped.

### V6 — Matrix, scalability, correctness (FR-029 … FR-036)
1. Click a diagonal cell, a lower cell and an upper cell: each is classified correctly.
2. For N = 12 and P = 4 under both strategies, per-rank cell counts sum to 66.
3. Phase 4 tab: hover P = 128 — the tooltip explains the metacache collapse.
4. Correctness tab: filter by "Homo"; select a row; both hex encodings are identical.

### V7 — Export (FR-038)
1. Download the PDF from the header and from the modal; both produce
   `TFM_Ana_Izaguirre_ProtSpam_HPC.pdf` with no network access.

### V8 — Build integrity (SC-002, SC-010)
```bash
npm run lint      # no errors
npm run build     # succeeds
```
Then confirm in `dist/`:
- `index.html` contains real prerendered module markup, not an empty root element.
- `404.html` and `robots.txt` exist.
- Module chunks are emitted separately, and the initial payload is well below the
  959 kB / 300 kB gzipped Vite baseline recorded in `plan.md`.

## Deployment

The build output is fully static — any static host works with no configuration:

```bash
npm run build && npx serve dist      # or Netlify, Vercel, GitHub Pages, S3, nginx
```

There is no server, no environment variable and no runtime API. The only external request
the page makes is the Google Fonts stylesheet; without network access it falls back to
system fonts and remains fully functional.
