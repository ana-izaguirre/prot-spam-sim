# Data Model: Entities & Static Datasets

**Source of truth**: `src/data/speciesData.ts`, `src/context/LanguageThemeContext.tsx`,
`src/components/TFMBranchExplorer.tsx`, `src/components/ProtSpamStepSimulator.tsx`.

Everything here is compiled into the bundle. There is no database, no API and no runtime
data fetching (Constitution III).

---

## 1. Species

One whole proteome participating in the phylogenetic comparison.

| Field | Type | Meaning |
|---|---|---|
| `id` | `number` | Zero-based index; doubles as the matrix row/column index |
| `name` | `string` | Display name (`"Homo sapiens (Humano)"`, `"Taxon_042"`) |
| `shortCode` | `string` | 3-character label for dense grids (`"HSA"`, `"T042"`) |
| `maa` | `number` | Proteome size in millions of amino acids — the load proxy |
| `proteins` | `number` | Protein count, shown in the matrix inspector |
| `taxon` | `string` | Taxonomic group (`Bacteria`, `Archaea`, `Eukaryota`, `Mammalia`, …) |
| `isHuman?` | `boolean` | Marks the bottleneck species; drives warning colouring |

**Validation rules**: `maa > 0`; `id` unique and contiguous; `shortCode` unique within a
dataset; at most one entry per dataset carries `isHuman`.

### 1.1 `SPECIES_64_HOMOGENEOUS` — the control dataset

64 synthetic species generated deterministically:

```
maa_i      = round(14.2 + sin(i × 0.7) × 1.8, 2)     → ≈ 12.4 … 16.0 Maa
proteins_i = round(maa_i × 3200)
taxon_i    = i < 20 ? Bacteria : i < 40 ? Archaea : Eukaryota
```

Sizes span a 1.3× range, so any imbalance the workload module shows under this dataset is
*structural* (triangular geometry), not biological. That contrast is the dataset's whole
purpose.

### 1.2 `SPECIES_300_UNBALANCED` — the realistic dataset

300 species. Indices 0–14 are the 15 real `KEY_TAXA` entries, ordered by descending size:

| # | Species | Code | Maa | Proteins | Taxon |
|---|---|---|---:|---:|---|
| 0 | Homo sapiens | HSA | 69.58 | 20 431 | Mammalia · `isHuman` |
| 1 | Mus musculus | MMU | 58.20 | 17 200 | Mammalia |
| 2 | Rattus norvegicus | RNO | 52.40 | 16 100 | Mammalia |
| 3 | Gallus gallus | GGA | 44.30 | 15 300 | Aves |
| 4 | Arabidopsis thaliana | ATH | 42.10 | 27 400 | Plantae |
| 5 | Danio rerio | DRE | 39.80 | 14 200 | Actinopterygii |
| 6 | Drosophila melanogaster | DME | 33.40 | 13 900 | Insecta |
| 7 | Caenorhabditis elegans | CEL | 25.10 | 20 100 | Nematoda |
| 8 | Saccharomyces cerevisiae | SCE | 12.80 | 6 275 | Fungi |
| 9 | Schizosaccharomyces pombe | SPO | 10.40 | 5 120 | Fungi |
| 10 | Escherichia coli K-12 | ECO | 4.10 | 4 288 | Bacteria |
| 11 | Bacillus subtilis | BSU | 3.80 | 4 100 | Bacteria |
| 12 | Mycobacterium tuberculosis | MTU | 3.20 | 3 990 | Bacteria |
| 13 | Methanocaldococcus jannaschii | MJA | 1.75 | 1 780 | Archaea |
| 14 | Mycoplasma genitalium | MGE | 0.58 | 482 | Bacteria |

Indices 15–299 are filled deterministically to approximate a log-normal size profile:

```
r_i    = (sin(i × 1.33) × 0.5 + 0.5) ^ 2.2      → skewed toward small values
maa_i  = round(1.2 + r_i × 22.0, 2)             → ≈ 1.2 … 23.2 Maa
taxon  = i mod 3 → Bacteria | Eukaryota | Archaea
```

**Why it matters**: *Homo sapiens* at 69.58 Maa against a minimum of 0.58 Maa is a 120×
span, and against the dataset mean it is the source of the thesis' efficiency ceiling
`E_max = mean(n) / max(n)`. Because the key taxa occupy the *lowest* indices, they also sit
in the *heaviest* rows of the upper triangle — geometric and biological imbalance stack on
the same ranks. This is the single most important property of the dataset.

---

## 2. ProcessWorkload

The result of assigning species to one MPI rank.

| Field | Type | Meaning |
|---|---|---|
| `rank` | `number` | MPI rank index, `0 … P−1` |
| `speciesCount` | `number` | How many species this rank owns |
| `speciesAssigned` | `number[]` | Their indices |
| `comparisonsCount` | `number` | Owned upper-triangle pairs `(i, j), j > i` |
| `totalMaa` | `number` | Summed proteome load |
| `hasHomoSapiens` | `boolean` | Whether the bottleneck species landed here |

### 2.1 `calculateWorkload(speciesList, numProcesses, algorithmType)`

Pure function, no side effects, deterministic. Every species row `i` contributes exactly
`n − 1 − i` comparisons (its share of the upper triangle), regardless of strategy — the
strategies differ only in *which rank* receives that row.

**`algoritmo1_cyclic`** (the thesis' Algorithm 1, default):
```
owner(i) = i mod P
```
Interleaving pairs heavy low-index rows with light high-index rows, so pair counts come out
near-uniform.

**`naive_block`** (the counter-example):
```
b        = ceil(n / P)
owner(i) = min(floor(i / b), P − 1)
```
Rank 0 receives the first, heaviest block; the last rank receives rows that contribute
almost nothing — the ~50 % structural efficiency ceiling made visible.

**Invariant**: `Σ comparisonsCount = n(n − 1) / 2` under both strategies.

### 2.2 Derived metrics (computed in `WorkloadSimulator`)

```
totalMaa       = Σ rank.totalMaa
avgMaa         = totalMaa / P
imbalance λ    = max(totalMaa) / avgMaa          (1.0 = perfect)
bottleneckRank = first rank with hasHomoSapiens, else 0
totalPairs     = Σ rank.comparisonsCount
```

---

## 3. SCALABILITY_DATA — measured results

The only experimental data in the application. Nine process counts:
`[1, 2, 4, 8, 16, 32, 64, 128, 256]`, and two datasets: `unbalanced` (300 species with
*Homo sapiens*) and `balanced` (300 species without the extreme outlier).

Each dataset carries five series:

| Key | Fields | What it shows |
|---|---|---|
| `phase3` | `speedup_ideal`, `speedup_real`, `time_sec` | Spaced-word generation + `std::sort`, the well-behaved phase |
| `phase4_metacache` | `speedup`, `time_sec` | Blocking `MPI_Send` distance computation |
| `phase4_isend` | `speedup`, `time_sec` | Non-blocking `MPI_Isend` + `MPI_Waitall` |
| `total_metacache` | `time_sec` | End-to-end runtime, blocking |
| `total_isend` | `time_sec` | End-to-end runtime, non-blocking |

**The headline shape (unbalanced dataset)**:

| P | Phase 4 metacache | Phase 4 isend | Total metacache | Total isend |
|---:|---:|---:|---:|---:|
| 1 | 512.0 s (1.0×) | 512.0 s (1.0×) | 854.0 s | 854.0 s |
| 32 | 31.2 s (16.4×) | 18.2 s (28.1×) | 43.9 s | 30.9 s |
| 64 | 24.1 s (21.2×) | 9.77 s (52.4×) | 31.2 s | 16.87 s |
| **128** | **27.6 s (18.5×)** | **5.71 s (89.6×)** | **32.2 s** | **10.31 s** |
| 256 | 45.7 s (11.2×) | 4.18 s (122.4×) | 49.3 s | 7.74 s |

`metacache` **inverts** past 64 processes — its runtime grows from 24.1 s to 45.7 s while
its speedup collapses from 21.2× to 11.2× — because the sender serialises behind the
rendezvous protocol. `isend` keeps climbing to 122.4× at 256. This inversion is the visual
argument the scalability module exists to make, and the tooltips annotate exactly those
two points (128 = collapse, 256 = `isend` bandwidth limit).

**Constraint**: all series share the `processes` index; the arrays must stay the same
length and aligned. Values are transcribed measurements — never interpolated, smoothed or
recomputed in the browser.

---

## 4. PhylipPairComparison

One verified cell of the output distance matrix.

| Field | Type | Meaning |
|---|---|---|
| `spA`, `spB` | `string` | The two species compared |
| `seqValue` | `number` | Distance from the sequential reference run |
| `mpiValue` | `number` | Distance from the parallel run |
| `delta` | `number` | `|seqValue − mpiValue|`; **always exactly `0.0`** |
| `rankComputed` | `number` | Which rank owned the pair |
| `matchesK` | `number` | Spaced-word matches found |

`PHYLIP_SAMPLE_DATA` holds 16 pairs. Values are exact rationals (`1/7`, `1/6`, `1/4`,
`1/2`, `1/11`, `1/5`, `1/3`, `1.0`) consistent with `d = 1 / (matchesK + 1)`, and
`rankComputed` is consistent with `owner(i) = i mod P` over the key-taxa ordering.

The module re-derives each value's raw IEEE-754 encoding at runtime by writing the double
into an `ArrayBuffer` and reading back two `Uint32` words as big-endian hex. Because both
columns hold the *same* double, the hex strings are necessarily identical — the panel
demonstrates the invariance claim rather than testing it.

---

## 5. BranchInfo — the thesis Git dossier

Six branches of `github.com/ana-izaguirre/ProtSpaM`, each with `id`, `name`, `phase`,
bilingual `title`/`desc`/`why`/`features`, `url`, `status`, `speedup` and a
representative `cppSnippet`.

| Branch | Phase | Status | Headline |
|---|---|---|---|
| `feat/mpi-phase4-metacache-isend` | Phase 4, non-blocking | **recommended** | 4 204 s at 128P — 26.8× vs sequential |
| `feat/mpi-phase4-metacache` | Phase 4, blocking | intermediate | 7 702 s at 128P — network contention |
| `feat/mpi-phase3-a` | Phase 3, centralised read | intermediate | ~5.2× at 32P; avoids shared-FS contention |
| `feat/mpi-phase3-b` | Phase 3, distributed read | intermediate | Wins at 20 species, loses at 300 |
| `feat/seq` | Sequential baseline | baseline | 112.5 ks — over 31 hours for 300 species |
| `feat/mpi-phase4-metacache-isend-calcopt` | Sequential path `np=1` | experimental | Rejected: +19.5 % sequential time |

`status` drives the badge colour; `speedup` is display text, never parsed.

---

## 6. Step — the base-simulator frame

The step simulator precomputes the whole run as an array of self-contained frames, so
rendering is a pure array lookup and stepping backwards is exact.

| Field | Type | Meaning |
|---|---|---|
| `phase` | `string` | Localised phase label (`"Phase 3: spacedwords()"`) |
| `badgeClass` | `string` | Tailwind classes for the phase badge |
| `activeFn` | `'spacedwords' \| 'sort' \| 'setwords' \| 'none'` | Highlights the pseudo-call-stack |
| `s1Pos`, `s2Pos` | `number` | Cursor positions; `−1` when inactive |
| `key` | `string` | The spaced word for this step |
| `patternStr` | `string` | The binary pattern in play |
| `desc` | `string` | Narration; contains inline HTML, rendered via `innerHTML` |
| `isMatch?`, `matchedKey?` | `boolean`, `string \| null` | Hit/miss outcome |
| `s1Extend?`, `s2Extend?` | `number[]` | Indices covered by the current extension |
| `memoryState` | `object[]` | Per-pattern index blocks: raw list, sorted list, status |
| `stackState` | `object[]` | Per-pattern match and miss stacks |
| `matchesState` | `object[]` | Evaluated matches with scores and accept/reject status |
| `alignmentData?` | `{ s1, s2, scores, accum, activeIndex }` | The extension table |
| `activePair?` | `{ a, b, score }` | The character pair being scored |
| `showMatrix?` | `boolean` | Terminal step flag |
| `globalResults?` | `object[]` | Per-pattern approved counts and distances |
| `avgDist?` | `number` | Mean distance across patterns |

Frames are built with `JSON.parse(JSON.stringify(...))` deep copies, so no frame shares
mutable structure with any other. Cost is `O(steps × state size)` — see `research.md` F5.

### 6.1 `BLOSUM62` (didactic stand-in)

A 4×4 table over `A`, `C`, `T`, `G`:

| | A | C | T | G |
|---|---:|---:|---:|---:|
| **A** | 4 | 0 | 0 | 0 |
| **C** | 0 | 9 | −1 | −3 |
| **T** | 0 | −1 | 5 | −2 |
| **G** | 0 | −3 | −2 | 6 |

`getBlosumScore(a, b)` falls back to `a === b ? 4 : −1` for anything outside the table, so
arbitrary letters remain scoreable. This is a nucleotide-alphabet stand-in for the real
20×20 amino-acid matrix (`tasks.md` D006).

### 6.2 Defaults

`patterns = "1*11*1, 11**1, 1**11"`, `S1 = "ACTGACACTG"`, `S2 = "ATTGCAATTG"`,
`threshold T = 8`, `dropoff X = 3` (declared, never applied — `spec.md` FR-018).

---

## 7. ExecutionLogEntry

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | `"<batchId>-<n>"`, where `batchId` is a random base-36 fragment |
| `time` | `string` | `HH:MM:SS.mmm` local wall-clock |
| `level` | `'info' \| 'mpi' \| 'warn' \| 'success'` | Severity; drives colour and filtering |
| `phase` | `'INIT' \| 'DATA' \| 'PART' \| 'COMPUTE' \| 'WARN' \| 'DONE'` | Pipeline stage tag |
| `message` | `string` | Localised line |
| `detail?` | `string` | Secondary line |

Every parameter change appends a batch of 5–6 entries after a 150 ms delay; the buffer is
capped with `slice(-80)`. The `WARN` entry only appears for the heterogeneous dataset under
cyclic partitioning, or for any block partition.

---

## 8. TranslationDictionary

`Record<Language, Record<string, string>>` with `Language = 'es' | 'en'`. Flat, namespaced
keys: `app.*` (shell, 20 keys), `modal.*` (9), `core.*` (24), `tfm.*` (7), `workload.*`
(24), `mpi.*` (14), `matrix.*` (13), `scall.*` (8), `num.*` (14) — roughly 133 keys per
language. `t(key)` returns the key itself when it is missing, so a gap degrades to a
visible identifier rather than a crash (`spec.md` FR-009).

**Known coverage gap**: about 40 % of user-visible prose — long explanations inside the
modules, demo-stage captions, chart labels, tooltip text — bypasses the dictionary via
inline `lang === 'es' ? … : …` ternaries. Parity is maintained by hand
(`research.md`, open question 2).

**Persistence**: `localStorage['protspam_lang']` and `localStorage['protspam_theme']`,
both written by effects; unrecognised values fall back to `es` and `dark`.
