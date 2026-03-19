# avadbot

A generic, project-agnostic Claude Code skill suite. Works with any project, any language, any framework.

## Commands

```bash
bun install          # install dependencies
bun test             # run free tests (browse + snapshot + skill validation)
bun run test:evals   # run paid evals: LLM judge + E2E (~$4/run)
bun run test:e2e     # run E2E tests only (~$3.85/run)
bun run build        # gen docs + compile binaries
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run skill:check  # health dashboard for all skills
bun run dev:skill    # watch mode: auto-regen + validate on change
bun run eval:list    # list all eval runs from ~/.avadbot/evals/
bun run eval:compare # compare two eval runs (auto-picks most recent)
bun run eval:summary # aggregate stats across all eval runs
bun run eval:watch   # live E2E dashboard (use --tail for progress.log)
```

`test:evals` requires `ANTHROPIC_API_KEY`. E2E tests stream progress in real-time
(tool-by-tool via `--output-format stream-json --verbose`). Results are persisted
to `~/.avadbot/evals/` with auto-comparison against the previous run.

## Self-Maintenance

**This file must stay in sync with the actual repo structure.** When any change is made to this repository — adding, removing, renaming, or restructuring files and directories — update the Project Structure section and any affected instructions in this file before finishing the task.

## Project structure

```
avadbot/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest (v2.0.2)
│   └── marketplace.json         # Marketplace discovery manifest
├── CLAUDE.md                    # This file — project instructions
├── README.md                    # Documentation
├── CHANGELOG.md                 # Change log
├── CONTRIBUTING.md              # Dev workflow, testing, evals
├── LICENSE                      # MIT license
├── package.json                 # Build scripts
├── bun.lock                     # Lock file
├── conductor.json               # Conductor workspace hooks
├── setup                        # Install script — copies skills to ~/.claude/skills/
├── .env.example                 # API key template
├── bin/                         # Dev mode scripts
│   ├── dev-setup                # Activate dev mode (symlink skills)
│   └── dev-teardown             # Deactivate dev mode
├── skills/                      # All skills live here
│   ├── avad-ship/               # /avadbot:avad-ship — validate, review, push, PR
│   ├── avad-review/             # /avadbot:avad-review — pre-landing code review
│   ├── avad-plan-ceo-review/    # /avadbot:avad-plan-ceo-review — CEO plan review
│   ├── avad-plan-eng-review/    # /avadbot:avad-plan-eng-review — eng manager plan review
│   ├── avad-qa/                 # /avadbot:avad-qa — QA testing workflow
│   ├── avad-hello/              # /avadbot:avad-hello — test greeting skill
│   ├── avad-retro/              # /avadbot:avad-retro — weekly engineering retrospective
│   └── browse/                  # Headless browser CLI (Playwright)
│       ├── src/                 # CLI + server + commands
│       │   ├── commands.ts      # Command registry (single source of truth)
│       │   └── snapshot.ts      # SNAPSHOT_FLAGS metadata array
│       ├── test/                # Integration tests + fixtures
│       └── dist/                # Compiled binary
├── references/                  # Shared references (qa-methodology.md)
├── scripts/                     # Build + DX tooling
│   ├── gen-skill-docs.ts        # Template → SKILL.md generator
│   ├── skill-check.ts           # Health dashboard
│   ├── dev-skill.ts             # Watch mode
│   ├── eval-compare.ts          # Compare two eval runs
│   ├── eval-list.ts             # List eval runs
│   ├── eval-summary.ts          # Aggregate eval stats
│   └── eval-watch.ts            # Live E2E dashboard
└── test/                        # Skill validation + eval tests
    ├── helpers/                 # skill-parser.ts, session-runner.ts, llm-judge.ts, eval-store.ts
    ├── fixtures/                # Ground truth JSON, planted-bug fixtures, eval baselines
    ├── skill-validation.test.ts # Tier 1: static validation (free, <1s)
    ├── skill-parser.test.ts     # Tier 1: parser unit tests (free, <1s)
    ├── gen-skill-docs.test.ts   # Tier 1: generator quality (free, <1s)
    ├── skill-e2e.test.ts        # Tier 2: E2E via claude -p (~$3.85/run)
    └── skill-llm-eval.test.ts   # Tier 3: LLM-as-judge (~$0.15/run)
```

## SKILL.md workflow

SKILL.md files are **generated** from `.tmpl` templates. To update docs:

1. Edit the `.tmpl` file in `skills/<name>/` (e.g. `skills/avad-review/SKILL.md.tmpl` or `skills/browse/SKILL.md.tmpl`)
2. Run `bun run gen:skill-docs` (or `bun run build` which does it automatically)
3. Commit both the `.tmpl` and generated `.md` files

To add a new browse command: add it to `skills/browse/src/commands.ts` and rebuild.
To add a snapshot flag: add it to `SNAPSHOT_FLAGS` in `skills/browse/src/snapshot.ts` and rebuild.

## Skill development guidelines

### Skill file structure

Every skill must have at minimum a `SKILL.md` with valid frontmatter:

```yaml
---
name: skill-name
description: One-line description of what the skill does.
argument-hint: "optional usage hint"
---
```

### When editing skills

1. **Read the full skill first** — understand the existing structure before modifying.
2. **Preserve frontmatter** — `name`, `description`, and `argument-hint` must stay accurate.
3. **Keep supporting files consistent** — if a `SKILL.md` references `protocol.md` or `rules.md`, those files must exist and stay in sync.
4. **Test the skill** — after editing, verify the skill loads correctly: check that `/avadbot:skill-name` is recognized.
5. **After renaming a skill** — audit the entire SKILL.md content for stale references to the old name. Replace all occurrences.
6. **Sync after edit** — run `claude plugin update avadbot@avadbot-local` to refresh the plugin cache.

### When reviewing skills

Proactively flag:

- **Dead references** — `SKILL.md` links to files that don't exist.
- **Stale config** — model names, timeouts, or API references that may be outdated.
- **Redundant logic** — rules repeated across multiple files that could drift.
- **Missing error handling** — skills that don't handle tool unavailability or edge cases.
- **Overcomplexity** — badge systems, classification trees, or protocols that could be simplified without losing value.
- **Hardcoded values** — model names, paths, or URLs that should be configurable.

### When creating new skills

1. Create a skill directory under `skills/` with a `SKILL.md`.
2. Keep it focused — one skill, one responsibility.
3. Add supporting files only when the skill is complex enough to warrant separation.
4. Run `claude plugin update avadbot@avadbot-local` to refresh the plugin cache.

## Browser interaction

When you need to interact with a browser (QA, dogfooding, cookie setup), use the
`/avadbot:browse` skill or run the browse binary directly via `$B <command>`. NEVER use
`mcp__claude-in-chrome__*` tools — they are slow, unreliable, and not what this
project uses.

## Parallel sessions

Skills are stateless and designed for concurrent execution via Conductor.
Each workspace maintains its own browser process, cookies, and logs — sessions
do not share state. `/avadbot:browse`, `/avadbot:avad-qa`, `/avadbot:avad-review`, and `/avadbot:avad-ship`
can all run in parallel across separate workspaces without interference.

## Development modes

### Plugin mode (default — installed via marketplace)

Skills are namespaced as `/avadbot:avad-review`. Requires session restart after any SKILL.md changes — there is no `/reload-plugins` command.

```bash
claude plugin update avadbot@avadbot-local   # refresh plugin cache after changes
```

### Dev mode (for active development)

Uses `bin/dev-setup` to create symlinks in `~/.claude/skills/`. Skills update immediately without restarting the session. Invoke as `/avad-review` (no namespace prefix).

```bash
bin/dev-setup       # symlinks skills into ~/.claude/skills/ — changes are live
bin/dev-teardown    # removes symlinks, restores plugin mode
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Deploying changes

**Plugin mode (primary):** Run `claude plugin update avadbot@avadbot-local` then restart session.

**Legacy fallback:** `./setup` copies skills to `~/.claude/skills/` for non-plugin users.

## Runtime data

All per-project runtime data lives under `~/.avadbot/`:

```
~/.avadbot/
├── bot-review-history.md       # Global aggregate (all projects)
├── evals/                      # Eval run results
├── e2e-live.json               # E2E heartbeat
├── e2e-runs/                   # E2E run artifacts
└── projects/
    └── <repo>/
        ├── bot-review-history.md   # Per-project bot triage history
        └── review-checklist.md     # Auto-generated review checklist
```

## Reference

- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
