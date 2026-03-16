# Changelog

All notable changes to avadbot will be documented in this file.

## 2026-03-16

### Added
- **`/avad-qa-report`** — report-only QA testing. Same methodology as `/avad-qa` but never fixes anything. Use for "just report bugs" or handing off to another team. Ported from gstack `qa-only` (v0.4.0).
- **Setup excludes `.tmpl` files** — `./setup` no longer copies template files to `~/.claude/skills/`. End users only get the generated `SKILL.md`.

### Fixed
- **`TODOS.md` naming** — renamed `TODO.md` → `TODOS.md` to match upstream gstack and fix broken references in `avad-plan-ceo-review` and `avad-plan-eng-review`.
