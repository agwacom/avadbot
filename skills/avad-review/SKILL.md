---
name: avad-review
version: 2.1.0
description: |
  Pre-landing code review. Analyzes diff for structural issues using a project-specific
  checklist. Two modes: local (review current branch) or PR (review and comment on a
  GitHub PR by number).
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# Pre-Landing Code Review

You are running the `/avad-review` workflow.

Two modes based on arguments:

- `/avad-review` — **Local mode.** Review current branch diff. Output to terminal.
- `/avad-review <number>` — **PR mode.** Review PR diff. Post findings as a PR review.

---

## Step 1: Determine Mode

Check if an argument was provided:

- **Number provided** (e.g. `58`) → PR mode
- **No argument** → Local mode

---

## Step 2: Read Project Configuration

Read `docs/GIT_WORKFLOW.md` to determine the target branch.

Also read:
- `CLAUDE.md` — for project context
- `AGENTS.md` — for domain rules (canonical values, API whitelist, etc.)

If `docs/GIT_WORKFLOW.md` does not exist, ask the user for the target branch once.

---

## Step 3: Get the Diff

### Local mode:

```bash
git fetch origin
git diff origin/<target>...HEAD
```

Three-dot diff — shows only your branch's changes since divergence.

If on the target branch or no diff exists:
output `Nothing to review — no changes against <target>.` and stop.

### PR mode:

```bash
gh pr diff <number>
```

If the PR doesn't exist or has no diff, report and stop.

---

## Step 4: Load or Generate Checklist

**If a project-specific checklist exists** (`~/.avadbot/projects/<repo>/review-checklist.md`):
read it and use it.

**If no checklist exists**, generate one before proceeding:

1. Read the project's governing docs, `CLAUDE.md`, `AGENTS.md`, and scan the codebase
   structure to understand:
   - Language and framework
   - Database type and access patterns
   - External APIs and their constraints
   - Domain-specific rules (canonical values, idempotency, etc.)
   - Security boundaries (auth, tokens, user input)

2. Read `checklist-seed.md` in this skill directory.
   Use it as a **bootstrap taxonomy only**:
   - start from its seed categories and suppressions
   - prune anything irrelevant to the project
   - rename categories to match the project's actual risks and vocabulary
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
   - **Pass 1 (CRITICAL):** These block `/avad-land`.
   - **Pass 2 (INFORMATIONAL):** Included in PR body but do not block.

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

4. Start from the seed file, but the final categories must still be **derived from the project**, not generic boilerplate.
   Every category and suppression should reflect repo-specific signals from `CLAUDE.md`,
   `AGENTS.md`, architecture docs, or the codebase itself.

5. Write the file. This persists — future runs use it directly.

---

## Step 4.5: Triage Bot Review Comments (PR mode only)

**Skip this step entirely in local mode or if no PR exists.**

### Fetch bot comments

Fetch both line-level and top-level comments in parallel:

```bash
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)
PR_NUMBER=<number>

# Line-level review comments
gh api repos/$REPO/pulls/$PR_NUMBER/comments \
  --jq '.[] | select(.user.type == "Bot" or (.user.login | test("greptile|coderabbit|codeclimate|sonarcloud"; "i"))) | select(.position != null) | {id: .id, path: .path, line: .line, body: .body, html_url: .html_url, user: .user.login, source: "line-level"}' > /tmp/bot_line.json &

# Top-level PR comments
gh api repos/$REPO/issues/$PR_NUMBER/comments \
  --jq '.[] | select(.user.type == "Bot" or (.user.login | test("greptile|coderabbit|codeclimate|sonarcloud"; "i"))) | {id: .id, body: .body, html_url: .html_url, user: .user.login, source: "top-level"}' > /tmp/bot_top.json &
wait
```

**If API errors or zero bot comments:** Skip silently — continue to Step 5.

### Suppressions check

Derive the project slug and check for known false positives:

```bash
REMOTE_SLUG=$(basename "$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)" 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
HISTORY="$HOME/.avadbot/projects/$REMOTE_SLUG/bot-review-history.md"
```

Read `$HISTORY` if it exists. Each line records a previous triage outcome:

```
<YYYY-MM-DD> | <owner/repo> | <bot> | <type:fp|fix|already-fixed> | <file-pattern> | <category>
```

**Categories** (fixed set): `race-condition`, `null-check`, `error-handling`, `style`,
`type-safety`, `security`, `performance`, `correctness`, `other`

Match each fetched comment against entries where:
- `type == fp` (only suppress known false positives)
- `bot` matches the comment's bot name
- `file-pattern` matches the comment's file path
- `category` matches the issue type

Skip matched comments as **SUPPRESSED**.

### Classify

For each non-suppressed comment:

| Classification | Meaning |
|---|---|
| **VALID & ACTIONABLE** | Real issue, not yet fixed in the diff |
| **VALID BUT ALREADY FIXED** | Real issue, but already addressed in the diff |
| **FALSE POSITIVE** | Not a real issue — bot is wrong |
| **SUPPRESSED** | Known false positive from history |

Store the classifications — they are included in Step 6 output.

---

## Step 4.75: TODOS.md Cross-Reference

Read `TODOS.md` in the repo root (skip silently if it doesn't exist). Check whether the diff:

1. **Closes** any open TODO items — note them for the review output
2. **Creates work** that needs a new TODO item — flag it as informational
3. **Has related TODOs** that provide useful review context — use them to inform your review

This step enriches the review with project context but does not block it.

---

## Step 5: Two-Pass Review

Apply the checklist against the diff:

1. **Pass 1 (CRITICAL):** blocking categories
2. **Pass 2 (INFORMATIONAL):** non-blocking categories

Respect the suppressions — do NOT flag items in the suppressions section.
Read the FULL diff before commenting — do not flag issues already addressed in the diff.

---

## Step 6: Output Findings

### Local mode:

- **CRITICAL issues:** For each, use a separate AskUserQuestion:
  - The problem (`file:line` + description)
  - Recommended fix
  - Options: A) Fix now, B) Acknowledge, C) False positive — skip
  - If user chose A: apply the fix.
- **INFORMATIONAL:** Output them. No action needed.
- **No issues:** `Pre-Landing Review: No issues found.`

### PR mode:

Post findings as a PR review using `gh pr review`:

```bash
gh pr review <number> --comment --body "$(cat <<'EOF'
## Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL:**
- [file:line] Problem description
  Fix: suggested fix

**Issues:**
- [file:line] Problem description
  Fix: suggested fix

---
_Review by /avad-review · {YYYY-MM-DD}_
EOF
)"
```

If CRITICAL issues found, use `--request-changes` instead of `--comment`.
If no issues found, use `--approve` with body `Pre-Landing Review: No issues found.`

### Bot comment resolution (if Step 4.5 found any):

Append a section to the PR review body:

```
## Bot Review Triage: N comments (X valid, Y already fixed, Z false positive)
```

For each classified comment:

- **VALID & ACTIONABLE:** Include in the CRITICAL findings above — same flow.
  If user chooses "Fix now": apply fix, reply to bot comment `"Fixed in <commit-sha>."`,
  save to history (type: fix).
- **VALID BUT ALREADY FIXED:** Reply to the bot comment **without @mentioning the bot**:
  `"Good catch — already fixed in <commit-sha>."`
  Save to history (type: already-fixed).
- **FALSE POSITIVE:** Reply to the bot comment **without @mentioning the bot**,
  explaining why it's incorrect.
  Save to history (type: fp).
- **SUPPRESSED:** Skip silently.

### History writes

After triage, append one line per outcome to **both** files:

```bash
REMOTE_SLUG=$(basename "$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)" 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
mkdir -p "$HOME/.avadbot/projects/$REMOTE_SLUG"
```

- `~/.avadbot/projects/$REMOTE_SLUG/bot-review-history.md` (per-project — for suppressions)
- `~/.avadbot/bot-review-history.md` (global — for retro/trends)

Format:
```
<YYYY-MM-DD> | <owner/repo> | <bot> | <type> | <file-pattern> | <category>
```

**Bot mention rule:** Never @mention bots in individual comment replies — each mention
triggers the bot to run again, causing spam and rate limiting. Instead, include a single
summary mention in the main review body. This triggers each bot **once** to review the
summary, not once per comment.

---

## Important Rules

- **Read the FULL diff before commenting.** Do not flag issues already addressed in the diff.
- **Read-only by default (local mode).** Only modify files if the user explicitly chooses "Fix now".
- **Never commit, push, or create PRs.** This is a review skill, not a shipping skill.
- **Be terse.** One line problem, one line fix. No preamble.
- **Only flag real problems.** Skip anything that's fine.
