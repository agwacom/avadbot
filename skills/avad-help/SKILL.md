---
name: avad-help
version: 2.6.0
description: |
  Skill hub: shows all available avadbot skills, helps pick the right one,
  and checks for updates. Use when unsure which skill to run, or to see
  what's available.
allowed-tools:
  - Bash
  - Read
  - Glob
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /avad-help — Skill Hub & Update Check

When invoked, show all available avadbot skills, help the user pick the right one, and check for updates.

## Step 1: Version Check

Check for updates by comparing the installed version against the latest release:

```bash
# Get installed version from plugin.json
PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/avadbot*/.claude-plugin/plugin.json" 2>/dev/null | head -1)
INSTALLED=$(cat "$PLUGIN_DIR" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")

# Check latest version from GitHub
LATEST=$(gh api repos/agwacom/avadbot/releases/latest --jq '.tag_name' 2>/dev/null | sed 's/^v//' || echo "")
# Fallback: check package.json on main branch
if [ -z "$LATEST" ]; then
  LATEST=$(gh api repos/agwacom/avadbot/contents/package.json --jq '.content' 2>/dev/null | base64 -d | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/' || echo "unknown")
fi
```

**If update available:** Show a notice at the top:
```
** Update available: v{INSTALLED} → v{LATEST}
   Run: claude plugin update avadbot
```

**If up to date or check fails:** Skip silently.

## Step 2: Show Skill Catalog

Display all available skills in a table:

```
avadbot v{VERSION} — Skill Catalog

Skill                        What it does                              When to use
─────────────────────────── ──────────────────────────────────────── ──────────────────────────────────
/avadbot:avad-plan-ceo-review  CEO/founder plan review — rethink the    Before building: challenge the
                               problem, find the 10-star product        problem, expand/reduce scope

/avadbot:avad-plan-eng-review  Eng manager plan review — architecture,  Before building: lock in the
                               data flow, edge cases, test coverage     execution plan

/avadbot:avad-review           Pre-landing code review with Fix-First   Before shipping: review your
                               — AUTO-FIX mechanical issues             diff, fix issues

/avadbot:avad-ship             One-command ship — validate, sync,       When ready to ship: push +
                               test, review, push, create PR            create PR automatically

/avadbot:avad-qa               QA test a web app — find and fix bugs,   After deploying: systematic
                               generate regression tests                testing + bug fixing

/avadbot:avad-debug            Systematic root-cause debugger —         When stuck on a bug: traces
                               Iron Law, no fix without root cause      data flow, tests hypotheses

/avadbot:avad-document-release Post-ship doc updater — syncs README,    After shipping: update all
                               CHANGELOG, CLAUDE.md with what shipped   docs to match reality

/avadbot:avad-retro            Weekly engineering retrospective —       End of week: commit analysis,
                               commit analysis, team breakdown          patterns, improvements

/avadbot:avad-browse            Headless browser — navigate, click,      When you need to see a page:
                               screenshot, test forms, import cookies   QA, dogfooding, verification

/avadbot:avad-help              Skill hub — shows all skills,            When unsure which skill to use:
                               context-aware routing, update check      see what's available

/avadbot:avad-hello            Test greeting — confirms plugin works    Testing: verify installation
```

## Step 3: Context-Aware Recommendation

If the user described what they want to do (either in the invocation or as a follow-up), recommend the best skill:

**Role-based routing:**
- "CEO", "founder", "product" → `/avadbot:avad-plan-ceo-review`
- "eng", "engineer", "architect", "technical" → `/avadbot:avad-plan-eng-review`
- "review", "diff", "review PR", "code review" → `/avadbot:avad-review`
- "ship", "push", "deploy", "merge", "create PR" → `/avadbot:avad-ship`
- "QA", "test", "bug", "broken" → `/avadbot:avad-qa`
- "debug", "fix", "stuck", "error", "crash" → `/avadbot:avad-debug`
- "docs", "documentation", "README", "changelog" → `/avadbot:avad-document-release`
- "retro", "retrospective", "week", "metrics" → `/avadbot:avad-retro`
- "browse", "browser", "screenshot", "page" → `/avadbot:avad-browse`

**If no context given:** Use AskUserQuestion:
"What are you trying to do?" with options based on common workflows:
- A) Review a plan before building
- B) Review code before shipping
- C) Ship my changes (push + PR)
- D) Test/QA a web app
- E) Debug a bug or error
- F) Update docs after shipping
- G) Browse/screenshot a page
- H) Run a weekly retro

Then recommend the specific skill with the exact command to run.

## Step 4: Workflow Suggestions

After recommending, briefly show the typical workflow order:

```
Typical workflow:
  Plan  →  Build  →  Review  →  Ship  →  QA  →  Docs  →  Retro
  /avad-plan-*  →  /avad-review  →  /avad-ship  →  /avad-qa  →  /avad-document-release  →  /avad-retro
```

## Rules

- Keep output concise — one screen max for the catalog
- Never run any other skill — only recommend which to use
- If the user already knows which skill they want, just confirm and show the command
- Update check failure is silent — never error on network issues

## Agent Identity

Use your full model name and version as your agent identifier in all GitHub output.
Examples: "claude Opus 4.6", "codex o3", "gemini 2.5 Pro"

## GitHub Output

When creating or commenting on GitHub issues, discussions, or pull requests:

1. **Title prefix:** Include the skill role in the title.
   Format: `[avad-help] {short description}`
   Example: `[avad-help] skill catalog and update check`

2. **Labels:**
   - Role label: `avad-help`
   - Add any project-specific labels per the project's labeling convention.
   - Do NOT add task/work labels — help output is informational, not tasks.
   - Create the label if it does not exist (color: `#0E8A16`, description: "Skill hub and update check").

3. **Both title prefix and label are required.**

## Headings

Prefix all comment, issue, discussion, and PR section headings with **your agent identity**.
Example: "## **claude Opus 4.6** Skill Catalog"

## Signature

End every GitHub issue, discussion post, PR description, review comment, or review response with a signature line:

```
---
_Generated by {agent identity} · /avad-help · {YYYY-MM-DD}_
```
Example: `_Generated by claude Opus 4.6 · /avad-help · 2026-03-19_`
