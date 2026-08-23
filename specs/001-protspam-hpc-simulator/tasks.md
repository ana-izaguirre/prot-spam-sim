- [x] **T027** — Add a pull request template
      **Branch**: `docs/t027-pull-request-template` → base `chore/t026-dependabot`
      **Files**: `.github/pull_request_template.md` (new).
      The one-change-per-PR rule and the verification requirement live in the constitution,
      where they are read once. The template puts them in front of the author at the moment
      they open the PR, with the verification commands as a checklist.
      **Verify**: appears prefilled when opening a pull request.

---

## Still open

- [ ] **Branch protection on `main`** — configured in GitHub, not in the repository:
      require the CI checks to pass before merging. Without it, a direct push to `main`
      bypasses the whole pipeline. This is the one remaining gap that no file can close.
