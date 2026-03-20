# avadbot

Skills for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that turn one AI assistant into a team of specialists. Each slash command activates a different mode — planning, review, shipping, QA, browsing, retrospectives.

Works with any project, any language, any framework.

## Skills

| Skill | What it does |
|-------|-------------|
| `/avad-plan-ceo-review` | Product thinking. Challenges the premise, expands scope, finds the real product. |
| `/avad-plan-eng-review` | Engineering plan. Architecture, data flow, edge cases, diagrams, test coverage. |
| `/avad-review` | Pre-landing review. Structural bugs, race conditions, trust boundaries, missing tests. |
| `/avad-ship` | Ship it. Sync, test, review, push, PR — one command. |
| `/avad-qa` | QA testing. Diff-aware, full, quick, or regression mode. |
| `/avad-qa --report-only` | Same QA testing, but report-only — never fixes. |
| `/avad-retro` | Weekly retro. Commits, patterns, team breakdown, trends. |
| `/avad-debug` | Systematic debugger. Root cause investigation, pattern analysis, hypothesis testing. |
| `/avad-document-release` | Post-ship docs. Cross-references the diff, updates all project documentation. |
| `/avad-help` | Skill hub. Shows available skills, recommends the right one, checks for updates. |
| `/browse` | Headless browser. Navigate, click, screenshot, assert — ~100ms per command. |

## How it works

Each skill is a cognitive mode. You switch between them as your work progresses:

```
1. Describe the feature

2. /avad-plan-ceo-review
   → "You're thinking too small. The real product is..."

3. /avad-plan-eng-review
   → Architecture diagram, state machine, failure modes, test matrix

4. Build it

5. /avad-review
   → "Race condition on line 47. Trust boundary violation in the enrichment pipeline."

6. Fix the issues

7. /avad-ship
   → Syncs main, runs tests, pushes, opens PR. Done.

8. /avad-qa
   → Reads your diff, finds affected pages, tests each one with a real browser.
```

## Parallel execution

avadbot skills are stateless by design. There is no shared mutable state between sessions — each workspace runs its own browser process with independent cookies, tabs, and logs.

This means you can run as many Claude Code sessions as you want simultaneously using [Conductor](https://github.com/anthropics/claude-code/blob/main/docs/conductor.md). Review a PR in one session while QA testing in another and building a feature in a third. The sessions are fully isolated — no port conflicts, no coordination needed.

The skills were built for this. `/avad-review` analyzes diffs, `/avad-qa` drives a browser, `/avad-ship` pushes code — all independently, all in parallel.

## Skill details

### `/avad-plan-ceo-review`

Product-level review. Three modes:

- **Scope expansion** — dream big, find the 10-star version
- **Hold scope** — keep scope fixed, maximize rigor
- **Scope reduction** — strip to the essential core

You describe a feature. The skill asks whether you're building the right thing. It pushes past the literal request to find what users actually need.

### `/avad-plan-eng-review`

Engineering-level review. Takes the product direction and makes it buildable:

- Architecture and system boundaries
- Data flow and state transitions
- Failure modes and edge cases
- Diagrams (sequence, state, component)
- Test coverage plan

### `/avad-review`

Pre-landing code review. Not style nits — structural issues:

- N+1 queries, missing indexes
- Race conditions, stale reads
- Trust boundary violations
- Broken invariants, bad retry logic
- Tests that pass while missing the real failure mode

Two modes: **local** (review current branch) or **PR** (review a GitHub PR by number).

### `/avad-ship`

One-command shipping. For a branch that's ready to land:

1. Validates branch state
2. Syncs with target branch
3. Runs tests
4. Pre-landing review
5. Pushes
6. Creates PR

Project-aware — reads target branch, test commands, and review checklist from `docs/GIT_WORKFLOW.md` if it exists. Auto-detects test commands if not configured.

### `/avad-qa`

QA testing with a real browser. Four modes:

- **Diff-aware** (default on feature branches) — reads `git diff`, identifies affected pages, tests them
- **Full** — systematic exploration of the entire app
- **Quick** — 30-second smoke test
- **Regression** — compare against a previous baseline

Produces a structured report with health score, screenshots, and repro steps.

After testing, asks whether to fix the issues or just report them. Pass `--report-only` to skip the question and get a report without fixes.

### `/avad-retro`

Weekly engineering retrospective:

- Commit history and LOC analysis
- Per-person breakdown with praise and growth areas
- Shipping streaks, hotspot files, peak hours
- Persistent history for trend tracking

### `/avad-debug`

Systematic debugging with root cause investigation. Four phases:

1. **Investigate** — collect symptoms, read the code, check recent changes, reproduce
2. **Analyze** — match against known bug patterns (race conditions, nil propagation, stale cache, config drift)
3. **Hypothesize** — test one hypothesis at a time, 3-strike escalation if none match
4. **Implement** — fix root cause with minimal diff, write regression test, verify

Iron Law: no fixes without root cause investigation first.

### `/avad-document-release`

Post-ship documentation updater. Run after shipping code to ensure all docs match what was delivered:

- Cross-references the diff against every `.md` file in the project
- Auto-updates factual changes (paths, counts, tables), asks about narrative changes
- Polishes CHANGELOG voice without clobbering entries
- Checks cross-doc consistency and discoverability
- Cleans up TODOS.md and optionally bumps VERSION

### `/avad-help`

Skill hub: shows all available avadbot skills, helps pick the right one, and checks for updates. Context-aware — describe what you want to do and it recommends the best skill.

### `/browse`

Headless Chromium browser, ~100ms per command. Auto-starts on first use, persists between calls.

```bash
# Navigate
$B goto https://your-app.com

# See interactive elements
$B snapshot -i

# Interact by reference
$B fill @e2 "user@example.com"
$B click @e3

# Verify
$B snapshot -D          # diff — what changed?
$B console              # any JS errors?
$B screenshot /tmp/result.png

# Assert
$B is visible ".success-toast"
$B is enabled "#submit-btn"
```

For the full command reference, see [skills/browse/SKILL.md](skills/browse/SKILL.md).

## Install

### Marketplace install (recommended)

```bash
claude plugin marketplace add agwacom/avadbot
claude plugin install avadbot
```

Skills are auto-discovered and namespaced as `/avadbot:avad-review`, `/avadbot:browse`, etc.

### Local plugin install

If you have the repo cloned locally:

```bash
claude --plugin-dir ./avadbot
```

### Legacy install

Use the setup script to copy skills to `~/.claude/skills/`:

```bash
./setup
```

Add to your `~/.claude/CLAUDE.md`:

```markdown
## avadbot

Available skills: /avad-plan-ceo-review, /avad-plan-eng-review, /avad-review, /avad-ship, /avad-qa, /avad-retro, /avad-debug, /avad-document-release, /avad-help, /browse
```

### Migrating from legacy install

If you previously installed avadbot via `./setup`, remove the legacy skills after confirming the plugin works to avoid duplicate skill entries:

```bash
rm -rf ~/.claude/skills/avad-plan-ceo-review
rm -rf ~/.claude/skills/avad-plan-eng-review
rm -rf ~/.claude/skills/avad-review
rm -rf ~/.claude/skills/avad-ship
rm -rf ~/.claude/skills/avad-qa
rm -rf ~/.claude/skills/avad-retro
rm -rf ~/.claude/skills/avad-debug
rm -rf ~/.claude/skills/avad-document-release
rm -rf ~/.claude/skills/avad-help
rm -rf ~/.claude/skills/browse
```

## Per-project data

Runtime data lives under `~/.avadbot/`:

```
~/.avadbot/
├── bot-review-history.md
└── projects/
    └── <repo>/
        ├── bot-review-history.md
        └── review-checklist.md
```

## License

MIT
