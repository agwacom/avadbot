# Changelog

All notable changes to avadbot will be documented in this file.

## [1.1.5] - 2026-03-17

### Changed
- **avad-plan-eng-review:** added documentation completeness check to Step 0 scope challenge — plans must include a documentation section listing cross-reference updates

## [1.1.4] - 2026-03-17

### Changed
- **Merged `setup-browser-cookies` into `browse`** — cookie import now available via `$B cookie-import-browser`, documented in browse's new Cookie Import Workflow section. No functionality removed.
- **Setup prune logic** — `./setup` now marks installed skills with `.avadbot-managed` and auto-removes skills that were previously installed by avadbot but no longer exist in source. Third-party skills are left untouched.

## 2026-03-16

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
