# Feature Specification: ProtSpam MPI HPC Suite & Simulator

**Feature Branch**: `claude/vite-to-astro-migration-nwv90a`
**Created**: 2026-08-22
**Status**: Documented (reverse-engineered from the shipped Vite prototype)
**Input**: "Analyse this Vite prototype and produce the technical specification of its
components, simulator logic and static data, using GitHub Spec Kit, documented in English."

> **Scope note.** This is a _descriptive_ specification: it states what the existing
> prototype does and why, in Spec Kit format, so that it can be re-planned, ported, or
> extended without re-reading 6 800 lines of TSX. Requirements marked **[GAP]** describe
> behaviour that the current build does not yet satisfy; they are tracked in `tasks.md`.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Understand the Prot-SpaM algorithm step by step (Priority: P1)

A student or thesis examiner opens the suite and, without reading any C++, follows the
base Prot-SpaM algorithm one operation at a time: how a binary pattern masks a sequence
into a spaced word, how the word list is sorted for lookup, how a hit on the second
sequence is extended character by character with a substitution matrix, and how the
accumulated score turns into a phylogenetic distance.

**Why this priority**: This is the default landing module (`core_sim`). Everything else
in the suite — partitioning, communication, scalability — is only meaningful once the
unit of work is understood.

**Independent Test**: Load the app with no interaction. The base-algorithm simulator is
visible, a step counter reads `Step 0 of N`, and pressing _Next_ advances through
extraction → sorting → match/miss → extension → final matrix with a written narration
for each step.

**Acceptance Scenarios**:

1. **Given** the default parameters (patterns `1*11*1, 11**1, 1**11`, S1 `ACTGACACTG`,
   S2 `ATTGCAATTG`), **When** the user presses _Play_, **Then** the simulation advances
   one step per tick at the selected speed and stops on the final step.
2. **Given** any step of the extraction phase, **When** the step is displayed, **Then**
   the characters of S1 covered by the current pattern window are highlighted and the
   extracted key is shown verbatim.
3. **Given** a hit between S1 and S2, **When** the extension steps run, **Then** each
   aligned character pair shows its substitution score and the running accumulated score.
4. **Given** the user edits the patterns or sequences, **When** they press _Recompute_,
   **Then** a new step list is generated from scratch and the view resets to step 0.
5. **Given** the user switches language, **When** the switch completes, **Then** the
   narration of every step is regenerated in the new language.

---

### User Story 2 — See why a triangular workload does not balance itself (Priority: P1)

An HPC practitioner selects a dataset and a process count, switches between the naive
block partition and the thesis' cyclic Algorithm 1, and watches the per-rank load bars,
the imbalance factor, and the identity of the bottleneck rank change in real time.

**Why this priority**: Load imbalance is the central negative result of the thesis
(structural ~50 % efficiency ceiling, plus a 12.6 % ceiling from proteome size
disparity). The suite must make it visible rather than merely assert it.

**Independent Test**: Open the Workload module, choose the 300-species heterogeneous
dataset with 32 processes and cyclic partitioning; the chart shows one rank far above
the others, the imbalance KPI exceeds 2×, and the log names the rank holding
_Homo sapiens_.

**Acceptance Scenarios**:

1. **Given** P processes and a dataset, **When** the user changes the displayed metric
   (amino-acid load / assigned species / assigned pairs), **Then** the same partition is
   re-rendered under the new metric without changing the partition itself.
2. **Given** the heterogeneous dataset, **When** the metric is amino-acid load, **Then**
   the rank owning _Homo sapiens_ is drawn in the warning colour and flagged in the KPIs.
3. **Given** any parameter change, **When** it is applied, **Then** a timestamped MPI-style
   execution log records initialisation, dataset load, partition strategy, pair count,
   any imbalance warning, and completion.
4. **Given** demo mode is enabled, **When** it runs, **Then** P cycles 2 → 4 → 8 → 16 →
   32 → 64 → 2 at the chosen cadence, each stage accompanied by an explanatory caption.
5. **Given** a populated log, **When** the user copies it, **Then** the full filtered log
   is placed on the clipboard as plain text and a confirmation is shown.

---

### User Story 3 — Compare blocking vs non-blocking MPI communication (Priority: P2)

A reader who knows MPI wants to see, not just read, why `MPI_Isend` + `MPI_Waitall`
outperforms a loop of blocking `MPI_Send` at 128 processes.

**Why this priority**: This is the thesis' main positive result (up to 45 % time
reduction), but it is comprehensible only after the workload story.

**Independent Test**: Open the MPI module, step the timeline in `metacache` mode and
observe the sender serialising to one destination at a time; switch to `isend` and
observe all destinations receiving in one burst with a `PendingSend` queue filling up.

**Acceptance Scenarios**:

1. **Given** `metacache` mode, **When** the timeline advances, **Then** exactly one
   receiver rank is in the _receiving_ state at a time and the others are idle-waiting.
2. **Given** `isend` mode, **When** the timeline advances past the burst steps, **Then**
   all four receiver ranks are computing concurrently and the `PendingSend` queue lists
   one active request per destination.
3. **Given** either mode, **When** the timeline reaches the synchronisation step,
   **Then** all in-flight requests are marked completed.
4. **Given** any state, **When** the user presses reset, **Then** the timeline returns to
   step 0 and autoplay stops.

---

### User Story 4 — Inspect the triangular matrix cell by cell (Priority: P2)

A user sizes an N×N distance matrix, picks a partitioning rule and a process count, and
clicks any cell to learn which rank owns it, which two species it compares, and roughly
how expensive that comparison is.

**Independent Test**: Open the Matrix module, click cell (0, 1); the inspector names
species 0 and 1, the owning rank, and marks the cell as belonging to the computed upper
half.

**Acceptance Scenarios**:

1. **Given** a cell on the main diagonal, **When** selected, **Then** it is reported as
   distance 0 and excluded from computation.
2. **Given** a cell below the diagonal, **When** selected, **Then** it is reported as
   skipped by symmetry.
3. **Given** a cell above the diagonal, **When** selected, **Then** the owning rank is
   `i mod P` under cyclic partitioning and `min(⌊i / ⌈N/P⌉⌋, P−1)` under block partitioning.
4. **Given** any configuration, **When** the per-rank summary is displayed, **Then** the
   cell counts sum exactly to `N(N−1)/2`.

---

### User Story 5 — Read the measured scalability curves (Priority: P2)

A reader compares Phase 3 speedup, Phase 4 speedup (`metacache` vs `isend`) and total
runtime across 1 → 256 processes, for a balanced and an unbalanced 300-species dataset.

**Acceptance Scenarios**:

1. **Given** the Phase 4 tab, **When** the chart renders, **Then** ideal linear speedup,
   `isend` and `metacache` are plotted together over the nine measured process counts.
2. **Given** the 128-process point on the Phase 4 tab, **When** hovered, **Then** the
   tooltip explains the `metacache` collapse caused by serialised `MPI_Send`.
3. **Given** the dataset toggle, **When** switched between heterogeneous and balanced,
   **Then** all series update from the corresponding measured series.

---

### User Story 6 — Verify bitwise numerical invariance (Priority: P3)

A reviewer checks the claim that the parallel PHYLIP matrix is bit-for-bit identical to
the sequential one, by comparing sample pairs and their raw IEEE-754 encodings.

**Acceptance Scenarios**:

1. **Given** the pair table, **When** a species name is typed into the filter, **Then**
   only rows whose first or second species contains that text (case-insensitive) remain.
2. **Given** a selected pair, **When** the proof panel renders, **Then** the 64-bit
   hexadecimal encodings of the sequential and parallel values are shown side by side and
   reported as identical.
3. **Given** any row, **When** displayed, **Then** the delta column reads exactly zero.

---

### User Story 7 — Navigate the thesis' Git branch history (Priority: P3)

A reader browses the six development branches, each with its phase, status, headline
speedup, design decisions, representative C++ snippet and a link to GitHub.

**Acceptance Scenarios**:

1. **Given** the branch list, **When** a branch is selected, **Then** its description,
   rationale, feature list and C++ snippet are shown in the active language.
2. **Given** any branch, **When** its external link is used, **Then** it opens the real
   branch on `github.com/ana-izaguirre/ProtSpaM` in a new tab.

---

### User Story 8 — Take the academic factsheet away as a PDF (Priority: P3)

A visitor downloads a one-page A4 factsheet with the thesis metadata, executive summary,
performance highlights and branch directory, generated entirely in the browser.

**Acceptance Scenarios**:

1. **Given** the header or the documentation modal, **When** the download action is used,
   **Then** an A4 PDF is saved as `TFM_Ana_Izaguirre_ProtSpam_HPC.pdf` and the button
   confirms success for a few seconds.
2. **Given** the active language, **When** the PDF is generated, **Then** its body text
   follows that language. **[GAP]** The document title line is currently Spanish-only.

---

### Edge Cases

- **Empty or malformed simulator input**: pattern strings are stripped of characters
  other than `1` and `*`; an empty pattern list falls back to `1*11*1`. Sequences are
  upper-cased, stripped of non-letters, and fall back to `ACTG` / `ATTG`.
- **Pattern longer than the sequence**: extraction and matching loops are skipped, and
  the simulation still terminates on the final matrix step.
- **No hits at all**: every pattern contributes an approved-match count of 0 and a
  synthetic distance of 1.0.
- **P larger than the matrix dimension**: high ranks legitimately own zero rows and are
  rendered as empty bars.
- **Clipboard unavailable**: log copy is a best-effort call and must not break the view.
  **[GAP]** The current call has no rejection handler.
- **Light theme**: colours are remapped by an override stylesheet keyed on Tailwind
  class names; utility classes not listed there keep their dark values. **[GAP]**
- **Repeated language switches during autoplay**: the step list is regenerated and the
  cursor returns to 0, which stops perceived playback progress.

---

## Requirements _(mandatory)_

### Functional Requirements

**Shell & navigation**

- **FR-001**: The system MUST present exactly seven modules — base algorithm, TFM
  branches, workload, MPI communication, triangular matrix, scalability, numerical
  correctness — and render exactly one at a time.
- **FR-002**: The system MUST open on the base-algorithm module.
- **FR-003**: Navigation MUST adapt to viewport width: full inline bar on the widest
  screens, a "More" overflow menu on large screens, and a drawer below that.
- **FR-004**: The overflow menu MUST close when the user clicks outside it.
- **FR-005**: The system MUST display the thesis attribution banner (title, author,
  advisor, supercomputer, institution badge) above the active module.
- **FR-006**: The system MUST provide a documentation modal containing the academic
  factsheet, the six-branch directory, and three architecture summaries.

**Internationalisation & theming**

- **FR-007**: The system MUST support Spanish and English, switchable at any time.
- **FR-008**: The system MUST persist language and theme choices across sessions.
- **FR-009**: An unknown translation key MUST render as the key itself rather than crash.
- **FR-010**: The system MUST support a dark (default) and a light theme, applied by
  toggling a class on the document root.

**Base-algorithm simulator**

- **FR-011**: The system MUST accept a comma-separated list of binary patterns, two
  sequences, and a score threshold as inputs.
- **FR-012**: The system MUST generate a fully enumerated, deterministic list of narrated
  steps covering, for every pattern: extraction of each spaced word from S1, the sort of
  the resulting index, the hit/miss decision for every window of S2, and one step per
  aligned character of every extension.
- **FR-013**: Each step MUST carry its phase label, its highlighted positions in S1 and
  S2, the memory/index state, the match/miss stacks, and a human-readable narration.
- **FR-014**: A match MUST be extended in both directions as far as both sequences allow,
  scored per aligned pair, and accepted when its maximum accumulated score reaches the
  threshold.
- **FR-015**: The final step MUST present the per-pattern results and the aggregate
  distance alongside the Kimura formula.
- **FR-016**: Playback MUST support play/pause, single-step forward and backward, reset,
  and three speeds; autoplay MUST stop at the last step.
- **FR-017**: Parameter edits MUST take effect only when the user requests recomputation.
- **FR-018**: The dropoff parameter X MUST bound the extension: each direction grows away
  from the seed until the running score falls more than X below the best score reached,
  then is trimmed back to that maximum. The accept/reject decision MUST use the resulting
  trimmed score.

**Workload simulator**

- **FR-019**: The system MUST offer two datasets (64 homogeneous, 300 heterogeneous),
  six process counts (2–64), two partitioning strategies, and three display metrics.
- **FR-020**: The system MUST compute, per rank, the assigned species, their count, their
  summed amino-acid load, the number of owned upper-triangle pairs, and whether the rank
  owns _Homo sapiens_.
- **FR-021**: The system MUST report the imbalance factor (max load ÷ mean load), the
  bottleneck rank, the max-vs-min spread, and the total pair count.
- **FR-022**: The system MUST emit a timestamped, level-tagged execution log for every
  parameter change, retaining at most the 80 most recent entries.
- **FR-023**: The log MUST be filterable by level, auto-scrollable, copyable and clearable.
- **FR-024**: Demo mode MUST cycle the process count and narrate each stage.

**MPI communication visualiser**

- **FR-025**: The system MUST animate a fixed 12-step timeline for one sender and four
  receivers under two mechanisms.
- **FR-026**: Under `metacache`, receivers MUST be served strictly one at a time; under
  `isend`, all destinations MUST be dispatched in a burst and then compute concurrently.
- **FR-027**: The system MUST render the `PendingSend` queue with per-request state
  (queued → active → completed) and payload size.
- **FR-028**: Playback MUST support play/pause, single-step, reset and three speeds.

**Triangular matrix explorer**

- **FR-029**: The system MUST render an N×N grid for even N from 6 to 20, colour-coded by
  owning rank, distinguishing diagonal, skipped lower half and computed upper half.
- **FR-030**: The system MUST support 2, 4 or 8 ranks under cyclic or block partitioning.
- **FR-031**: Selecting a cell MUST reveal both species with their taxon and protein
  count, the owning rank, a relative cost estimate, and a distance value.
- **FR-032**: The system MUST show per-rank owned-cell counts and their share of the
  total upper-triangle cells.

**Scalability charts**

- **FR-033**: The system MUST plot three views — Phase 3 speedup, Phase 4 speedup
  (`metacache` vs `isend` vs ideal), and total runtime — over the nine measured process
  counts, for two datasets.
- **FR-034**: Tooltips MUST annotate the 128-process `metacache` collapse and the
  256-process `isend` limit.

**Numerical correctness**

- **FR-035**: The system MUST list sample species pairs with their sequential value,
  parallel value, delta, and owning rank, filterable by species name.
- **FR-036**: The system MUST render the raw 64-bit IEEE-754 hexadecimal encoding of both
  values for the selected pair and assert their bitwise identity.

**Branch explorer & export**

- **FR-037**: The system MUST describe six development branches, each with phase, status,
  headline speedup, design decisions, a C++ snippet and a GitHub link.
- **FR-038**: The system MUST generate the A4 PDF factsheet client-side on demand.

### Key Entities

- **Species** — one proteome: identifier, display name, short code, amino-acid volume in
  millions (Maa), protein count, taxon, and an optional human flag driving bottleneck
  highlighting.
- **ProcessWorkload** — everything an MPI rank owns after partitioning: rank index,
  assigned species indices and count, owned upper-triangle pair count, summed Maa load,
  and the _Homo sapiens_ flag.
- **Step** — one frame of the base-algorithm narration: phase label and badge style,
  active function, cursor positions in S1/S2, current key and pattern, narration,
  optional extension indices and alignment table, index/memory snapshot, match and miss
  stacks, and the terminal flag that reveals the final matrix.
- **ExecutionLogEntry** — one MPI-style log line: id, timestamp, severity level, phase
  tag, message and optional detail.
- **PhylipPairComparison** — one verified matrix entry: both species, the sequential and
  parallel values, their delta, the computing rank, and the match count.
- **BranchInfo** — one Git branch of the thesis: id, name, phase, bilingual title,
  description, rationale and feature list, status, headline speedup, C++ snippet, URL.
- **ScalabilityDataset** — the measured series for one dataset: process counts, Phase 3
  ideal/real speedup and runtime, Phase 4 `metacache` and `isend` speedup and runtime,
  and total runtime per mechanism.
- **TranslationDictionary** — the flat key → string map for each language.

---

## Success Criteria _(mandatory)_

- **SC-001**: A reader with no MPI background can explain, after one pass through the
  base-algorithm module, what a spaced word is and how a distance is produced from
  pattern matches.
- **SC-002**: Every one of the seven modules is reachable and fully operable at 360 px,
  768 px, 1280 px and 1920 px viewport widths, with no horizontal page scroll.
- **SC-003**: Switching language leaves no visible untranslated string in any module.
- **SC-004**: Language and theme survive a full page reload.
- **SC-005**: Changing any workload control updates the chart, all four KPIs and the log
  within one second, with no manual refresh.
- **SC-006**: For every supported (N, P, strategy) combination, the owned-cell counts
  reported per rank sum exactly to `N(N−1)/2`.
- **SC-007**: Every performance figure displayed in the UI or the PDF is traceable to the
  thesis dataset in `src/data/speciesData.ts` or to the branch dossier.
- **SC-008**: The base-algorithm simulation is reproducible: identical inputs always
  produce an identical step sequence.
- **SC-009**: The PDF downloads successfully in current Chromium, Firefox and WebKit
  browsers with no network access after initial page load.
- **SC-010**: `npm run lint` (`tsc --noEmit`) reports no errors.

---

## Assumptions

- The audience is academic — thesis examiners, HPC students, colleagues — not the general
  public; density of information is preferred over marketing minimalism.
- The datasets are illustrative constructions, not the exact proteome files used in the
  thesis; only the measured timing series are presented as experimental results.
- All content is public: no authentication, no personalisation, no analytics.
- Modern evergreen browsers only; no legacy support target is defined.

## Dependencies

- **Google Fonts** (Inter, JetBrains Mono, Material Symbols) loaded from
  `fonts.googleapis.com` in `index.html`; the app degrades to system fonts offline.
- **The thesis repository** `github.com/ana-izaguirre/ProtSpaM` for all outbound
  branch links; broken links are an external failure mode.
- No backend service, database, or runtime API of any kind.

## Out of Scope

- Executing real Prot-SpaM C++ code, real MPI, or any actual sequence analysis.
- Uploading user FASTA files or arbitrary datasets.
- Server-side rendering, persistence beyond `localStorage`, or multi-user state.
- Recomputing or interpolating the measured scalability data in the browser.
