# Research: Prototype Analysis & Migration Decisions

**Feature**: ProtSpam MPI HPC Suite & Simulator
**Date**: 2026-08-22
**Sources**: the Vite prototype at commit `838c38d` (6 815 lines across 22 files)

---

## Part A — What the prototype actually is

### A.1 Inventory

| File                                          | Lines | Role                                                  |
| --------------------------------------------- | ----: | ----------------------------------------------------- |
| `src/components/WorkloadSimulator.tsx`        | 1 381 | Load-balancing module (largest)                       |
| `src/components/ProtSpamStepSimulator.tsx`    |   974 | Step-by-step algorithm narrator                       |
| `src/App.tsx`                                 |   564 | Shell: header, nav, banner, docs modal, module router |
| `src/components/TFMBranchExplorer.tsx`        |   461 | Git branch dossier                                    |
| `src/components/TriangularMatrixExplorer.tsx` |   457 | Matrix/partition explorer                             |
| `src/components/ScalabilityCharts.tsx`        |   421 | Measured speedup curves                               |
| `src/context/LanguageThemeContext.tsx`        |   397 | i18n dictionary + theme state                         |
| `src/utils/generatePdf.ts`                    |   265 | jsPDF factsheet generator                             |
| `src/components/NumericCorrectness.tsx`       |   211 | IEEE-754 comparison table                             |
| `src/data/speciesData.ts`                     |   202 | All static datasets and the partitioner               |
| `src/index.css`                               |   142 | Tailwind entry, theme overrides, Bento card styles    |

### A.2 Architectural findings

**F1 — Single-file shell, no router.** `App.tsx` holds a `SectionId` union in `useState`
and renders one of seven components with a chain of `&&` expressions. There is no routing
library and no URL state: the active module is not shareable or bookmarkable, and the
browser back button does not move between modules.

**F2 — Two cross-cutting concerns, one context.** `LanguageThemeContext` bundles language
and theme. Both are read by every module. Language changes are consumed in two different
ways: through `t(key)` for shell chrome, and through inline `lang === 'es' ? … : …`
ternaries for long-form prose embedded in components — roughly 40 % of the user-visible
Spanish/English text never passes through the dictionary.

**F3 — Charts are imperative, not declarative.** Despite the previous README claiming
`react-chartjs-2`, no such dependency exists. Both chart modules import Chart.js directly,
register only the controllers they need, hold the instance in a `useRef`, and reconcile
inside `useEffect`. The two modules differ in strategy: `WorkloadSimulator` mutates the
existing instance and calls `.update()` (preserving animation), while `ScalabilityCharts`
destroys and recreates the chart on every dependency change.

**F4 — Nine unused dependencies.** Only five packages are imported anywhere in `src/`:
`react`, `react-dom/client`, `chart.js`, `jspdf`, `lucide-react`. Declared but never
imported: `@google/genai`, `express`, `dotenv`, `motion`, `esbuild`, `tsx`,
`autoprefixer`, `@types/express`, `@types/node`. They are residue from the Google AI
Studio scaffold that also left `metadata.json` and an `.env.example` describing a
`GEMINI_API_KEY` the application never reads.

**F5 — Deep-copy-per-step state model.** `ProtSpamStepSimulator` materialises the entire
simulation ahead of time as an array of fully-populated snapshots, each one built with
`JSON.parse(JSON.stringify(...))`. For the default inputs this is a few hundred snapshots
and is imperceptible; it is `O(steps × state size)` in both time and memory, so long
sequences degrade quadratically. Rendering is then a pure lookup, `steps[currentStep]`,
which is what makes stepping backwards trivially correct.

**F6 — Light theme is an override sheet.** `index.css` implements light mode by listing
specific Tailwind class names under `html.light-theme` with `!important`. Any utility not
on that list keeps its dark value, so light mode is complete only for the classes the
author enumerated.

**F7 — The prototype paints nothing until the bundle runs.** `index.html` contains an
empty `<div id="root">`; the Vite build emits a 958.87 kB main chunk (300.43 kB gzipped)
plus jsPDF's `html2canvas` (202 kB) and `purify` (29 kB) chunks. All seven modules,
Chart.js and jsPDF load whether or not the visitor ever opens them.

### A.3 Fidelity findings (simulation vs. real Prot-SpaM)

These are deliberate didactic simplifications. They are listed so nobody mistakes the
simulator for the C++ tool.

| Prototype                                                                     | Real Prot-SpaM                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `BLOSUM62` is a 4×4 table over `A/C/T/G` with a `a === b ? 4 : -1` fallback   | 20×20 amino-acid substitution matrix                                                 |
| Extension runs to the sequence boundary in both directions                    | X-drop termination bounds the extension                                              |
| Per-pattern distance is `1 / (approvedMatches + 1)`, averaged across patterns | Kimura correction over the match ratio; the formula is displayed but never evaluated |
| Matrix inspector distance is `0.125 + (i + j) × 0.015`                        | Computed from actual spaced-word matches                                             |
| Comparison cost proxy is `maa(i) × maa(j)`                                    | Actual pattern-scaled word counts                                                    |
| MPI timeline is a fixed 12-step script for 1 sender and 4 receivers           | Real point-to-point traffic across up to 256 ranks                                   |
| Scalability numbers are a stored measurement table                            | Live benchmark output from FinisTerrae III                                           |

The scalability tables are the one place where the numbers are _real_: they are the
thesis' measured results and must never be recomputed client-side (Constitution I).

---

## Part B — Migration decisions

### D1 — Astro 5, static output, React islands

**Decision**: `output: 'static'` with `@astrojs/react`; no adapter, no SSR at runtime.
**Rationale**: the suite has no server-side data and Constitution III forbids a backend.
Static output makes that structural. React is kept because rewriting seven stateful
modules would risk the behaviour the spec is meant to protect.
**Alternatives rejected**: SSR with an adapter (no dynamic data to justify it); a
framework-free rewrite (would discard 4 000 lines of working, specified behaviour);
Next.js (heavier, server-oriented, and its routing model buys nothing for one route).

### D2 — Tailwind 4 through the Vite plugin, not `@astrojs/tailwind`

**Decision**: keep `@tailwindcss/vite` and register it under `vite.plugins` in
`astro.config.mjs`.
**Rationale**: Astro passes `vite` config straight through, so the existing
`@import "tailwindcss"` entry file and every utility class keep working unchanged. The
`@astrojs/tailwind` integration targets Tailwind 3's PostCSS pipeline and is the wrong
tool for a Tailwind 4 project.

### D3 — One island, not seven

**Decision**: a single `AppShell` island hydrated at the page root.
**Rationale**: the active module, the language and the theme are shared mutable client
state. Splitting the modules into sibling islands would require an external store to
share it, which is a rewrite, not a migration — and it would win nothing at runtime,
because only one module is ever mounted.
**Consequence**: the _hydration_ boundary is coarse, so the payload win must come from
code splitting instead (D5).

### D4 — Prerender-safe context, plus an inline boot script

**Problem**: `LanguageThemeContext` seeds `useState` directly from `localStorage`. During
Astro's prerender pass that code runs in Node, where `localStorage` does not exist — and
even with a guard, the server would render defaults while the client renders stored
values, producing a hydration mismatch.
**Decision**: initialise from the documented defaults (`es`, `dark`), reconcile with
storage inside `useEffect`, and add an inline `<head>` script that applies the stored
theme class and `lang` attribute before first paint.
**Rationale**: server and first client render agree exactly; the visible flash that the
reconciliation would otherwise cause is eliminated _before_ React runs. The boot script
and the React effect enforce the same contract, so they cannot drift apart in behaviour.

### D5 — `React.lazy` per module

**Decision**: the six non-landing modules are imported through `React.lazy` behind a
shared `Suspense` fallback; the landing module stays eager.
**Rationale**: this is where the payload win actually lives. Chart.js ships only with the
two modules that use it, jsPDF only with the branch/export path, and a visitor who reads
the base algorithm and leaves never downloads the other six.
**Trade-off**: opening a module for the first time now costs a chunk fetch. Mitigated by a
skeleton fallback that matches the module frame, and by the chunks being small.

### D6 — Behaviour is frozen during the migration

**Decision**: no component API, translation key, dataset value or formula changes.
**Rationale**: the six defects found during analysis (`tasks.md` D001–D006) are real, but
fixing them inside an infrastructure migration would make the diff impossible to review
and would blur the line between "the port broke it" and "it was already broken".

---

## Open questions

None blocking. Two are worth answering before the next feature:

1. Should the active module become a URL route (`/workload`, `/scalability`, …)? Astro
   makes this cheap, it would make modules linkable in the thesis defence, and it would
   turn D5's code splitting into route-level splitting. It changes the navigation contract
   in `spec.md` (FR-001/FR-002), so it needs its own spec.
2. Should the ~40 % of prose currently living in inline `lang === 'es'` ternaries move
   into the dictionary? It would make missing-translation auditing mechanical, at the cost
   of a large, behaviour-neutral diff across every module.
