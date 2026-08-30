# ProtSpam HPC Suite — Interactive Simulator

**English** · [Español](./README.es.md)

[![CI](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml)
[![Smoke tests](https://img.shields.io/badge/smoke%20tests-Playwright-2EAD33?logo=playwright&logoColor=white)](./tests/smoke.spec.ts)
[![Live site](https://img.shields.io/badge/live-GitHub%20Pages-121011?logo=github)](https://ana-izaguirre.github.io/prot-spam-sim/)

An interactive simulator that makes an MPI parallelisation visible: how a triangular
workload fails to balance itself, why blocking sends collapse at 128 processes, and what a
spaced-word algorithm actually does, one step at a time.

The algorithm, the thesis and the C++ implementation live in their own repository:
**[ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)**. This repository is
only the simulator.

---

## How this was built

The interesting part of this project is its construction pipeline: four tools, each doing
the thing it is actually good at, with a written specification as the hand-off format
between them.

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ 1. Google Stitch │──▶│ 2. Google AI     │──▶│ 3. GitHub Spec   │──▶│ 4. Claude Code   │
│                  │   │    Studio        │   │    Kit           │   │                  │
│ Visual design    │   │ Working React    │   │ The prototype    │   │ Migration to     │
│ of the interface │   │ prototype, Vite  │   │ written down as  │   │ Astro, defect    │
│                  │   │ + Tailwind       │   │ a specification  │   │ fixes, CI/CD     │
└──────────────────┘   └──────────────────┘   └──────────────────┘   └──────────────────┘
      the look              something that       what it does and       something that
                            runs                 why                    ships
```

**1 — Google Stitch: the design.** The visual language came first: the Bento-grid layout,
the dark palette with its semantic accents, the density of the control panels. Designing
before coding is what kept seven dense technical modules looking like one product.

**2 — Google AI Studio: the working prototype.** Stitch's design became a React 19 + Vite
application: seven interactive modules, two languages, Chart.js visualisations, in-browser
PDF export. This is what proved the idea worked — and, like most prototypes, it was
optimised for existing rather than for being maintained.

**3 — GitHub Spec Kit: writing down what exists.** Before changing anything, the prototype
was reverse-engineered into a [Spec Kit](https://github.com/github/spec-kit)
specification: a constitution of governing principles, user stories and functional
requirements, a data model, component and engine contracts, and the migration plan. That
step is what turned an inherited codebase into something that could be changed safely —
and it surfaced six real defects nobody had noticed, including a simulation parameter that
did nothing and a scoring table claiming to be BLOSUM62 when it was not.

**4 — Claude Code: the engineering pass.** Working from the specification: migration from
Vite to Astro (**initial payload 958.9 kB → 270.6 kB**), the six defects fixed one pull
request at a time, a Playwright smoke suite, and a CI/CD pipeline that type-checks, builds,
tests in a real browser and only then deploys.

The specification is not documentation written after the fact — it is the artefact each
stage handed to the next, and it is still the contract the code is held to. It lives in
[`specs/`](./specs/001-protspam-hpc-simulator/) and
[`.specify/`](./.specify/memory/constitution.md).

---

## What the simulator shows

| Module                | What it makes visible                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **How it works**      | One execution of each variant — `seq`, phase 3a, phase 3b, `metacache`, `isend` — call by call |
| **Base algorithm**    | Spaced-word extraction, indexing, and X-drop bounded extension, narrated one step at a time    |
| **TFM branches**      | The six C++ development branches, their phase and their measured speedup                       |
| **Workload**          | Per-rank load under the implemented block partition vs the proposed cyclic one                 |
| **MPI traffic**       | Blocking `MPI_Send` serialising against non-blocking `MPI_Isend` overlapping                   |
| **Triangular matrix** | Which rank owns which pair, and why half the matrix is never computed                          |
| **Scalability**       | Measured FinisTerrae III curves, 1 to 256 processes — including `metacache` inverting past 64  |
| **Correctness**       | Sequential vs parallel PHYLIP values, compared at the level of raw IEEE-754 bits               |

Everything is client-side and deterministic: no backend, no runtime API calls, no
randomness. The measured scalability numbers are transcribed from the thesis and never
recomputed in the browser.

**How it works** is the landing module and the one to open first: it walks a whole
execution of each branch, one call at a time, showing what every rank is doing, which
messages travel and why the design is what it is. It models no timing at all — the
partition, the owners, the pair assignment and the remote-need matrix are computed with
the same formulas as the C++, and the seconds stay in the scalability module.

> **It is a teaching instrument, not the C++ tool.** The deliberate simplifications — a
> 4×4 substitution table standing in for BLOSUM62, a scripted MPI timeline, synthetic
> per-pattern distances — are listed in
> [`research.md` §A.3](./specs/001-protspam-hpc-simulator/research.md). The UI says so too.

---

## Architecture

**Astro 5, static output, one React island.** The document shell, fonts, SEO tags and the
theme/language boot script are server-rendered at build time. The suite hydrates as a
single island, because the active module, the language and the theme are shared client
state; the payload win comes from `React.lazy` per module instead — Chart.js ships only
with the two modules that use it, jsPDF only when someone downloads the factsheet.

```
src/
├── pages/index.astro · 404.astro     the routes
├── layouts/BaseLayout.astro          head, fonts, SEO, pre-paint theme/lang boot
├── islands/AppShell.tsx              hydration entry point
├── App.tsx                           shell, navigation, lazy module switch
├── components/                       the eight modules
├── context/                          i18n dictionary + theme (prerender-safe)
├── data/speciesData.ts               datasets, partitioner, measured series
└── utils/generatePdf.ts              in-browser PDF (dynamically imported)
```

---

## Running it

Requires **Node.js 20+**.

```bash
npm install
npm run dev           # http://localhost:3000
npm run build         # static site into dist/
npm test              # Playwright smoke suite against the build
npm run lint          # astro check
npm run status:site   # is production up?
```

**Deployment.** Every push to `main` and every pull request runs type-check → build →
browser smoke suite; pushes to `main` then publish to **GitHub Pages**. A deploy that does
not answer 200 with prerendered markup fails the run. No secrets are needed — Pages
authenticates through the workflow's OIDC token — but _Settings → Pages → Source_ must be
set to **GitHub Actions**. Set the `SITE_URL` repository variable to
`https://ana-izaguirre.github.io/prot-spam-sim/` to emit canonical and `og:url` tags.

Pages serves a project site from `/<repo>/`, so the production build sets `BASE_PATH`
accordingly; pull-request builds stay at the root. Pages hosts one site per repository, so
there are no per-pull-request previews and no custom cache or security headers.

**Contributing.** One change per pull request, green on its own, branch prefixed with its
change type — the rules are in the
[constitution](./.specify/memory/constitution.md), and
[`quickstart.md`](./specs/001-protspam-hpc-simulator/quickstart.md) has the verification
scenarios.

---

## License

[MIT](./LICENSE) © Ana Izaguirre Matamoros. The Prot-SpaM algorithm and its C++
implementation are covered by their own repository's terms.
