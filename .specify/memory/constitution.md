# ProtSpam HPC Suite Constitution

**Version**: 1.1.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-23

This constitution states the non-negotiable principles that govern the ProtSpam HPC
Suite & Simulator. It was derived by reverse-engineering the existing Vite prototype
(`src/`), so every principle below is already observable in the shipped code unless
explicitly marked as an aspiration.

## Core Principles

### I. Didactic Fidelity Over Computational Fidelity

The application is a **teaching instrument**, not a re-implementation of the Prot-SpaM
C++ tool. Every module simulates the *shape* of the real algorithm (spaced-word
extraction, lexicographic indexing, gap-free extension, triangular partitioning,
point-to-point communication) at a scale a human can follow step by step.

Rules:
- Simulated results MUST be reproducible and deterministic; no randomness at runtime.
- Where a simplification is made (reduced substitution matrix, synthetic distance
  formula, fixed 12-step communication timeline), it MUST be documented in
  `research.md` and SHOULD be surfaced to the user in the UI copy.
- Numbers presented as *experimental results* MUST come from the thesis measurement
  set stored in `src/data/speciesData.ts` and MUST NOT be recomputed or interpolated
  in the browser.

### II. Full Bilingual Parity (ES / EN)

Spanish and English are first-class, equally complete languages.

Rules:
- Every user-visible string MUST resolve through the `t(key)` dictionary in
  `LanguageThemeContext`, or through an inline `lang === 'es' ? … : …` ternary.
- A key added to one language MUST be added to the other in the same change.
- The selected language MUST persist across reloads (`localStorage: protspam_lang`).
- Language switching MUST NOT lose the user's position in the app beyond documented
  re-computation (the step simulator intentionally regenerates its narrated steps).

### III. Client-Only, Zero-Backend Deployment

The suite is a static single-page application. It has no server, no database, no
authentication, and performs no network requests at runtime.

Rules:
- No runtime `fetch`/XHR to application APIs. All datasets are compiled into the bundle.
- Artifacts the user takes away (the TFM PDF factsheet) MUST be generated in-browser.
- The only permitted external network dependency is the Google Fonts stylesheet in
  `index.html`.

### IV. Academic Traceability

The suite exists to communicate a specific Master's thesis. Every claim is attributable.

Rules:
- Performance figures, branch names, hardware descriptions, and speedup ratios MUST
  match the thesis and the public repository `ana-izaguirre/ProtSpaM`.
- Each of the six Git branches described in the UI MUST link to its real branch URL.
- Author, advisor, degree, institution and supercomputer metadata MUST be identical
  across the header banner, the documentation modal, and the generated PDF.

### V. Deterministic, Inspectable State

A user must always be able to answer "why does the screen show this?".

Rules:
- Simulation state MUST be derived from explicit, enumerable step arrays or from pure
  functions of the control inputs — never from wall-clock time or accumulated drift.
- Every animation MUST be steppable manually (previous/next) in addition to autoplay.
- Long-running visualizations MUST expose a reset that returns to a known step 0.

### VI. One Pull Request Per Change

A pull request carries exactly one change: one defect fixed, one capability added,
one refactor performed. A branch that fixes two unrelated defects is two branches.

Rules:
- The PR title states the single change. If it needs "and", it is two PRs.
- Where changes are inherently sequential, they are **stacked**: each PR targets the
  previous one and they merge in order, rather than being collapsed into one diff.
- Every PR MUST leave the repository green on its own: `npm run lint`, `npm run build`
  and `npm test` all pass at that commit. A PR that only works once a later one lands
  is not independently reviewable and must be restructured.
- The branch name carries the change type as its prefix — `feat/`, `fix/`, `perf/`,
  `docs/`, `chore/`, `ci/`, `test/`, `refactor/` — matching the type of its commit.
- The PR body states what changed, why, and how it was verified. "How it was verified"
  is not optional: an unverified claim in a PR body is worse than no claim.

### VII. Check the Deployment Before Starting Work

Before beginning any task, confirm the production site is up and note its state. Work
started against an already-broken deployment produces changes whose effect cannot be
attributed.

Rules:
- Run `npm run status:site` (or open the Netlify badge) before the first change of a
  session, and record the result in the first message about that work.
- If production is down, restoring it takes precedence over whatever the task was.
- After a deploy, the pipeline itself re-checks availability — a deploy that is not
  verified to serve is not a deploy (`.github/workflows/ci.yml`).
- The same applies before claiming a task complete: the site that was up at the start
  must still be up at the end.

## Quality Constraints

- **Type safety**: TypeScript strict-enough compilation via `npm run lint`
  (`tsc --noEmit`) MUST pass before any commit.
- **Responsiveness**: every module MUST remain usable from 360 px to 2560 px. Wide
  content (matrices, log tables, charts) scrolls inside its own container; the page
  body never scrolls horizontally.
- **Theming**: both dark (default) and light themes MUST be legible. Dark is the
  designed baseline; light is delivered by the `html.light-theme` override layer.
- **Dependency hygiene**: a dependency that is not imported by `src/` is a defect.

## Governance

- This constitution supersedes ad-hoc conventions. A change that violates a principle
  requires an explicit amendment here, with a version bump, before merge.
- Amendments follow semantic versioning: MAJOR for removing/redefining a principle,
  MINOR for adding a principle or section, PATCH for clarifications.
- `plan.md` of every feature MUST include a Constitution Check section that names any
  deviation and its justification.
