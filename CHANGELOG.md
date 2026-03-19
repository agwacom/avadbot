# Changelog

All notable changes to avadbot will be documented in this file.

## [2.2.0] - 2026-03-19

### Added
- **avad-qa: Phase 8e.5 Regression Test Generation** — after fixing and verifying a bug, auto-generates a regression test matching the project's existing patterns. Traces the bug's codepath, tests the precondition, uses auto-incrementing filenames.
- **avad-qa: QA report template** — new sections: Fixes Applied (with before/after evidence), Regression Tests (with deferred test specs), Ship Readiness (health score delta summary).
- **avad-review: Scope Drift Detection (Step 2.5)** — checks TODOS.md + commit messages for stated intent vs actual diff. Flags scope creep and missing requirements.
- **avad-review: Enum & Value Completeness** — Pass 1 CRITICAL now reads outside the diff when new enum/status/tier values are introduced.
- **avad-review: Design Review Lite (Step 5.5)** — 20-item design checklist activated when frontend files change. Catches AI slop patterns, typography issues, accessibility gaps.
- **avad-review: design-checklist.md** — 132-line checklist with AI slop detection, typography, spacing, interaction states, and DESIGN.md violation checks.

### Changed
- **avad-qa: WebSearch in allowed-tools** — enables test framework research.
- **avad-qa: Rule 13 updated** — allows creating new test files for regression tests (previously blocked all test modifications).
- **avad-review: Fix-First Heuristic (Step 6)** — reworked from passive listing to active fixing. Findings classified as AUTO-FIX (mechanical) or ASK (judgment). Auto-fixes applied directly, ASK items batched.

## [2.1.0] - 2026-03-19

### Fixed
- **browse: async wrapping in js/eval** — `$B js "await fetch(...)"` no longer throws SyntaxError. Three new helpers (`hasAwait`, `needsBlockWrapper`, `wrapForEvaluate`) auto-wrap `await` expressions in async IIFEs.
- **browse: option auto-routing in click** — clicking `<option>` elements now auto-routes to `selectOption()` instead of timing out for 30 seconds. Enhanced error message guides users to use `select` command when auto-routing can't apply.

### Changed
- **browse: chain command DRY** — `meta-commands.ts` now imports `READ_COMMANDS`, `WRITE_COMMANDS`, `META_COMMANDS` from `commands.ts` instead of maintaining duplicate local sets.

### Added
- **browse: `getRefRole()` on BrowserManager** — exposes ARIA role for ref selectors, used by option auto-routing.
- **Upgrade tracking** — `backup/old-2026-03-19-0505/` (pre-upgrade file copies) and `upgrade/upgrade-checklist-2026-03-19.md` for session continuity.

## [2.0.2] - 2026-03-19

### Changed
- **All 7 skills now use SKILL.md.tmpl** — converted avad-review, avad-ship, avad-retro, avad-plan-ceo-review, avad-plan-eng-review to template workflow. `{{VERSION}}` placeholder auto-syncs version from package.json across all skills.

### Added
- **gstack v0.7.0 sync report** — 48 items classified (17 direct ports, 19 adaptations, 7 skips, 2 conflicts). Report at `sync/sync-2026-03-19-0505.md`.
- **Plan doc** for merging avad-plan-ceo-review + avad-plan-eng-review into unified avad-plan-review

## [2.0.1] - 2026-03-18

### Fixed
- Synced `plugin.json` version to 2.0.1
- Fixed plugin namespace references in dev-skill.ts validation

### Changed
- Regenerated SKILL.md files with updated browse discovery cascade

## [2.0.0] - 2026-03-18

### Breaking
- Converted from skill suite to Claude Code Plugin
- Skills now under `skills/` directory (was root level)
- Browse binary discovery adds project-local and marketplace fallback paths

### Added
- `.claude-plugin/plugin.json` manifest
- Plugin auto-discovery (no manual setup required)
- Marketplace install path in browse discovery cascade
- Pre-migration count assertions in setup scripts
- plugin.json validation in test suite

### Changed
- `setup` script updated for `skills/` directory structure
- `bin/dev-setup` symlink paths updated
- `conductor.json` simplified to `bun install && bun run build`
- Glob patterns extracted to named variables across all scripts

## [1.1.8] - 2026-03-17

### Changed
- **avad-ship:** elevated post-sync empty-diff check to dedicated Step 2.5 hard gate — prevents shipping on dead branches that passed Step 1 pre-flight
- **avad-ship:** refactored pre-flight uncommitted changes options — separated "Delete and discard" as its own choice, added "Show me the changes" option

## [1.1.7] - 2026-03-17

### Changed
- **avad-ship:** uncommitted changes pre-flight now auto-recommends an option (stage/stash/delete) based on file relevance to the branch's work instead of presenting neutral choices.

## [1.1.6] - 2026-03-17

### Fixed
- **avad-ship:** detect already-merged branches — pre-flight checks if branch was deleted from remote with empty diff; post-rebase check catches commits dropped as already-upstream. Prevents offering invalid "ship as-is" option on dead branches.

## [1.1.5] - 2026-03-17

### Changed
- **avad-plan-eng-review:** added documentation completeness check to Step 0 scope challenge — plans must include a documentation section listing cross-reference updates

## [1.1.4] - 2026-03-17

### Changed
- **Merged `setup-browser-cookies` into `browse`** — cookie import now available via `$B cookie-import-browser`, documented in browse's new Cookie Import Workflow section. No functionality removed.
- **Setup prune logic** — `./setup` now marks installed skills with `.avadbot-managed` and auto-removes skills that were previously installed by avadbot but no longer exist in source. Third-party skills are left untouched.

## [1.1.3] - 2026-03-16

### Added
- **`/avad-qa` report-only mode** — merged `/avad-qa-report` into `/avad-qa`. Report-only mode now built in via AskUserQuestion gate after Phase 6, or `--report-only` flag.
- **Setup excludes `.tmpl` files** — `./setup` no longer copies template files to `~/.claude/skills/`. End users only get the generated `SKILL.md`.

### Changed
- **TODOS.md cross-skill awareness** — 5 skills now read `TODOS.md` for project context: `avad-review` (Step 4.75), `avad-ship` (Step 5.5 auto-update), `avad-retro` (Backlog Health metric), `avad-plan-ceo-review` (system audit), `avad-plan-eng-review` (Step 0).
- **Test Plan Artifact flow** — `avad-plan-eng-review` now generates test plan files to `~/.avadbot/projects/` for downstream `/avad-qa` consumption. Added `Write` to allowed-tools.
- **`TODOS-format.md`** — canonical TODO item format reference, shared by `avad-ship` and `avad-plan-ceo-review`.
- **`avad-retro` Backlog Health** — new metric row showing open TODO counts, P0/P1 items, and completed items per period.

### Fixed
- **`TODOS.md` naming** — renamed `TODO.md` → `TODOS.md` to fix broken references in `avad-plan-ceo-review` and `avad-plan-eng-review`.
- **Dead ref in avad-plan-ceo-review** — referenced nonexistent `TODOS-format.md`, now resolved by creating the file.
