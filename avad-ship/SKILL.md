---
name: avad-ship
version: 1.0.0
description: |
  Ship workflow: validate branch state, sync with target branch, run tests,
  pre-landing review, push, and create PR. Project-aware — reads target branch,
  test commands, and review checklist from docs/GIT_WORKFLOW.md.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

# Ship: Validate, Review, and Ship

You are running the `/ship` workflow. This is **automated by default** — run straight through
and output the PR URL at the end.

**Only stop for:**
- Being on a protected branch (abort)
- Merge conflicts that can't be auto-resolved (show conflicts)
- Validation failures (show failures)
- CRITICAL review findings — one AskUserQuestion per critical issue
- Cannot discover target branch or test commands (ask once)

**Never stop for:**
- Uncommitted changes that belong to the branch's logical change (stage and include them)
- Commit message wording (auto-compose)
- PR body content (auto-generate)

---

## Safety Check

Before anything else, verify you are NOT on a known protected branch:

```bash
branch=$(git branch --show-current)
```

If `$branch` is `main` or `master`, **abort immediately**:
"You're on `<branch>`. Land from a work branch."

This prevents Step 0 from committing a generated `GIT_WORKFLOW.md` onto a protected branch.

---

## Step 0: Read Project Configuration

Read `docs/GIT_WORKFLOW.md`.

### If `docs/GIT_WORKFLOW.md` exists:

Read it. Extract everything you need:
- **Target branch** (e.g. `dev`, `main`)
- **Protected branches** and their protection levels
- **Branch naming** conventions and allowed prefixes
- **Merge strategy** (squash, merge commit, rebase)
- **Commit message format** (Conventional Commits, scopes, etc.)
- **PR requirements** (CI checks, approvals, CODEOWNERS)
- **Version numbering** scheme (if any)

Also read:
- `CLAUDE.md` — for **test/lint/typecheck commands**
- `AGENTS.md` — for **domain rules** (canonical values, API whitelist, etc.)
- `~/.avadbot/projects/<repo>/review-checklist.md` — for **pre-landing review checklist** (if it exists)

### If `docs/GIT_WORKFLOW.md` does NOT exist:

Generate it. Read the project's available context to infer the workflow:

1. **Scan for signals:**
   - `CLAUDE.md`, `AGENTS.md` — rules, commands, conventions
   - `git log --oneline -20` — commit message style, branch merge patterns
   - `git branch -r` — what remote branches exist
   - `git config pull.rebase` — merge vs rebase preference
   - `pyproject.toml` / `package.json` / `Cargo.toml` / `go.mod` — language and tooling
   - `.github/workflows/` — CI configuration

2. **Ask the user key questions** (one AskUserQuestion, all at once):
   - What is your target integration branch? (e.g. `dev`, `main`)
   - Do you use squash merge, merge commits, or rebase?
   - Any branch naming conventions?
   - Any required CI checks before merge?

3. **Generate `docs/GIT_WORKFLOW.md`** covering:
   - Branch structure (diagram + table of branches and their purpose)
   - Workflow steps (create branch → commit → push → PR)
   - Commit message format with project-specific scopes
   - Merge strategy per PR type
   - Protected branches and their rules
   - Version numbering (if applicable)
   - Agent-specific rules (what agents must/must not do)

4. **Write the file but do NOT commit yet.**
   Step 1 must validate the branch first. The file will be committed
   in Step 7 along with other changes (or on its own if there are no other changes).

   This file persists — future `/ship` runs read it directly.

---

## Step 1: Pre-flight

1. Run `git status --short --branch` (never use `-uall`).

2. Confirm the current branch is a valid work branch:
   - Must NOT be a protected branch (as defined in `docs/GIT_WORKFLOW.md`)
   - Must follow the branch naming conventions from `docs/GIT_WORKFLOW.md`
   - If on a protected branch, use **AskUserQuestion** with options:
     - **A) Create a work branch** — move changes to a new branch (e.g. `chore/description`) and continue shipping
     - **B) Commit on `<branch>` directly** — bypass branch protection rule
     - **C) Abort** — stop shipping

3. Check for uncommitted changes:
   - If there are uncommitted changes, use **AskUserQuestion** with options:
     - **A) Stage and include** — changes are related to this branch's work
     - **B) Stash and exclude** — changes are unrelated, stash them before shipping
     - **C) Show me the changes** — display the diff so I can decide
   - If user picks A: stage all and continue
   - If user picks B: `git stash push -u -m "ship: stashed unrelated changes"` and continue
   - If user picks C: show `git diff` and `git status`, then re-ask A or B

4. Confirm the branch represents one logical change only.
   If the branch history mixes unrelated work, stop and require splitting.

5. Review the shipment scope:

   ```bash
   git diff --stat origin/<target>...HEAD
   git log --oneline origin/<target>..HEAD
   ```

---

## Step 2: Sync with Target Branch

Use the integration strategy defined in `docs/GIT_WORKFLOW.md`:

```bash
git fetch origin

# If GIT_WORKFLOW.md specifies rebase:
git rebase --autostash origin/<target>

# If GIT_WORKFLOW.md specifies merge (or no preference):
git merge origin/<target> --no-edit
```

If conflicts appear:
- Auto-resolve trivial mechanical conflicts (whitespace, ordering)
- If conflicts are ambiguous or affect behavior, **stop** and show them

If already up to date, continue silently.

---

## Step 3: Run Validation

Run all discovered test/lint/type-check commands **in parallel** where possible.

Use a unique temp directory to avoid collisions with concurrent runs,
and capture exit codes explicitly:

```bash
_land_tmp=$(mktemp -d)

(set -o pipefail; <test-cmd> 2>&1 | tee "$_land_tmp/tests.txt"; echo $? > "$_land_tmp/tests.exit") &
(set -o pipefail; <lint-cmd> 2>&1 | tee "$_land_tmp/lint.txt"; echo $? > "$_land_tmp/lint.exit") &
(set -o pipefail; <typecheck-cmd> 2>&1 | tee "$_land_tmp/types.txt"; echo $? > "$_land_tmp/types.exit") &
wait
```

After all complete, check each `*.exit` file. If any contains a non-zero code,
show that command's output and **stop**.

Rules:
- If any command fails, show the failures and **stop**
- If all pass, note the counts briefly and continue
- Capture output — it goes into the PR body
- **Always clean up `$_land_tmp`** — run `rm -rf "$_land_tmp"` before any exit,
  whether validation passed, failed, or the workflow stops for any reason.
  Since the agent runs individual shell commands (not a script), `trap` does not
  persist between calls. Instead, run the cleanup explicitly before stopping.

If the project has no test commands, warn the user and continue.

---

## Step 4: Determine Targeted Validation (Conditional)

If the repository defines a validation matrix (in governing docs or CLAUDE.md),
check which areas are affected:

```bash
git diff --name-only origin/<target>...HEAD
```

Run any additional area-specific checks beyond the general test suite.
Examples: migration validation, contract tests, idempotency checks.

Skip this step if no validation matrix is defined.

---

## Step 5: Pre-Landing Review

Review the diff for structural issues that tests don't catch.

```bash
git diff origin/<target>...HEAD
```

Always use three-dot diff (`...`) — this shows only your branch's changes since
divergence, not changes on the target branch.

### Step 5.0: Load or Generate Checklist

**If a project-specific checklist exists** (`~/.avadbot/projects/<repo>/review-checklist.md`):
read it and use it.

**If no checklist exists**, generate one before proceeding:

1. Read the project's governing docs, `CLAUDE.md`, `AGENTS.md`, and scan the codebase
   structure to understand:
   - Language and framework (Python/Django, Rails, Node/React, Go, etc.)
   - Database type and access patterns (raw SQL, ORM, migrations)
   - External APIs used and their constraints
   - Domain-specific rules (canonical values, idempotency requirements, etc.)
   - Security boundaries (auth, tokens, user input handling)

2. Read `../avad-review/checklist-seed.md` and use it as the bootstrap taxonomy.
   Adapt it before writing anything:
   - keep only categories that matter to this repo
   - rename categories to match the project's actual architecture and vocabulary
   - add project-specific categories and suppressions from docs and code
   - never copy the seed verbatim as the final checklist
   - no code transforms the seed; the agent reads it as context and synthesizes
     the final project-specific checklist

3. Generate `~/.avadbot/projects/<repo>/review-checklist.md` following this structure:

   ```markdown
   # Pre-Landing Review Checklist

   ## Instructions

   Review the diff for the issues listed below. Be specific — cite `file:line`
   and suggest fixes. Skip anything that's fine. Only flag real problems.

   **Two-pass review:**
   - **Pass 1 (CRITICAL):** Run critical categories first. These block `/ship`.
   - **Pass 2 (INFORMATIONAL):** Run remaining categories. Included in PR body
     but do not block.

   **Output format:**

   Pre-Landing Review: N issues (X critical, Y informational)

   **CRITICAL** (blocking):
   - [file:line] Problem description
     Fix: suggested fix

   **Issues** (non-blocking):
   - [file:line] Problem description
     Fix: suggested fix

   If no issues found: `Pre-Landing Review: No issues found.`

   Be terse. One line problem, one line fix. No preamble.

   ---

   ## Pass 1 — CRITICAL

   <generate 2-4 critical categories based on the project's actual risks>

   ## Pass 2 — INFORMATIONAL

   <generate 3-6 informational categories based on the project's patterns>

   ---

   ## Suppressions — DO NOT flag these

   <generate 3-5 suppression rules to reduce false positives>
   ```

4. Start from the seed file, but the final categories must be **derived from the project**, not generic boilerplate.
   Examples of how project signals map to checklist items:

   | Project signal | → Critical category |
   |---|---|
   | Raw SQL / migrations dir | SQL injection, parameterized queries |
   | `AGENTS.md` lists canonical values | Vocabulary drift |
   | Insert-only / upsert patterns | Idempotency regressions |
   | API key / OAuth in auth module | Secrets in tracked files |
   | Rate limit handling in code | Rate limit safety |

   | Project signal | → Informational category |
   |---|---|
   | Architecture doc with contracts | Schema drift from contracts |
   | Endpoint whitelist | Unauthorized endpoint usage |
   | Migration files present | Editing applied migrations |
   | Test directory exists | Test gaps for new code paths |

5. Write the file to `~/.avadbot/projects/<repo>/review-checklist.md` and continue.
   This file persists — future `/ship` runs will use it directly.

### Step 5.1: Apply the Checklist

1. Apply it in two passes:
   - **Pass 1 (CRITICAL):** blocking categories — stop `/ship` if found
   - **Pass 2 (INFORMATIONAL):** non-blocking — include in PR body
2. Output: `Pre-Landing Review: N issues (X critical, Y informational)`

### Handling findings:

- **CRITICAL:** For each, use a separate AskUserQuestion:
  - The problem (`file:line` + description)
  - Recommended fix
  - Options: A) Fix now, B) Acknowledge and land anyway, C) False positive — skip
  - If user chose A on any: apply fixes, commit the fixed files, then **re-run validation
    (Step 3)** to confirm the fixes don't break anything. If validation passes, continue
    to Step 7. If it fails, stop.
  - If user chose only B/C on all: continue

- **INFORMATIONAL:** Output them and continue. They go into the PR body.

- **No issues:** Output `Pre-Landing Review: No issues found.` and continue.

---

## Step 5.5: TODOS.md Auto-Update

Read `TODOS.md` in the repo root. If it doesn't exist, skip this step silently.

If it exists:

1. **Detect completed items:** Scan the diff and commit history for work that closes open TODOs.
   Match conservatively — only mark items done when the diff clearly resolves the TODO's **What** description.

2. **Move completed items** to the `## Completed` section, preserving original content and appending:
   ```markdown
   **Completed:** vX.Y.Z (YYYY-MM-DD)
   ```

3. **Check structure:** Verify items follow the format in `avad-review/TODOS-format.md`
   (What/Why/Context/Effort/Priority). Do not rewrite existing items — only flag malformed ones
   as informational.

4. If any items were moved to Completed, stage `TODOS.md` for the version bump commit in Step 8.

---

## Step 6: Version Bump (auto-decide)

1. **Find the version source** (check in order, use the first match):
   - `VERSION` file
   - `package.json` → `"version"` field
   - `pyproject.toml` → `version` field
   - `Cargo.toml` → `version` field
   - **None found** → create a `VERSION` file starting at `0.1.0`

2. **Auto-decide the bump level based on the diff:**
   - Count lines changed: `git diff origin/<target>...HEAD --stat | tail -1`
   - **PATCH** (3rd digit): < 50 lines changed, bug fixes, trivial tweaks, config
   - **MINOR** (2nd digit): 50+ lines changed, new features, significant changes
   - **MAJOR** (1st digit): **ASK the user** — only for breaking changes or milestones

3. **Compute the new version:**
   - Bumping a digit resets all digits to its right to 0
   - Example: `1.2.3` + MINOR → `1.3.0`

4. **Write the new version** to the same source where it was found.

---

## Step 7: CHANGELOG (auto-generate)

1. **If `CHANGELOG.md` does not exist**, create it with a standard header:
   ```markdown
   # Changelog

   All notable changes to this project will be documented in this file.
   ```

2. **Auto-generate the entry** from ALL commits on the branch:
   - Use `git log <target>..HEAD --oneline` for commit history
   - Use `git diff <target>...HEAD` for the full diff
   - Categorize changes into applicable sections:
     - `### Added` — new features
     - `### Changed` — changes to existing functionality
     - `### Fixed` — bug fixes
     - `### Removed` — removed features
   - Only include sections that have entries
   - Write concise, descriptive bullet points
   - Insert after the file header, dated today
   - Format: `## [X.Y.Z] - YYYY-MM-DD`

3. **Do NOT ask the user to describe changes.** Infer from the diff and commit history.

---

## Step 8: Commit (bisectable chunks)

**Goal:** Create small, logical commits that work well with `git bisect`.

This step handles **uncommitted changes only** — do not rewrite, reorder, or amend
existing branch commits. The branch history is the developer's responsibility.

If there are no uncommitted changes, skip to Step 9.

1. **Commit ordering** (earlier commits first):
   - **Infrastructure:** migrations, config changes, route additions
   - **Models & services:** new models, services, concerns (with their tests)
   - **Controllers & views:** controllers, views, components (with their tests)
   - **VERSION + CHANGELOG:** always in the final commit

2. **Rules for splitting:**
   - A module/service and its test file go in the same commit
   - A controller, its views, and its test go in the same commit
   - Migrations are their own commit (or grouped with the model they support)
   - Config/route changes can group with the feature they enable
   - If the total diff is small (< 50 lines across < 4 files), a single commit is fine

3. **Each commit must be independently valid** — no broken imports, no references
   to code that doesn't exist yet. Order commits so dependencies come first.

4. **Commit message format:**
   - First line: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   - Use the format defined in `docs/GIT_WORKFLOW.md` if available
   - Only the **final commit** gets the co-author trailer:

   ```bash
   git commit -m "$(cat <<'EOF'
   chore: bump version and changelog (vX.Y.Z)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

---

## Step 9: Push

```bash
git push -u origin <branch-name>
```

Never force push.

---

## Step 10: Create PR

Target branch: `<target>` (from `docs/GIT_WORKFLOW.md`).

```bash
git fetch origin
```

Verify the branch is still based on the latest `origin/<target>`.

Create a PR:

```bash
gh pr create --base <target> --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points from CHANGELOG>

## Validation
<commands run, pass/fail results>

## Pre-Landing Review
<findings from Step 5, or "No issues found.">

## Risks / Follow-ups
<assumptions, residual risk, follow-up work — or "None.">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Output the PR URL** — this is the final output the user sees.

---

## Important Rules

- Never skip validation. If tests fail, stop.
- Never skip the pre-landing review.
- Never force push.
- Never merge without explicit user instruction.
- Never include unrelated dirty changes in a shipped diff.
- Never create a PR from a branch containing mixed-purpose work.
- Never proceed on stale branch state — always `git fetch` first.
- Stop when governance documents require stopping.
- If unsure, choose the minimum safe action and report the blocker.
- Respect each project's conventions — do not impose external conventions.
- Split commits for bisectability — each commit = one logical change.
- The goal is: user says `/ship`, next thing they see is the review + PR URL.

---

## Expected Outcome

When `/ship` completes successfully:

1. Branch verified as a single logical change
2. Synced with latest `origin/<target>`
3. All validation passed
4. Pre-landing review completed
5. Version bumped
6. CHANGELOG updated
7. Changes committed in bisectable chunks
8. Branch pushed
9. PR created targeting `<target>`
10. User sees the PR URL
