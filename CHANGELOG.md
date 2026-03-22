# Changelog

All notable changes to avadbot will be documented in this file.

## [2.8.0] - 2026-03-22

### Added
- **avad-review:** `Agent` + `WebSearch` in allowed-tools, search-before-recommending rule, proactive trigger description
- **avad-ship:** `Agent` in allowed-tools
- **avad-plan-ceo-review:** `WebSearch` in allowed-tools, Landscape Check section, proactive trigger description
- **avad-plan-eng-review:** `WebSearch` in allowed-tools, Step 0 search check, proactive trigger description, layer annotations
- **avad-browse:** `handoff`/`resume` commands, `BrowserState` interface, URL validation in `newTab()`, headed-mode close timeout, `buildContextOptions()` DRY helper

### Changed
- **avad-browse:** removed dead failure-tracking code, typed `contextOptions` as `BrowserContextOptions` (was `any`)

### Fixed
- **avad-retro:** midnight-aligned date windows, removed hardcoded Pacific timezone
- **avad-plan-ceo-review:** TODOS.md grep no longer scans node_modules/vendor/.git

## [2.7.0] - 2026-03-20

### Added
- **avad-careful** — new skill: PreToolUse hook that intercepts destructive Bash commands (rm -rf, DROP TABLE, TRUNCATE, git push --force, git reset --hard, kubectl delete, docker rm -f) and asks before running. Safe exceptions for build artifacts (node_modules, dist, .next, etc.)
- **avad-freeze** — new skill: directory-scoped edit restrictions. PreToolUse hooks on Edit and Write block changes outside the locked directory. State stored in `~/.avadbot/freeze-dir.txt`.
- **avad-unfreeze** — new skill: clears the active freeze boundary set by /avad-freeze
- **avad-guard** — new skill: combined careful + freeze in one command. PreToolUse hooks delegate to avad-careful (Bash) and avad-freeze (Edit/Write) bin scripts
- **avad-design-consultation** — new skill: design system creation workflow. Researches the product space, proposes aesthetic/typography/color system, generates a font & color preview page, writes DESIGN.md. 6-phase workflow.
- **avad-design-review** — new skill: visual QA + fix loop. Finds spacing issues, AI slop patterns, interaction problems. Fix loop with risk calculator. Produces before/after screenshots and TODOS.md updates.
- **avad-plan-design-review** — new skill: designer's eye plan review. Rates 8 design dimensions 0-10, produces a fix plan, logs to review readiness dashboard.
- **avad-debug:** Scope Lock section + PreToolUse hooks (Edit, Write → avad-freeze boundary check). Run /avad-freeze before debugging to restrict changes to the bug's directory.
- **avad-review/checklist-seed.md:** Enum & Value Completeness category added to Pass 1 Critical seed categories
- **avad-review/bot-triage-templates.md:** vendor-neutral bot reply templates (Greptile, CodeRabbit, SonarCloud). Covers escalation detection, Tier 1/2 reply templates, severity re-ranking.
- **gen-skill-docs:** 4 new template placeholders — `{{TEST_BOOTSTRAP}}`, `{{DESIGN_METHODOLOGY}}`, `{{BASE_BRANCH_DETECT}}`, `{{REVIEW_DASHBOARD}}`. All use `~/.avadbot/` namespace (not `~/.gstack/`). REVIEW_DASHBOARD reads JSONL directly (no gstack-review-read binary).

### Changed
- **avad-debug:** added hooks frontmatter (PreToolUse Edit/Write → avad-freeze boundary check) and Scope Lock section between Phase 1 and Phase 2

## [2.6.0] - 2026-03-20

### Added
- **avad-browse:** `url-validation.ts` — blocks SSRF via cloud metadata endpoints (169.254.169.254, metadata.google.internal, fd00::). Catches bypass variants: hex, decimal, octal, IPv6. 16 new tests. (ported from gstack v0.9.1.0)
- **avad-review:** Step 5.6 — Documentation staleness check. Flags INFORMATIONAL when .md docs describe code changed in the diff but were not updated in the same branch. Fix action: `/avadbot:avad-document-release`. (ported from gstack v0.9.x)
- **avad-plan-eng-review:** Lake Score metric in Completion Summary — tracks X/Y ratio of recommendations that chose the complete option over shortcuts. (ported from gstack v0.9.x)

## [2.5.1] - 2026-03-20

### Changed
- **Renamed:** `browse` → `avad-browse` — naming consistency with all other skills

### Fixed
- Pre-landing review: 20+ stale `browse/` paths in BROWSER.md, stale path in ARCHITECTURE.md, version mismatch in setup comment, `.gitignore` pattern, stale TODO comment, removed dead 60MB binary
- `find-browse.ts`: added missing `--plugin-dir` subdirectory tier and fixed tier ordering to match `$B` cascade (local before global)

### Added
- **Execution plan:** `browse` → `avad-browse` rename — detailed plan with eng review, covering 24 files, discovery cascade (7 primary + 5 legacy tiers), test updates, and full documentation cross-references
- **Skill rename checklist:** `doc/skilltools/skill-rename-checklist.md` — 18-item checklist derived from the browse rename lessons
- **Skill quality checklist restructured:** split into general vs avadbot-specific sections, added plugin manifest sync, package.json paths, and `.gitignore` alignment checks

## [2.5.0] - 2026-03-19

### Added
- **avad-debug** — new skill: systematic root-cause debugger with Iron Law, 4-phase workflow (investigate → analyze → hypothesize → implement), pattern analysis, 3-strike escalation
- **avad-document-release** — new skill: post-ship doc updater with inline base branch detection, CHANGELOG voice polish, cross-doc consistency, VERSION bump questions
- **avad-help** — new skill: skill hub showing all available skills, context-aware routing, update check

## [2.4.0] - 2026-03-19

### Added
- **avad-plan-eng-review: Cognitive Patterns** — 15 engineering leadership instincts (Larson, McKinley, Brooks, Beck, Majors, Google SRE) internalized as review perspective
- **avad-plan-eng-review: Design Doc Check** — checks `~/.avadbot/projects/` for design docs before review, uses as source of truth
- **avad-plan-eng-review: Review Log** — appends structured JSON to `$BRANCH-reviews.jsonl` for ship gate integration
- **avad-retro: Test Health Tracking** — 3 new data gathering commands (test file count, regression test commits, test files changed), Test Health metric row, test_health JSON snapshot field, narrative section with trend delta

### Changed
- **avad-plan-eng-review: Always full review** — removed SMALL_CHANGE/BIG_CHANGE/SCOPE_REDUCTION menu; every plan gets full interactive walkthrough
- **avad-plan-eng-review: Completeness check** — new Step 0 item: recommend complete version over shortcuts when AI-assisted coding compresses implementation time

### Fixed
- **avad-plan-ceo-review, avad-plan-eng-review, avad-ship:** sanitize branch names with slashes (`tr '/' '-'`) in JSONL review persistence paths

## [2.3.0] - 2026-03-19

### Added
- **avad-plan-ceo-review: SELECTIVE EXPANSION mode** — fourth review mode: hold scope as baseline, cherry-pick individual expansions via AskUserQuestion with neutral recommendations
- **avad-plan-ceo-review: Cognitive Patterns** — 18 CEO thinking instincts (Bezos, Grove, Munger, Jobs, etc.) internalized as review perspective
- **avad-plan-ceo-review: Implementation Alternatives (0C-bis)** — mandatory 2-3 approach comparison before mode selection
- **avad-plan-ceo-review: CEO Plan Persistence (0D-POST)** — writes vision + scope decisions to `~/.avadbot/projects/<repo>/ceo-plans/` with archival for stale plans
- **avad-plan-ceo-review: Design & UX Review (Section 11)** — interaction state coverage map, AI slop risk, accessibility basics for plans with UI scope
- **avad-plan-ceo-review: Review Log** — appends structured JSON to `$BRANCH-reviews.jsonl` for ship gate integration
- **avad-plan-ceo-review: Design Doc Promotion** — option to promote CEO plan to `docs/designs/` in the repo
- **avad-ship: Review Readiness Dashboard** — reads `$BRANCH-reviews.jsonl` at pre-flight, shows review status table, gates on eng review (CEO/design optional)
- **avad-ship: Test Framework Bootstrap (Step 2.75)** — detects runtime + test framework, offers to bootstrap with best-practice setup including CI pipeline
- **avad-ship: Test Coverage Audit (Step 3.5)** — traces every changed codepath, diagrams coverage, auto-generates tests for gaps

### Changed
- **avad-plan-ceo-review: Expansion opt-in ceremony** — all scope expansions are now individual AskUserQuestion decisions (no silent additions)
- **avad-plan-ceo-review: "Completeness is cheap" principle** — always prefer full implementation over shortcuts when AI compresses implementation time
- **avad-ship: Fix-First Heuristic in pre-landing review** — findings classified as AUTO-FIX or ASK, auto-fixes applied without stopping
- **avad-ship: WebSearch added to allowed-tools** — enables test framework research in bootstrap step

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
