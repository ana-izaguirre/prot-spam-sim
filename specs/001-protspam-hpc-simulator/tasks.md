# Tasks: Vite → Astro Migration

**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md)

Each task is one pull request. Every task must leave the repository green:
`npm run lint` and `npm run build` both succeed before the commit is made.

Tasks are **stacked**: T002 branches from T001, T003 from T002, and so on, because the
migration is inherently sequential. Merge them in order.

Legend — `[X]` done · `[ ]` pending · `[P]` parallelisable with its neighbour.

---

## Phase 1 — Specification

- [x] **T001** — Spec Kit specification set
      **Branch**: `claude/astro-t001-spec-kit-docs` → base `main`
      **Files**: `.specify/memory/constitution.md`, `specs/001-protspam-hpc-simulator/*`
      Reverse-engineer the prototype into a constitution, a feature spec, this task list, the
      research log, the data model and the component contracts. Documentation only — no
      source file is touched.
      **Verify**: every module, entity and static dataset in `src/` appears in the docs.

## Phase 2 — Toolchain switch

- [x] **T002** — Astro toolchain, layout and single route
      **Branch**: `claude/astro-t002-astro-toolchain` → base `claude/astro-t001-spec-kit-docs`
      **Files**: `astro.config.mjs` (new), `src/layouts/BaseLayout.astro` (new),
      `src/pages/index.astro` (new), `src/islands/AppShell.tsx` (new), `package.json`,
      `tsconfig.json`, `.gitignore`; delete `index.html`, `src/main.tsx`, `vite.config.ts`.
      Add `astro`, `@astrojs/react`, `@astrojs/check`; keep Tailwind 4 through
      `@tailwindcss/vite` in `astro.config.mjs`. The app mounts as a single React island.
      This task cannot be split further without leaving the tree unbuildable.
      **Verify**: `npm run build` produces `dist/index.html`; all seven modules render in
      `npm run preview`.

## Phase 3 — Astro-native improvements

- [x] **T003** — Prerender-safe state and flash-free theme boot
      **Branch**: `claude/astro-t003-ssr-safe-state` → base `claude/astro-t002-astro-toolchain`
      **Files**: `src/context/LanguageThemeContext.tsx`, `src/layouts/BaseLayout.astro`,
      `src/pages/index.astro`.
      Stop reading `localStorage` during the first render; reconcile inside an effect. Add the
      inline `<head>` bootstrap that applies the stored theme and language before first paint.
      Promote the island from `client:only` to `client:load` so the page is prerendered.
      **Verify**: `dist/index.html` contains real module markup, not an empty root; reloading
      in light mode shows no dark flash.

- [x] **T004** — Per-module code splitting
      **Branch**: `claude/astro-t004-code-splitting` → base `claude/astro-t003-ssr-safe-state`
      **Files**: `src/islands/AppShell.tsx` (or `src/App.tsx`).
      Load the six non-default modules through `React.lazy` behind a shared `Suspense`
      fallback; keep the landing module eagerly imported.
      **Verify**: the build emits one chunk per module; the initial chunk shrinks measurably
      against the 959 kB Vite baseline.

- [x] **T005** — Static head, SEO metadata and 404 page
      **Branch**: `claude/astro-t005-static-head-seo` → base `claude/astro-t004-code-splitting`
      **Files**: `src/layouts/BaseLayout.astro`, `src/pages/index.astro`,
      `src/pages/404.astro` (new), `public/` (new).
      Typed layout props for title/description, Open Graph and Twitter cards, canonical link,
      favicon, `robots.txt`, and a static not-found page that matches the suite's visual
      language.
      **Verify**: `dist/404.html` and `dist/robots.txt` exist; head tags are present in the
      prerendered HTML.

## Phase 4 — Hygiene and documentation

- [x] **T006** — Dependency and configuration cleanup
      **Branch**: `claude/astro-t006-dependency-cleanup` → base `claude/astro-t005-static-head-seo`
      **Files**: `package.json`, `package-lock.json`, `.env.example`, `metadata.json`.
      Remove the dependencies no `src/` file imports: `@google/genai`, `express`, `dotenv`,
      `motion`, `esbuild`, `tsx`, `autoprefixer`, `@types/express`, `@vitejs/plugin-react`.
      Drop the AI-Studio-specific environment scaffolding that no longer applies.
      **Verify**: `npm ci && npm run lint && npm run build` succeed from a clean install.

- [x] **T007** — Bilingual README set
      **Branch**: `claude/astro-t007-bilingual-readme` → base `claude/astro-t006-dependency-cleanup`
      **Files**: `README.md` (English, default), `README.es.md` (Spanish).
      Document the thesis context, the seven modules, the new Astro architecture, the data
      model, the commands and the deployment story. Each README links to the other at the top.
      **Verify**: both files describe the same content; every command listed actually runs.

---

## Deferred — behavioural gaps found during analysis

These are **not** part of the migration. They are real defects in the prototype, recorded
here so the migration diff stays reviewable.

- [x] **D001** — The base simulator's dropoff parameter `X` is stored in state and read
      into `paramD`, but never bounds the extension, and no input control renders it. Either
      implement X-drop termination or remove the parameter (`spec.md` FR-018).
      _Fixed in `feat/t015-xdrop-extension`: X-drop termination implemented, the input
      control rendered, and the accept/reject decision now uses the trimmed HSP score._
- [x] **D002** — The light theme is implemented as an override stylesheet keyed on specific
      Tailwind class names; any utility not listed keeps its dark value. Move to CSS custom
      properties or a `dark:` variant strategy.
      _Fixed in `refactor/t019-light-theme-tokens`: the theme is now a remap of Tailwind 4's
      colour variables, so every utility follows automatically, including ones written later.
      Chart.js paints to a canvas and cannot inherit CSS, so its ink is derived from the active
      theme in both chart modules._
- [x] **D003** — `navigator.clipboard.writeText` in the workload log has no rejection
      handler; a denied clipboard permission silently shows a false success toast.
      _Fixed in `fix/t013-clipboard-failure`: the promise is handled, and the button now has
      a third state that reports the failure instead of claiming success._
- [x] **D004** — `generatePdf` localises its body but not its title line, which is
      hard-coded in Spanish.
      _Fixed in `fix/t014-pdf-title-language`: the title, degree line, supercomputer label
      and page footer follow `lang`. Verified by extracting the text of both PDFs._
- [x] **D005** — The triangular matrix inspector shows a positional placeholder value
      (`0.125 + (i + j) × 0.015`) labelled "estimated distance"; it should be labelled as
      illustrative or derived from the sample PHYLIP data.
      _Fixed in `fix/t011-illustrative-distance-label`: relabelled as an illustrative value,
      with a note pointing at the Correctness module for the real ones. The cost proxy no
      longer calls itself "BLOSUM62 complexity"._
- [x] **D006** — `BLOSUM62` in the step simulator is a 4×4 nucleotide-alphabet stand-in for
      a 20×20 amino-acid matrix. Acceptable didactically, but it should be named honestly in
      the UI.
      _Fixed in `fix/t012-didactic-matrix-naming`: the constant is now
      `DEMO_SUBSTITUTION_MATRIX`, the phase labels and narration no longer claim BLOSUM62,
      and a note next to the scores says what the table is and what the real tool uses._

---

## Phase 5 — Delivery

- [x] **T008** — Continuous integration and Netlify deployment
      **Branch**: `ci/t008-github-actions-netlify` → base `docs/t007-bilingual-readme`
      **Files**: `.github/workflows/ci.yml` (new), `netlify.toml` (new), `astro.config.mjs`,
      `README.md`, `README.es.md`.
      A `check` job (`npm ci`, `astro check`, `astro build`, plus a guard on the emitted
      files and on the prerendered HTML being non-empty) and a `deploy` job that pushes the
      built directory to Netlify — production on `main`, an aliased preview on pull requests.
      Astro's `site` now comes from the `SITE_URL` environment variable so canonical and
      `og:url` tags are emitted in CI without hard-coding an origin in the repository.
      **Verify**: workflow YAML parses; the guard step passes locally; a build with
      `SITE_URL` set emits canonical and `og:url`, and omits both without it.

- [x] **T022** — Move the deployment from Netlify to GitHub Pages
      **Branch**: `ci/t022-github-pages-deploy` → base `main`
      **Files**: `.github/workflows/ci.yml`, `astro.config.mjs`,
      `src/layouts/BaseLayout.astro`, `src/pages/404.astro`, `playwright.config.ts`,
      `tests/smoke.spec.ts`, `scripts/check-deployment.sh`, `public/.nojekyll` (new),
      `README.md`, `README.es.md`; delete `netlify.toml`.
      Netlify credits ran out. The deploy job is replaced by `upload-pages-artifact` +
      `deploy-pages`, authenticated by the workflow's OIDC token rather than secrets.
      Pages serves a project site from `/<repo>/`, so production builds set `BASE_PATH`
      and the two hard-coded root-relative URLs move to `import.meta.env.BASE_URL`; the
      Playwright config and suite follow the same variable so the smoke suite exercises the
      real production path.
      **Trade-offs accepted**: one site per repository, so no per-pull-request previews, and
      Pages serves no custom cache or security headers (`netlify.toml` is gone).
      **Verify**: build with and without `BASE_PATH` emits correctly prefixed asset, favicon
      and 404 URLs; the smoke suite passes in both configurations.

- [x] **T023** — Add a license
      **Branch**: `docs/t023-license` → base `ci/t022-github-pages-deploy`
      **Files**: `LICENSE` (new), `README.md`, `README.es.md`.
      Without a license the repository is "all rights reserved" by default: nobody may legally
      copy, reuse or redistribute it, which is the wrong default for public academic work. MIT
      is chosen as the permissive default — **confirm this is what the author and the
      university want**; replacing the file is the only change needed.
      **Verify**: `LICENSE` present at the repository root so GitHub detects and displays it.

- [x] **T024** — Adopt Prettier and ESLint
      **Branch**: `chore/t024-prettier-eslint` → base `docs/t023-license`
      **Files**: `.prettierrc.json`, `.prettierignore`, `eslint.config.js` (all new),
      `package.json`, `.github/workflows/ci.yml`, and the mechanical reformat.
      `astro check` validates types, not style or correctness patterns, so neither was
      enforced. Prettier owns formatting; ESLint stays close to the recommended sets and
      catches real mistakes rather than style. Both run in CI before the type-check.
      The rollout removed 24 dead icon imports, two useless initialisers, `var` in the
      layout's boot script and an unused catch binding.
      **Deliberately left as warnings**: `no-explicit-any` (20, in the step simulator's frame
      structures), `exhaustive-deps` (5) and `set-state-in-effect` (3, the documented
      prerender-safe reconciliation). Errors are at zero, so CI can gate on them.
      **Verify**: `npm run format:check`, `npm run lint:js`, `npm run lint`, `npm run build`
      and `npm test` all pass.

- [x] **T025** — Pin the editor and Node conventions
      **Branch**: `chore/t025-editor-and-node-version` → base `chore/t024-prettier-eslint`
      **Files**: `.editorconfig`, `.nvmrc` (both new).
      `.editorconfig` settles indentation, line endings and final newlines at the editor rather
      than at the formatter, so a contributor's first save does not fight Prettier. `.nvmrc`
      pins Node 20, matching `engines.node` and the version CI runs, so `nvm use` reproduces
      the pipeline locally.
      **Verify**: values agree with `.prettierrc.json`, `package.json` engines and the
      workflow's `node-version`.
