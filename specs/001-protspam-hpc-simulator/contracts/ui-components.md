# Contract: UI Components

Every module is a **zero-prop React component**. All shared state arrives through
`useAppLanguageTheme()`; all domain data is imported directly from `src/data/speciesData`.
Consequently every module is independently mountable and independently testable.

```ts
export const <Module>: React.FC   // no props, no children
```

---

## `App` / `AppShell` — the shell

**Export**: default `App` (wraps `AppContent` in `LanguageThemeProvider`).

**State**
| Name | Type | Purpose |
|---|---|---|
| `activeSection` | `SectionId` | Which module renders; defaults to `'core_sim'` |
| `showDocsModal` | `boolean` | Documentation modal visibility |
| `mobileMenuOpen` | `boolean` | Drawer visibility below `lg` |
| `moreNavOpen` | `boolean` | Overflow menu between `lg` and `2xl` |
| `downloadSuccess` | `boolean` | PDF confirmation, auto-clears after 3 500 ms |

```ts
type SectionId = 'core_sim' | 'tfm_branches' | 'workload'
               | 'mpi_comm' | 'matrix' | 'scalability' | 'correctness';
```

**Responsive navigation contract**
- `≥ 2xl`: all seven items inline.
- `lg … xl`: first four inline, remaining three inside a "More" dropdown; the dropdown
  button shows the active style when the active module lives inside it.
- `< lg`: hamburger drawer listing all seven plus the docs and GitHub actions.

**Side effects**: a `mousedown` listener on `document` closes the overflow dropdown on an
outside click; registered once on mount, removed on unmount.

**Invariants**
- Exactly one module is mounted at a time (unmounting resets that module's local state —
  this is intentional and users rely on it as a reset).
- Selecting an item from the drawer or the dropdown closes it.
- `generateTFMPdf` failures are caught and logged; the confirmation is not shown.

---

## `ProtSpamStepSimulator` — base algorithm

**Inputs (local state)**: `patternInput` (comma-separated), `s1Input`, `s2Input`,
`thresholdInput`, `dropoffInput` *(stored, never applied, no control rendered)*.

**Playback state**: `steps: StepData[]`, `currentStep`, `isPlaying`,
`playSpeed ∈ {1500, 1000, 400}` ms, `blosumExplainer`.

**Contract**
- `generateSimulationSteps()` fully rebuilds `steps` and resets `currentStep` to 0.
- It runs on mount and on every language change; parameter edits require the explicit
  *Recompute* action (`spec.md` FR-017).
- Autoplay advances one step per `playSpeed` tick and stops itself at the last step.
- Rendering reads only `steps[currentStep]` — no derived mutation, so backward stepping is
  exact.
- `desc` is injected with `dangerouslySetInnerHTML`. Its content is generated from
  sanitised inputs (`[^1*]` and `[^A-Z]` stripped), so no user-controlled markup reaches
  the DOM. **Any change to input sanitisation must preserve this property.**

---

## `WorkloadSimulator` — load balancing

**Controls**: `numProcesses ∈ {2, 4, 8, 16, 32, 64}`, `datasetType ∈ {'64', '300'}`,
`viewMetric ∈ {'maa', 'species', 'comparisons'}`,
`algoType ∈ {'algoritmo1_cyclic', 'naive_block'}`.

**Derived (recomputed every render, pure)**: `workloads = calculateWorkload(...)`,
`totalMaa`, `avgMaa`, `maxMaa`, `minMaa`, `imbalanceFactor`, `bottleneckRank`,
`totalComparisons`, `avgComparisons`.

**Chart contract**
- Chart.js registration is module-scoped: `BarController`, `BarElement`, `CategoryScale`,
  `LinearScale`, `Tooltip`, `Legend`.
- The instance is created once and **mutated** on subsequent updates (`.update()`), which
  preserves the bar transition; it is never destroyed between parameter changes.
- Tick font size and rotation adapt to `numProcesses` (smaller and rotated above 16/32).
- Bars turn to the warning colour only when the rank owns *Homo sapiens* **and** the
  dataset is `'300'` **and** the metric is `'maa'`.

**Log contract**: one batch per parameter change, emitted after a 150 ms timeout that is
cleared on unmount or on a superseding change; buffer capped at 80 entries; filterable by
level; auto-scroll pins to the bottom when enabled. Copy uses `navigator.clipboard`
(unhandled rejection — `tasks.md` D003).

**Demo mode**: an interval advances `numProcesses` cyclically through the option list at
`demoSpeed` ms; each value has a matching bilingual stage caption.

---

## `MPICommunicationVisualizer` — communication

**State**: `mode ∈ {'metacache', 'isend'}` (default `'isend'`), `animStep ∈ [0, 12]`,
`isPlaying` (default `true`), `speed ∈ {0.5, 1, 2}` (interval = `1200 / speed` ms).

**State machine** — pure functions of `(animStep, mode)` for ranks 1…4:

| Predicate | `metacache` | `isend` |
|---|---|---|
| `isSendActive(r)` | `animStep === r × 2 − 1` | `1 ≤ animStep ≤ 3` |
| `isComputing(r)` | `r × 2 ≤ animStep < r × 2 + 2` | `3 ≤ animStep ≤ 9` |
| `isIdleWaiting(r)` | not sending, not computing, `animStep < 10` | `animStep === 0` |
| `isSynchronized` | `animStep ≥ 10` | `animStep ≥ 10` |

The contrast is the entire point: `metacache` serves exactly one receiver per step, while
`isend` overlaps all four.

**`PendingSend` queue**: four fixed 1.4 MB requests targeting ranks 1–4, entering the
*active* state at `animStep ≥ 1, 2, 2, 3` respectively and flipping to *completed* at
`animStep ≥ 10`.

---

## `TriangularMatrixExplorer` — partition geometry

**Controls**: `matrixSize N ∈ [6, 20] step 2` (default 12), `numProcesses P ∈ {2, 4, 8}`
(default 4), `partitionMethod ∈ {'cyclic', 'block'}`, `selectedCell` (default `{0, 1}`),
`hoveredRank`.

**Ownership**
```ts
cyclic: owner(i) = i % P
block : owner(i) = min(floor(i / ceil(N / P)), P − 1)
```

**Derived**: `totalUpperCells = N(N−1)/2`; per rank, owned cell count and a cost proxy
`Σ maa(i) × maa(j)` over owned pairs.

**Cell classification**: `j === i` diagonal (distance 0, not computed) · `j < i` lower
half (skipped by symmetry) · `j > i` upper half (computed, coloured by owner).

**Inspector**: both species with taxon and protein count, owner rank, cost proxy
`maa(i) × maa(j)` in "M-ops", and a placeholder distance `0.125 + (i + j) × 0.015`
(`tasks.md` D005). Species come from `SPECIES_300_UNBALANCED.slice(0, N)`, so the grid
always shows the heaviest key taxa — deliberate.

**Palette**: eight fixed rank colours, indexed modulo 8.

---

## `ScalabilityCharts` — measured curves

**Controls**: `activeTab ∈ {'phase3_speedup', 'phase4_speedup', 'total_time'}` (default
`'phase4_speedup'`), `datasetChoice ∈ {'unbalanced', 'balanced'}` (default `'unbalanced'`).

**Chart contract**
- Registers `LineController`, `LineElement`, `PointElement`, `LinearScale`,
  `CategoryScale`, `LogarithmicScale`, `Tooltip`, `Legend`.
- Unlike the workload chart, the instance is **destroyed and recreated** on every
  dependency change, because the dataset *shape* (number and identity of series) changes
  between tabs.
- Interaction mode `'index'` with `intersect: false`, so hovering a process count reveals
  every series at once — the comparison is the point.
- `afterBody` tooltip callbacks annotate P = 128 (metacache collapse) and P = 256
  (isend limit) on the relevant tabs.
- Series colours are fixed and semantic: `isend` emerald, `metacache` rose, ideal grey
  dashed, Phase 3 cyan.

---

## `NumericCorrectness` — IEEE-754 verification

**State**: `searchTerm`, `selectedPair` (defaults to the first sample row).

**Contract**
- Filter matches `spA` **or** `spB`, case-insensitive substring.
- `toHexFloat64(n)` writes the double into an 8-byte `ArrayBuffer` and reads back
  `Uint32[1]` then `Uint32[0]`, each zero-padded to 8 hex digits, upper-cased with a `0x`
  prefix — i.e. big-endian presentation of the little-endian in-memory layout.
- The delta column always renders exactly zero; the header badge reports
  `PHYLIP_SAMPLE_DATA.length` of `PHYLIP_SAMPLE_DATA.length` verified pairs.

---

## `TFMBranchExplorer` — Git dossier

**State**: the selected branch id (defaults to the recommended `isend` branch).

**Contract**: renders `BRANCHES` (6 entries) with bilingual field pairs selected by `lang`;
`status` maps to a badge style (`recommended` emerald · `baseline` slate · `intermediate`
blue · `experimental` amber); the C++ snippet renders as preformatted text; the external
link opens the real branch with `target="_blank" rel="noopener noreferrer"`.

---

## `generateTFMPdf(lang)` — export utility

**Signature**: `generateTFMPdf(lang: Language = 'es'): void`
**Effect**: builds an A4 portrait jsPDF document and triggers a download of
`TFM_Ana_Izaguirre_ProtSpam_HPC.pdf`.

**Layout contract**: dark header band with an emerald accent rule and a supercomputer
metadata box; an academic details panel (author, advisor, defence date, repository); an
executive summary; performance highlights; a six-row branch directory; an emerald
conclusion panel; a footer reading `Página 1 / 1`.

**Known gap**: body copy follows `lang`, the title line is hard-coded Spanish
(`tasks.md` D004).

**Callers must** wrap the call in `try/catch`; failure is logged, not surfaced.
