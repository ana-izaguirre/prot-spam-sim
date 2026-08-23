# Prot-SpaM HPC Suite & Interactive Simulator

**English** · [Español](./README.es.md)

[![CI](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml)
[![Netlify Status](https://api.netlify.com/api/v1/badges/1f070c7e-b6d8-4bf8-addb-f03bcb9cd28b/deploy-status)](https://app.netlify.com/projects/prot-spam/deploys)

An interactive simulator and architecture explorer for **Prot-SpaM**, an alignment-free
phylogenetic reconstruction tool for whole-proteome sequences, parallelised for
distributed-memory systems with MPI.

Built as a static [Astro](https://astro.build) site with React islands. No backend, no
database, no runtime API calls — everything runs in the browser.

---

## Academic context

Based on the **Master's Thesis (TFM)**:

> **"Reconstrucción filogenética de secuencias de proteoma completo en paralelo sobre
> sistemas de memoria distribuida"**
> *(Parallel phylogenetic reconstruction of whole-proteome sequences on distributed-memory systems)*

| | |
|---|---|
| **Author** | Ana Izaguirre Matamoros |
| **Advisor** | Jorge González Domínguez |
| **Degree** | Interuniversity Master's in High Performance Computing (MUI HPC) |
| **Institution** | Facultade de Informática, Universidade da Coruña (UDC) / CESGA |
| **Supercomputer** | FinisTerrae III — Intel Xeon Platinum 8352Y, 64 cores/node, OpenMPI 5.0.9, SLURM |

**C++ source repository**: [github.com/ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)

### Development branches

| Branch | Role |
|---|---|
| [`feat/seq`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/seq) | Clean sequential baseline with word checksums |
| [`feat/mpi-phase3-a`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-a) | Phase 3 with centralised FASTA reading on rank 0 |
| [`feat/mpi-phase3-b`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-b) | Phase 3 with independent distributed reading |
| [`feat/mpi-phase4-metacache`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache) | Phase 4 with blocking `MPI_Send`/`MPI_Recv` and a metadata cache |
| [`feat/mpi-phase4-metacache-isend`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend) | **Recommended** — non-blocking `MPI_Isend` bursts with a `PendingSend` queue and `MPI_Waitall` |
| [`feat/mpi-phase4-metacache-isend-calcopt`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend-calcopt) | Pattern precomputation on the sequential path (rejected: +19.5 % sequential time) |

---

## The algorithm being simulated

Prot-SpaM estimates phylogenetic distances without multiple sequence alignment, by
comparing whole protein sequences through **spaced words** defined by binary patterns
(w = 6 match positions, ℓ = 46, 40 don't-care positions, m = 5 patterns, threshold T = 0,
BLOSUM62).

```
┌─────────────────┐     ┌─────────────────────┐     ┌────────────────────────────────┐
│ 1. Patterns     │ ──> │ 2. FASTA reading    │ ──> │ 3. Spaced words                │
│ Θ(m·ℓ)          │     │ Θ(Σ nᵢ)             │     │ Θ(m·Σ nᵢ log nᵢ)               │
│ Fixed cost      │     │ Whole proteomes     │     │ Extraction + std::sort         │
└─────────────────┘     └─────────────────────┘     └────────────────────────────────┘
                                                                    │
┌─────────────────┐                                 ┌───────────────▼────────────────┐
│ 5. DMat output  │ <────────────────────────────── │ 4. Matches and distance        │
│ Θ(N²)           │        final MPI_Reduce         │ Θ(m·N²·ñ)                      │
│ PHYLIP matrix   │                                 │ BLOSUM62 + Kimura (j > i)      │
└─────────────────┘                                 └────────────────────────────────┘
```

**Phase 3 — spaced word generation and sorting.** Unit of work: one species. `std::sort`
alone is ~37.3 % of sequential runtime. Each process generates and sorts its own species'
words with no intermediate synchronisation.

**Phase 4 — distributed match computation.** Unit of work: a species pair (j > i), i.e.
N(N−1)/2 pairs of the upper triangle. Headers, sequences and metadata are transmitted once
before the pattern loop (`metacache`), and word buffers are discarded after each pattern to
bound memory. The blocking variant serialises behind the rendezvous protocol beyond 64–128
processes; the non-blocking variant fires concurrent `MPI_Isend` calls tracked in a
`PendingSend` queue and synchronises once with `MPI_Waitall`, **up to 45 % faster at 128
cores**.

**Load balancing.** Contiguous blocks of size N/P concentrate work on rank 0 — a structural
efficiency ceiling around 50 %. Proteome size disparity compounds it: *Homo sapiens*
(69.58 Maa) carries up to 207× the load of a microbial proteome (0.34 Maa), pushing the
bound E_max = n̄ / n_max down to 12.6 %.

**Numerical invariance.** Computing each pair (i, j) indivisibly on one process and
consolidating with `MPI_Reduce(MPI_SUM)` over disjoint positions initialised to exact 0.0
makes the parallel PHYLIP matrix bit-for-bit identical to the sequential one (Δ = 0.0).

---

## The seven interactive modules

| Module | What it shows |
|---|---|
| **Base algorithm** | Step-by-step narration of the core algorithm: spaced-word extraction, `std::sort` indexing, hit/miss decisions, gap-free BLOSUM62 extension, and the final distance matrix |
| **TFM branches** | The six Git branches with their phase, status, headline speedup, design decisions and representative C++ snippets |
| **Workload** | Per-rank load for two datasets, six process counts, two partitioning strategies and three metrics, with imbalance KPIs and a live MPI-style execution log |
| **MPI traffic** | Blocking `MPI_Send` versus non-blocking `MPI_Isend` on a stepped timeline, with the `PendingSend` queue and per-rank states |
| **Triangular matrix** | An N×N grid coloured by owning rank, with per-cell inspection of the two species, the owner and the relative cost |
| **Scalability** | Measured FinisTerrae III curves from 1 to 256 processes: Phase 3 speedup, Phase 4 `metacache` vs `isend`, and total runtime |
| **Correctness** | Sequential vs parallel PHYLIP values with their raw IEEE-754 encodings, proving bitwise identity |

Both languages (Spanish/English) and both themes (dark/light) apply to every module and
persist across reloads.

---

## Architecture

### Why Astro

The suite was originally a plain Vite SPA: seven modules, Chart.js and jsPDF in a single
959 kB bundle that had to execute before anything appeared on screen. The migration to
Astro changed the delivery model, not the features.

| | Before (Vite SPA) | After (Astro islands) |
|---|---|---|
| First paint | after the JS bundle executes | server-prerendered HTML |
| Initial JS | 958.9 kB (~300 kB gzipped) | **270.6 kB (~82 kB gzipped)** |
| Module code | one bundle, all seven modules | one chunk per module, on demand |
| Chart.js (167 kB) | always | only with the two chart modules |
| jsPDF (398 kB) | always | only when a factsheet is downloaded |
| Theme/language boot | after hydration (visible flash) | inline head script, before paint |
| Head / SEO | hand-written `index.html` | typed, composable Astro layout |

### How it fits together

```
Astro (build time, static)                React (browser, one island)
┌──────────────────────────────┐          ┌────────────────────────────────┐
│ BaseLayout.astro             │          │ AppShell → App                 │
│  · <head>, fonts, SEO tags   │          │  · LanguageThemeProvider       │
│  · inline theme/lang boot    │─ client: │  · header, nav, docs modal     │
│ index.astro                  │  load ──>│  · Suspense module switch      │
│  · the single route          │          │      ├── base algorithm (eager)│
│ 404.astro                    │          │      └── 6 modules (lazy)      │
└──────────────────────────────┘          └────────────────────────────────┘
```

**One island, not seven.** The active module, the language and the theme are shared
mutable client state, so splitting the modules into sibling islands would need an external
store — a rewrite rather than a migration, and it would buy nothing at runtime because only
one module is ever mounted. The payload win comes from `React.lazy` instead.

**Prerender-safe state.** Astro runs the island in Node at build time, so the provider
starts from the documented defaults (`es`, `dark`) and reconciles with `localStorage` in a
mount effect. An inline `<head>` script applies the stored theme class and `lang` attribute
before first paint, so the reconciliation is invisible. Both implementations share the same
exported keys and defaults so they cannot drift apart.

**Storage is defensive.** Private-browsing modes and blocked site data make `localStorage`
throw; every read and write is wrapped and degrades to the documented default.

### Project structure

```
astro.config.mjs              # static output, React integration, Tailwind 4 Vite plugin
src/
├── pages/
│   ├── index.astro           # the single route
│   └── 404.astro             # static not-found page
├── layouts/
│   └── BaseLayout.astro      # <head>, fonts, SEO, theme/lang boot script
├── islands/
│   └── AppShell.tsx          # hydration entry point
├── App.tsx                   # shell: header, nav, banner, docs modal, module switch
├── components/               # the seven modules (React, unchanged by the migration)
├── context/
│   └── LanguageThemeContext.tsx   # i18n dictionary + theme, prerender-safe
├── data/
│   └── speciesData.ts        # datasets, the partitioner, measured scalability series
├── utils/
│   └── generatePdf.ts        # in-browser jsPDF factsheet (dynamically imported)
└── index.css                 # Tailwind entry, light-theme overrides, card styles
public/                       # favicon.svg, robots.txt
specs/                        # GitHub Spec Kit specification (see below)
```

### Static data

Everything is compiled into the bundle — there is no data fetching at runtime.

| Dataset | Contents |
|---|---|
| `SPECIES_64_HOMOGENEOUS` | 64 synthetic species, ≈12.4–16.0 Maa. Sizes span 1.3×, so any imbalance shown is purely geometric |
| `SPECIES_300_UNBALANCED` | 300 species: 15 real key taxa (*Homo sapiens* 69.58 Maa … *M. genitalium* 0.58 Maa) plus 285 log-normal fillers. The largest proteomes sit at the lowest indices, so geometric and biological imbalance stack on the same ranks |
| `SCALABILITY_DATA` | Measured FinisTerrae III results for 1–256 processes, balanced and unbalanced, Phase 3 / Phase 4 / total, `metacache` and `isend` |
| `PHYLIP_SAMPLE_DATA` | 16 verified matrix cells with sequential value, parallel value, delta (always exactly 0) and owning rank |

The scalability tables are the one place where the numbers are experimental measurements
from the thesis. They are transcribed, never interpolated or recomputed in the browser.

---

## Getting started

Requires **Node.js 20+**.

```bash
npm install
npm run dev       # dev server on http://localhost:3000
npm run build     # static site into dist/
npm run preview   # serve the built site
npm run lint      # astro check — TypeScript and Astro diagnostics
```

### Deployment

The build output is fully static, so any static host works with no configuration:

```bash
npm run build && npx serve dist    # or Netlify, Vercel, GitHub Pages, S3, nginx
```

The only external request the page makes is the Google Fonts stylesheet; without it the
suite falls back to system fonts and stays fully functional.

#### Continuous deployment

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. **Check** — `npm ci`, `astro check`, `astro build`, then a guard that fails the run if
   `index.html`, `404.html`, `robots.txt` or `favicon.svg` is missing, or if the prerendered
   HTML comes back empty (which would mean the island silently regressed to client-only).
2. **Deploy** — the built directory is uploaded to Netlify: **production** on `main`,
   an aliased **preview** (`pr-<number>`) on pull requests. The deploy URL is written to
   the job summary. Pull requests from forks build but skip the deploy, since secrets are
   not exposed to them.

Required repository secrets and variables:

| Name | Kind | Purpose |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | secret | Netlify personal access token (*User settings → Applications → New access token*) |
| `NETLIFY_SITE_ID` | secret | The site's API ID (*Site configuration → General → Site information*) |
| `SITE_URL` | variable | Production origin, e.g. `https://your-site.netlify.app`. Sets Astro's `site`, which emits the canonical and `og:url` tags. Optional — they are omitted when unset |

`netlify.toml` carries the cache and security headers: fingerprinted `/_astro/*` assets are
immutable for a year, HTML always revalidates, plus `nosniff`, `Referrer-Policy` and
`X-Frame-Options`.

---

## Specification

The project is documented with [GitHub Spec Kit](https://github.com/github/spec-kit).

| Document | Contents |
|---|---|
| [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) | The five governing principles |
| [`specs/001-protspam-hpc-simulator/spec.md`](./specs/001-protspam-hpc-simulator/spec.md) | User stories, 38 functional requirements, success criteria |
| [`…/plan.md`](./specs/001-protspam-hpc-simulator/plan.md) | The Vite → Astro migration plan |
| [`…/tasks.md`](./specs/001-protspam-hpc-simulator/tasks.md) | The seven migration tasks and the deferred defects |
| [`…/research.md`](./specs/001-protspam-hpc-simulator/research.md) | Prototype analysis and migration decisions |
| [`…/data-model.md`](./specs/001-protspam-hpc-simulator/data-model.md) | Every entity and static dataset |
| [`…/contracts/`](./specs/001-protspam-hpc-simulator/contracts/) | Component, simulation-engine and i18n contracts |
| [`…/quickstart.md`](./specs/001-protspam-hpc-simulator/quickstart.md) | Commands, manual verification scenarios, deployment |

### Known simplifications

The simulator is a **teaching instrument**, not a re-implementation of the C++ tool. The
deliberate simplifications — a 4×4 substitution table standing in for BLOSUM62, an
extension that is not X-drop bounded, a synthetic per-pattern distance, a scripted MPI
timeline — are listed in
[`research.md`](./specs/001-protspam-hpc-simulator/research.md) §A.3, and the open defects
in [`tasks.md`](./specs/001-protspam-hpc-simulator/tasks.md) (D001–D006).

---

## Resources

- **C++ source**: [github.com/ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)
- **TFM factsheet**: generated in-browser as a PDF from the header or the documentation modal
