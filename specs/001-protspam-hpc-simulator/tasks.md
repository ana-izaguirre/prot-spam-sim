- [x] **T026** — Enable Dependabot
      **Branch**: `chore/t026-dependabot` → base `chore/t025-editor-and-node-version`
      **Files**: `.github/dependabot.yml` (new).
      Weekly npm updates with minor and patch grouped into one pull request and majors kept
      separate, plus monthly GitHub Actions updates. Every update goes through the same
      pipeline as any other change — type-check, lint, build, smoke suite — so a bump that
      breaks the site cannot merge.
      **Verify**: configuration parses; GitHub reports it under _Insights → Dependency graph →
      Dependabot_ once merged.
