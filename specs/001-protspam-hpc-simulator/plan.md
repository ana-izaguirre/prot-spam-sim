# Implementation Plan: Vite → Astro Migration

**Branch**: `claude/vite-to-astro-migration-nwv90a` | **Date**: 2026-08-22
**Spec**: [`spec.md`](./spec.md) | **Tasks**: [`tasks.md`](./tasks.md)
**Constitution**: [`../../.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

## Summary

The ProtSpam HPC Suite is a client-only educational SPA: seven interactive modules, two
languages, two themes, no backend. Today it is a plain Vite + React 19 application whose
entire surface — including seven modules the visitor may never open — ships as a single
959 kB JavaScript bundle (300 kB gzipped) that must execute before anything is painted.

This plan migrates the project to **Astro 5 with React islands**, preserving 100 % of the
behaviour specified in `spec.md`. The user-visible feature set does not change. What
changes is the delivery model:

| | Before (Vite SPA) | After (Astro islands) |
|---|---|---|
| First paint | after the JS bundle executes | server-prerendered HTML |
| Shell markup | `index.html` + `createRoot` | `BaseLayout.astro` + `index.astro` |
| Module code | one bundle, all seven modules | one chunk per module, loaded on demand |
| Theme/lang boot | after React hydration (flash) | inline head script, before paint |
| Head / SEO | hand-written `index.html` | typed, composable Astro layout |

The React component tree (`src/components/*.tsx`, `src/context`, `src/data`, `src/utils`)
is carried over essentially unchanged — that is the point of choosing islands over a
rewrite. The migration is infrastructural, and every task below leaves the repository in
a buildable, lintable state.

## Technical Context

- **Language/Version**: TypeScript 5.8, ES2022 target, `react-jsx` transform
- **Framework**: Astro 5 (`output: 'static'`, no adapter) + `@astrojs/react` for islands
- **UI runtime**: React 19 (unchanged), `lucide-react` icons (unchanged)
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite` (Astro exposes the Vite plugin
  pipeline, so the existing `src/index.css` and `@import "tailwindcss"` keep working)
- **Charts**: Chart.js 4 imperative API with per-controller registration (unchanged)
- **PDF**: jsPDF 4, generated in-browser (unchanged)
- **Storage**: `localStorage` only (`protspam_lang`, `protspam_theme`)
- **Testing**: no automated suite exists; verification is `astro check` + `astro build`
  plus the manual scenarios in `quickstart.md`
- **Target platform**: modern evergreen browsers; deployable to any static host
- **Project type**: static single-page site with client-side module switching
- **Performance goals**: prerendered first paint; initial JS materially below the current
  959 kB by loading only the active module's chunk
- **Constraints**: no backend, no runtime API calls, no behaviour change

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| I. Didactic fidelity over computational fidelity | ✅ Unaffected | No simulation logic is touched by the migration |
| II. Full bilingual parity | ✅ Preserved | The dictionary and `t()` move verbatim; the layout adds a pre-hydration `lang` attribute fix |
| III. Client-only, zero-backend | ✅ Strengthened | `output: 'static'` makes the zero-backend rule structural rather than conventional |
| IV. Academic traceability | ✅ Unaffected | All thesis data stays in `src/data` and the branch dossier |
| V. Deterministic, inspectable state | ⚠️ Requires care | Prerendering runs component code in Node; `localStorage` reads must be guarded so the server pass and the first client render agree (task T003) |

**Deviations**: none. No complexity exception is requested.

## Project Structure

### Documentation

```
.specify/memory/constitution.md         # project principles
specs/001-protspam-hpc-simulator/
├── spec.md                             # what the suite does and why
├── plan.md                             # this file — the migration plan
├── tasks.md                            # ordered, PR-sized work items
├── research.md                         # prototype analysis + migration decisions
├── data-model.md                       # entities and static datasets
├── quickstart.md                       # run, verify, deploy
└── contracts/
    ├── ui-components.md                # per-component interface contracts
    ├── simulation-engine.md            # step-generation and partitioning logic
    └── i18n-theming.md                 # language/theme contract
```

### Source (target state)

```
astro.config.mjs                        # NEW  integrations + Tailwind vite plugin
tsconfig.json                           # CHANGED extends astro/tsconfigs/base
package.json                            # CHANGED astro scripts, pruned dependencies
public/                                 # NEW  favicon, robots.txt, static assets
src/
├── pages/
│   ├── index.astro                     # NEW  the single route; mounts the island
│   └── 404.astro                       # NEW  static not-found page
├── layouts/
│   └── BaseLayout.astro                # NEW  <head>, fonts, theme/lang boot script
├── islands/
│   └── AppShell.tsx                    # NEW  hydration entry (was App.tsx default export)
├── components/                         # UNCHANGED  seven React modules
│   ├── ProtSpamStepSimulator.tsx
│   ├── WorkloadSimulator.tsx
│   ├── MPICommunicationVisualizer.tsx
│   ├── TriangularMatrixExplorer.tsx
│   ├── ScalabilityCharts.tsx
│   ├── NumericCorrectness.tsx
│   └── TFMBranchExplorer.tsx
├── context/LanguageThemeContext.tsx     # CHANGED  SSR-safe storage access
├── data/speciesData.ts                  # UNCHANGED
├── utils/generatePdf.ts                 # UNCHANGED
└── index.css                            # UNCHANGED (imported by the layout)

DELETED: index.html, src/main.tsx, vite.config.ts
```

## Phase 0 — Research

Recorded in [`research.md`](./research.md). The questions that had to be answered before
writing a line of Astro:

1. **Does Tailwind 4 work in Astro without `@astrojs/tailwind`?** Yes — Astro forwards
   `vite.plugins`, so `@tailwindcss/vite` is used exactly as it is today.
2. **Can the app be prerendered at all?** Only after the language/theme context stops
   touching `localStorage` during the first render pass. Until then it must hydrate as
   `client:only`.
3. **How is the theme applied without a flash?** An inline script in `<head>` reads the
   same two storage keys and sets the root class before first paint — the same contract
   the React effect enforces afterwards.
4. **What actually splits?** Module switching is client state, so the shell stays one
   island; the win comes from `React.lazy` per module, which Rollup emits as separate
   chunks. Chart.js only ships with the two modules that import it.
5. **Which dependencies are dead?** `@google/genai`, `express`, `dotenv`, `motion`,
   `esbuild`, `tsx`, `autoprefixer`, `@types/express` are declared and never imported.

## Phase 1 — Design

- **Hydration boundary**: exactly one island (`AppShell`), because the active-module
  selector, the language and the theme are shared client state read by every module.
  Everything above that boundary — document head, fonts, preconnects, theme bootstrap,
  static metadata — becomes server-rendered Astro.
- **Code splitting**: the seven module components move behind `React.lazy` with a shared
  `Suspense` skeleton. Opening a module fetches its chunk; the base-algorithm module is
  eagerly imported because it is the landing view.
- **SSR safety**: `LanguageThemeContext` initialises from defaults (`es`, `dark`), then
  reconciles with `localStorage` inside an effect, so the server pass and the first client
  render produce identical markup. The inline boot script prevents the visible flash that
  this reconciliation would otherwise cause.
- **No behaviour drift**: no component API, prop, translation key, dataset value or
  simulation formula is modified in this migration. Behavioural gaps found during the
  analysis (unused dropoff parameter, incomplete light-theme coverage, unhandled clipboard
  rejection, Spanish-only PDF title) are recorded in `spec.md` as **[GAP]** and deferred —
  fixing them inside a migration would make the diff unreviewable.

## Complexity Tracking

No constitutional violation requires justification. One conscious trade-off is recorded:

| Decision | Why | Alternative rejected |
|---|---|---|
| Single root island rather than one island per module | Active section, language and theme are shared mutable state; splitting them across islands would require a cross-island store (nanostores) and a larger diff | Per-module islands with a shared store — more idiomatic Astro, but a rewrite rather than a migration, and it buys little because only one module is mounted at a time anyway |
