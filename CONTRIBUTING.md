# Contributing to avadbot

Whether you're fixing a typo in a skill prompt or building an entirely new workflow, this guide will get you up and running fast.

## Quick start

avadbot is a Claude Code Plugin. Skills live under `skills/` and are auto-discovered via `.claude-plugin/plugin.json`. There are two ways to develop:

### Dev mode (recommended for active development)

Symlinks skills into `.claude/skills/` so edits take effect instantly — no session restart needed. Skills are invoked without namespace prefix (e.g. `/avad-review`).

```bash
cd avadbot
bun install                    # install dependencies
bin/dev-setup                  # activate dev mode
```

Now edit any `SKILL.md`, invoke it in Claude Code (e.g. `/avad-review`), and see your changes live. When you're done developing:

```bash
bin/dev-teardown               # deactivate — back to your global install
```

### Plugin mode (for testing plugin structure)

Tests the plugin as end users will experience it. Skills are namespaced (e.g. `/avadbot:avad-review`). Requires session restart after SKILL.md changes — there is no `/reload-plugins` command.

```bash
claude --plugin-dir ./avadbot
```

## How dev mode works

`bin/dev-setup` creates a `.claude/skills/` directory inside the repo (gitignored) and fills it with symlinks pointing back to your working tree. Claude Code sees the local `skills/` first, so your edits win over the global install.

```
avadbot/                         <- your working tree
├── .claude/skills/              <- created by dev-setup (gitignored)
│   ├── avad-review -> ../../skills/avad-review
│   ├── avad-ship -> ../../skills/avad-ship
│   ├── browse -> ../../skills/browse
│   └── ...                      <- one symlink per skill
├── skills/
│   ├── avad-review/
│   │   └── SKILL.md             <- edit this, test with /avad-review
│   ├── avad-ship/
│   │   └── SKILL.md
│   ├── browse/
│   │   ├── src/                 <- TypeScript source
│   │   └── dist/                <- compiled binary (gitignored)
│   └── ...
└── ...
```

## Day-to-day workflow

```bash
# 1. Enter dev mode
bin/dev-setup

# 2. Edit a skill
vim skills/avad-review/SKILL.md

# 3. Test it in Claude Code — changes are live
#    > /avad-review

# 4. Editing browse source? Rebuild the binary
bun run build

# 5. Done for the day? Tear down
bin/dev-teardown
```

## Testing & evals

### Setup

```bash
# 1. Copy .env.example and add your API key
cp .env.example .env
# Edit .env → set ANTHROPIC_API_KEY=sk-ant-...

# 2. Install deps (if you haven't already)
bun install
```

Bun auto-loads `.env` — no extra config.

### Test tiers

| Tier | Command | Cost | What it tests |
|------|---------|------|---------------|
| 1 — Static | `bun test` | Free | Command validation, snapshot flags, SKILL.md correctness |
| 2 — E2E | `bun run test:e2e` | ~$3.85 | Full skill execution via `claude -p` subprocess |
| 3 — LLM eval | `bun run test:evals` | ~$4 | E2E + LLM-as-judge combined |

```bash
bun test                     # Tier 1 only (runs on every commit, <5s)
bun run test:e2e             # Tier 2: E2E (needs EVALS=1, can't run inside Claude Code)
bun run test:evals           # Tier 2 + 3 combined (~$4/run)
```

### Tier 1: Static validation (free)

Runs automatically with `bun test`. No API keys needed.

- **Skill parser tests** (`test/skill-parser.test.ts`) — Extracts every `$B` command from SKILL.md bash code blocks and validates against the command registry in `skills/browse/src/commands.ts`. Catches typos, removed commands, and invalid snapshot flags.
- **Skill validation tests** (`test/skill-validation.test.ts`) — Validates that SKILL.md files reference only real commands and flags, and that command descriptions meet quality thresholds.
- **Generator tests** (`test/gen-skill-docs.test.ts`) — Tests the template system: verifies placeholders resolve correctly, output includes value hints for flags, enriched descriptions for key commands.

### Tier 2: E2E via `claude -p` (~$3.85/run)

Spawns `claude -p` as a subprocess with `--output-format stream-json --verbose`, streams NDJSON for real-time progress, and scans for browse errors.

```bash
# Must run from a plain terminal — can't nest inside Claude Code
EVALS=1 bun test test/skill-e2e.test.ts
```

- Gated by `EVALS=1` env var (prevents accidental expensive runs)
- Auto-skips if running inside Claude Code (`claude -p` can't nest)
- API connectivity pre-check — fails fast on ConnectionRefused before burning budget
- Real-time progress to stderr: `[Ns] turn T tool #C: Name(...)`
- Saves full NDJSON transcripts and failure JSON for debugging

### E2E observability

When E2E tests run, they produce machine-readable artifacts in `~/.avadbot/`:

| Artifact | Path | Purpose |
|----------|------|---------|
| Heartbeat | `e2e-live.json` | Current test status (updated per tool call) |
| Partial results | `evals/_partial-e2e.json` | Completed tests (survives kills) |
| Progress log | `e2e-runs/{runId}/progress.log` | Append-only text log |
| NDJSON transcripts | `e2e-runs/{runId}/{test}.ndjson` | Raw `claude -p` output per test |
| Failure JSON | `e2e-runs/{runId}/{test}-failure.json` | Diagnostic data on failure |

**Live dashboard:** Run `bun run eval:watch` in a second terminal to see a live dashboard showing completed tests, the currently running test, and cost. Use `--tail` to also show the last 10 lines of progress.log.

**Eval history tools:**

```bash
bun run eval:list            # list all eval runs
bun run eval:compare         # compare two runs (auto-picks most recent)
bun run eval:summary         # aggregate stats across all runs
```

Artifacts accumulate in `~/.avadbot/` for post-mortem debugging and trend analysis.

### Tier 3: LLM-as-judge (~$0.15/run)

Uses Claude Sonnet to score generated SKILL.md docs on three dimensions:

- **Clarity** — Can an AI agent understand the instructions without ambiguity?
- **Completeness** — Are all commands, flags, and usage patterns documented?
- **Actionability** — Can the agent execute tasks using only the information in the doc?

Each dimension is scored 1-5. Threshold: every dimension must score **≥ 4**.

```bash
# Needs ANTHROPIC_API_KEY in .env — included in bun run test:evals
```

- Uses `claude-sonnet-4-6` for scoring stability
- Calls the Anthropic API directly (not `claude -p`), so it works from anywhere including inside Claude Code

## Editing SKILL.md files

SKILL.md files are **generated** from `.tmpl` templates. Don't edit the `.md` directly — your changes will be overwritten on the next build.

```bash
# 1. Edit the template
vim skills/avad-review/SKILL.md.tmpl     # or skills/browse/SKILL.md.tmpl

# 2. Regenerate
bun run gen:skill-docs

# 3. Check health
bun run skill:check

# Or use watch mode — auto-regenerates on save
bun run dev:skill
```

To add a browse command, add it to `skills/browse/src/commands.ts`. To add a snapshot flag, add it to `SNAPSHOT_FLAGS` in `skills/browse/src/snapshot.ts`. Then rebuild.

## Things to know

- **SKILL.md files are generated.** Edit the `.tmpl` template in `skills/<name>/`, not the `.md`. Run `bun run gen:skill-docs` to regenerate.
- **Browse source changes need a rebuild.** If you touch `skills/browse/src/*.ts`, run `bun run build`.
- **Dev mode shadows your global install.** Project-local skills take priority over `~/.claude/skills/`. `bin/dev-teardown` restores the global ones.
- **`.claude/skills/` is gitignored.** The symlinks never get committed.
- **No `/reload-plugins`.** Plugin discovery happens at session startup only. In dev mode this doesn't matter (symlinks are live). In plugin mode, restart the session after changes.

## Deploying skills

After editing, deploy to your global install:

```bash
./setup    # copies all skills to ~/.claude/skills/
```

## Shipping your changes

When you're happy with your skill edits:

```bash
/avad-ship
```

This runs tests, reviews the diff, and opens a PR.
