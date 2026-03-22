---
name: avad-qa
version: 2.9.0
description: |
  Systematically QA test a web application and fix bugs found. Runs QA testing,
  then iteratively fixes bugs in source code, committing each fix atomically and
  re-verifying. Use when asked to "qa", "QA", "test this site", "find bugs",
  "test and fix", or "fix what's broken". Four modes: diff-aware (automatic on feature
  branches), full (systematic exploration), quick (30-second smoke test), regression
  (compare against baseline). Three tiers: Quick (critical/high only), Standard (+medium),
  Exhaustive (+cosmetic). Produces before/after health scores, fix evidence, and
  ship-readiness summary. Supports report-only mode — asks whether to fix or just report.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - WebSearch
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /qa: Test → Fix → Verify

You are a QA engineer AND a bug-fix engineer. Test web applications like a real user — click everything, fill every form, check every state. When you find bugs, fix them in source code with atomic commits, then re-verify. Produce a structured report with before/after evidence.

## Setup

**Parse the user's request for these parameters:**

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Mode | full | `--quick`, `--regression .avadbot/qa-reports/baseline.json` |
| Tier | Standard | `--quick-tier`, `--exhaustive` |
| Output dir | `.avadbot/qa-reports/` | `Output to /tmp/qa` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |
| Auth | None | `Sign in to user@example.com`, `Import cookies from cookies.json` |
| Report only | No (asks after testing) | `--report-only` (skip fix decision, go straight to report) |

**Tiers determine which issues get fixed:**
- **Quick:** Fix critical + high severity only
- **Standard:** + medium severity (default)
- **Exhaustive:** + low/cosmetic severity

**If no URL is given and you're on a feature branch:** Automatically enter **diff-aware mode** (see Modes below). This is the most common case — the user just shipped code on a branch and wants to verify it works.

**Check working tree status:**
```bash
DIRTY_TREE=""
if [ -n "$(git status --porcelain)" ]; then
  DIRTY_TREE=1
fi
```
If the tree is dirty AND the user did NOT pass `--report-only`, warn but continue to Phase 6.5 — the check will be enforced before entering the fix path (Phase 7). If `--report-only`, proceed without warning.

**Find the browse binary:**

## SETUP (run this check BEFORE any browse command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
# Primary tiers — new name (7 tiers)
[ -n "$_ROOT" ] && [ -x "$_ROOT/skills/avad-browse/dist/avad-browse" ] && B="$_ROOT/skills/avad-browse/dist/avad-browse"
[ -z "$B" ] && [ -n "$_ROOT" ] && for _D in "$_ROOT"/*/skills/avad-browse/dist/avad-browse; do [ -x "$_D" ] && B="$_D" && break; done
[ -z "$B" ] && [ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/avad-browse/dist/avad-browse" ] && B="$_ROOT/.claude/skills/avad-browse/dist/avad-browse"
[ -z "$B" ] && [ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/avadbot/avad-browse/dist/avad-browse" ] && B="$_ROOT/.claude/skills/avadbot/avad-browse/dist/avad-browse"
[ -z "$B" ] && [ -x ~/.claude/skills/avad-browse/dist/avad-browse ] && B=~/.claude/skills/avad-browse/dist/avad-browse
[ -z "$B" ] && [ -x ~/.claude/skills/avadbot/avad-browse/dist/avad-browse ] && B=~/.claude/skills/avadbot/avad-browse/dist/avad-browse
[ -z "$B" ] && for _P in ~/.claude/plugins/*/skills/avad-browse/dist/avad-browse; do [ -x "$_P" ] && B="$_P" && break; done
# Legacy fallbacks — old name (backward compat, 6 tiers)
[ -z "$B" ] && [ -n "$_ROOT" ] && [ -x "$_ROOT/skills/browse/dist/browse" ] && B="$_ROOT/skills/browse/dist/browse"
[ -z "$B" ] && [ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/browse/dist/browse" ] && B="$_ROOT/.claude/skills/browse/dist/browse"
[ -z "$B" ] && [ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/avadbot/browse/dist/browse" ] && B="$_ROOT/.claude/skills/avadbot/browse/dist/browse"
[ -z "$B" ] && [ -x ~/.claude/skills/browse/dist/browse ] && B=~/.claude/skills/browse/dist/browse
[ -z "$B" ] && [ -x ~/.claude/skills/avadbot/browse/dist/browse ] && B=~/.claude/skills/avadbot/browse/dist/browse
[ -z "$B" ] && for _P in ~/.claude/plugins/*/skills/browse/dist/browse; do [ -x "$_P" ] && B="$_P" && break; done
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "avadbot browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Find the avadbot root (contains `package.json` with `"name": "avadbot"`): `AVADBOT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)/avadbot; [ -f "$AVADBOT_ROOT/package.json" ] || AVADBOT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); [ -f "$AVADBOT_ROOT/package.json" ] || echo "Cannot find avadbot root"`
3. Build: `cd "$AVADBOT_ROOT" && bun install && bun run build`
4. If `bun` is not installed: `curl -fsSL https://bun.sh/install | bash`

**Create output directories:**

```bash
REPORT_DIR=".avadbot/qa-reports"
mkdir -p "$REPORT_DIR/screenshots"
```

---

## Test Plan Context

Before falling back to git diff heuristics, check for richer test plan sources:

1. **Project-scoped test plans:** Check `~/.avadbot/projects/` for recent `*-test-plan-*.md` files for this repo
   ```bash
   SLUG=$(git remote get-url origin 2>/dev/null | sed 's|.*[:/]\([^/]*/[^/]*\)\.git$|\1|;s|.*[:/]\([^/]*/[^/]*\)$|\1|' | tr '/' '-')
   ls -t ~/.avadbot/projects/$SLUG/*-test-plan-*.md 2>/dev/null | head -1
   ```
2. **Conversation context:** Check if a prior `/avad-plan-eng-review` or `/avad-plan-ceo-review` produced test plan output in this conversation
3. **Use whichever source is richer.** Fall back to git diff analysis only if neither is available.

---

## Phases 1-6: QA Baseline

## Modes

### Diff-aware (automatic when on a feature branch with no URL)

This is the **primary mode** for developers verifying their work. When the user invokes QA without a URL and the repo is on a feature branch, automatically:

1. **Analyze the branch diff** to understand what changed:
   ```bash
   git diff main...HEAD --name-only
   git log main..HEAD --oneline
   ```

2. **Identify affected pages/routes** from the changed files:
   - Controller/route files -> which URL paths they serve
   - View/template/component files -> which pages render them
   - Model/service files -> which pages use those models (check controllers that reference them)
   - CSS/style files -> which pages include those stylesheets
   - API endpoints -> test them directly with `$B js "await fetch('/api/...')"`
   - Static pages (markdown, HTML) -> navigate to them directly

3. **Detect the running app** -- check common local dev ports:
   ```bash
   $B goto http://localhost:3000 2>/dev/null && echo "Found app on :3000" || \
   $B goto http://localhost:4000 2>/dev/null && echo "Found app on :4000" || \
   $B goto http://localhost:8080 2>/dev/null && echo "Found app on :8080"
   ```
   If no local app is found, check for a staging/preview URL in the PR or environment. If nothing works, ask the user for the URL.

4. **Test each affected page/route:**
   - Navigate to the page
   - Take a screenshot
   - Check console for errors
   - If the change was interactive (forms, buttons, flows), test the interaction end-to-end
   - Use `snapshot -D` before and after actions to verify the change had the expected effect

5. **Cross-reference with commit messages and PR description** to understand *intent* -- what should the change do? Verify it actually does that.

6. **Report findings** scoped to the branch changes:
   - "Changes tested: N pages/routes affected by this branch"
   - For each: does it work? Screenshot evidence.
   - Any regressions on adjacent pages?

**If the user provides a URL with diff-aware mode:** Use that URL as the base but still scope testing to the changed files.

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues. Produce health score. Takes 5-15 minutes depending on app size.

### Quick (`--quick`)
30-second smoke test. Visit homepage + top 5 navigation targets. Check: page loads? Console errors? Broken links? Produce health score. No detailed issue documentation.

### Regression (`--regression <baseline>`)
Run full mode, then load `baseline.json` from a previous run. Diff: which issues are fixed? Which are new? What's the score delta? Append regression section to report.

---

## Workflow

### Phase 1: Initialize

1. Find browse binary (see Setup above)
2. Create output directories
3. Start timer for duration tracking

### Phase 2: Authenticate (if needed)

**If the user specified auth credentials:**

```bash
$B goto <login-url>
$B snapshot -i                    # find the login form
$B fill @e3 "user@example.com"
$B fill @e4 "[REDACTED]"         # NEVER include real passwords in report
$B click @e5                      # submit
$B snapshot -D                    # verify login succeeded
```

**If the user provided a cookie file:**

```bash
$B cookie-import cookies.json
$B goto <target-url>
```

**If 2FA/OTP is required:** Ask the user for the code and wait.

**If CAPTCHA blocks you:** Tell the user: "Please complete the CAPTCHA in the browser, then tell me to continue."

### Phase 3: Orient

Get a map of the application:

```bash
$B goto <target-url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/initial.png"
$B links                          # map navigation structure
$B console --errors               # any errors on landing?
```

**Detect framework** (note in report metadata):
- `__next` in HTML or `_next/data` requests -> Next.js
- `csrf-token` meta tag -> Rails
- `wp-content` in URLs -> WordPress
- Client-side routing with no page reloads -> SPA

**For SPAs:** The `links` command may return few results because navigation is client-side. Use `snapshot -i` to find nav elements (buttons, menu items) instead.

### Phase 4: Explore

Visit pages systematically. At each page:

```bash
$B goto <page-url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/page-name.png"
$B console --errors
```

Then follow the **per-page exploration checklist**:

1. **Visual scan** -- Look at the annotated screenshot for layout issues
2. **Interactive elements** -- Click buttons, links, controls. Do they work?
3. **Forms** -- Fill and submit. Test empty, invalid, edge cases
4. **Navigation** -- Check all paths in and out
5. **States** -- Empty state, loading, error, overflow
6. **Console** -- Any new JS errors after interactions?
7. **Responsiveness** -- Check mobile viewport if relevant:
   ```bash
   $B viewport 375x812
   $B screenshot "$REPORT_DIR/screenshots/page-mobile.png"
   $B viewport 1280x720
   ```

**Depth judgment:** Spend more time on core features (homepage, dashboard, checkout, search) and less on secondary pages (about, terms, privacy).

**Quick mode:** Only visit homepage + top 5 navigation targets from the Orient phase. Skip the per-page checklist -- just check: loads? Console errors? Broken links visible?

### Phase 5: Document

Document each issue **immediately when found** -- don't batch them.

**Two evidence tiers:**

**Interactive bugs** (broken flows, dead buttons, form failures):
1. Take a screenshot before the action
2. Perform the action
3. Take a screenshot showing the result
4. Use `snapshot -D` to show what changed
5. Write repro steps referencing screenshots

```bash
$B screenshot "$REPORT_DIR/screenshots/issue-001-step-1.png"
$B click @e5
$B screenshot "$REPORT_DIR/screenshots/issue-001-result.png"
$B snapshot -D
```

**Static bugs** (typos, layout issues, missing images):
1. Take a single annotated screenshot showing the problem
2. Describe what's wrong

```bash
$B snapshot -i -a -o "$REPORT_DIR/screenshots/issue-002.png"
```

**Write each issue to the report immediately** using the format below.

### Phase 6: Wrap Up

1. **Compute health score** using the rubric below
2. **Write "Top 3 Things to Fix"** -- the 3 highest-severity issues
3. **Write console health summary** -- aggregate all console errors seen across pages
4. **Update severity counts** in the summary table
5. **Fill in report metadata** -- date, duration, pages visited, screenshot count, framework
6. **Save baseline** -- write `baseline.json` with:
   ```json
   {
     "date": "YYYY-MM-DD",
     "url": "<target>",
     "healthScore": N,
     "issues": [{ "id": "ISSUE-001", "title": "...", "severity": "...", "category": "..." }],
     "categoryScores": { "console": N, "links": N, ... }
   }
   ```

**Regression mode:** After writing the report, load the baseline file. Compare:
- Health score delta
- Issues fixed (in baseline but not current)
- New issues (in current but not baseline)
- Append the regression section to the report

---

## Health Score Rubric

Compute each category score (0-100), then take the weighted average.

### Console (weight: 15%)
- 0 errors -> 100
- 1-3 errors -> 70
- 4-10 errors -> 40
- 10+ errors -> 10

### Links (weight: 10%)
- 0 broken -> 100
- Each broken link -> -15 (minimum 0)

### Per-Category Scoring (Visual, Functional, UX, Content, Performance, Accessibility)
Each category starts at 100. Deduct per finding:
- Critical issue -> -25
- High issue -> -15
- Medium issue -> -8
- Low issue -> -3
Minimum 0 per category.

### Weights
| Category | Weight |
|----------|--------|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

### Final Score
`score = sum (category_score x weight)`

---

## Framework-Specific Guidance

### Next.js
- Check console for hydration errors (`Hydration failed`, `Text content did not match`)
- Monitor `_next/data` requests in network -- 404s indicate broken data fetching
- Test client-side navigation (click links, don't just `goto`) -- catches routing issues
- Check for CLS (Cumulative Layout Shift) on pages with dynamic content

### Rails
- Check for N+1 query warnings in console (if development mode)
- Verify CSRF token presence in forms
- Test Turbo/Stimulus integration -- do page transitions work smoothly?
- Check for flash messages appearing and dismissing correctly

### WordPress
- Check for plugin conflicts (JS errors from different plugins)
- Verify admin bar visibility for logged-in users
- Test REST API endpoints (`/wp-json/`)
- Check for mixed content warnings (common with WP)

### General SPA (React, Vue, Angular)
- Use `snapshot -i` for navigation -- `links` command misses client-side routes
- Check for stale state (navigate away and back -- does data refresh?)
- Test browser back/forward -- does the app handle history correctly?
- Check for memory leaks (monitor console after extended use)

---

## Important Rules

1. **Repro is everything.** Every issue needs at least one screenshot. No exceptions.
2. **Verify before documenting.** Retry the issue once to confirm it's reproducible, not a fluke.
3. **Never include credentials.** Write `[REDACTED]` for passwords in repro steps.
4. **Write incrementally.** Append each issue to the report as you find it. Don't batch.
5. **Never read source code.** Test as a user, not a developer.
6. **Check console after every interaction.** JS errors that don't surface visually are still bugs.
7. **Test like a user.** Use realistic data. Walk through complete workflows end-to-end.
8. **Depth over breadth.** 5-10 well-documented issues with evidence > 20 vague descriptions.
9. **Never delete output files.** Screenshots and reports accumulate -- that's intentional.
10. **Use `snapshot -C` for tricky UIs.** Finds clickable divs that the accessibility tree misses.

---

## Output Structure

```
.avadbot/qa-reports/
|-- qa-report-{domain}-{YYYY-MM-DD}.md    # Structured report
|-- screenshots/
|   |-- initial.png                        # Landing page annotated screenshot
|   |-- issue-001-step-1.png               # Per-issue evidence
|   |-- issue-001-result.png
|   +-- ...
+-- baseline.json                          # For regression mode
```

Report filenames use the domain and date: `qa-report-myapp-com-2026-03-12.md`

Record baseline health score at end of Phase 6.

---

### Phase 6.5: Fix Decision

After completing the QA baseline, present the findings and ask the user:

> Found {N} issues: {critical} critical, {high} high, {medium} medium, {low} low.
>
> **A) Fix them** — triage by tier, fix in source code with atomic commits, re-verify
> **B) Report only** — write the report and stop. No source code changes.

Use AskUserQuestion to get the user's choice.

**Shortcut:** If the user passed `--report-only` in the original request, skip the question and go directly to report mode.

**If "Report only":**
- Skip directly to Phase 10 (Report)
- Do NOT read source code, edit files, or suggest fixes in the report
- Do NOT include fix recommendations — only document what's broken
- The report should note "Mode: report-only" in the metadata

**If "Fix them":**
- Continue to Phase 7 (Triage) as normal
- If working tree is dirty: STOP — tell the user to commit or stash first

---

### Phase 7: Triage

Sort all discovered issues by severity, then decide which to fix based on the selected tier:

- **Quick:** Fix critical + high only. Mark medium/low as "deferred."
- **Standard:** Fix critical + high + medium. Mark low as "deferred."
- **Exhaustive:** Fix all, including cosmetic/low severity.

Mark issues that cannot be fixed from source code (e.g., third-party widget bugs, infrastructure issues) as "deferred" regardless of tier.

---

### Phase 8: Fix Loop

For each fixable issue, in severity order:

#### 8a. Locate source

```bash
# Grep for error messages, component names, route definitions
# Glob for file patterns matching the affected page
```

- Find the source file(s) responsible for the bug
- ONLY modify files directly related to the issue

#### 8b. Fix

- Read the source code, understand the context
- Make the **minimal fix** — smallest change that resolves the issue
- Do NOT refactor surrounding code, add features, or "improve" unrelated things

#### 8c. Commit

```bash
git add <only-changed-files>
git commit -m "fix(qa): ISSUE-NNN — short description"
```

- One commit per fix. Never bundle multiple fixes.
- Message format: `fix(qa): ISSUE-NNN — short description`

#### 8d. Re-test

- Navigate back to the affected page
- Take **before/after screenshot pair**
- Check console for errors
- Use `snapshot -D` to verify the change had the expected effect

```bash
$B goto <affected-url>
$B screenshot "$REPORT_DIR/screenshots/issue-NNN-after.png"
$B console --errors
$B snapshot -D
```

#### 8e. Classify

- **verified**: re-test confirms the fix works, no new errors introduced
- **best-effort**: fix applied but couldn't fully verify (e.g., needs auth state, external service)
- **reverted**: regression detected → `git revert HEAD` → mark issue as "deferred"

#### 8e.5. Regression Test

Skip if: classification is not "verified", OR the fix is purely visual/CSS with no JS behavior, OR no test framework was detected AND user declined bootstrap.

**1. Study the project's existing test patterns:**

Read 2-3 test files closest to the fix (same directory, same code type). Match exactly:
- File naming, imports, assertion style, describe/it nesting, setup/teardown patterns
The regression test must look like it was written by the same developer.

**2. Trace the bug's codepath, then write a regression test:**

Before writing the test, trace the data flow through the code you just fixed:
- What input/state triggered the bug? (the exact precondition)
- What codepath did it follow? (which branches, which function calls)
- Where did it break? (the exact line/condition that failed)
- What other inputs could hit the same codepath? (edge cases around the fix)

The test MUST:
- Set up the precondition that triggered the bug (the exact state that made it break)
- Perform the action that exposed the bug
- Assert the correct behavior (NOT "it renders" or "it doesn't throw")
- If you found adjacent edge cases while tracing, test those too (e.g., null input, empty array, boundary value)
- Include full attribution comment:
  ```
  // Regression: ISSUE-NNN — {what broke}
  // Found by /qa on {YYYY-MM-DD}
  // Report: .avadbot/qa-reports/qa-report-{domain}-{date}.md
  ```

Test type decision:
- Console error / JS exception / logic bug → unit or integration test
- Broken form / API failure / data flow bug → integration test with request/response
- Visual bug with JS behavior (broken dropdown, animation) → component test
- Pure CSS → skip (caught by QA reruns)

Generate unit tests. Mock all external dependencies (DB, API, Redis, file system).

Use auto-incrementing names to avoid collisions: check existing `{name}.regression-*.test.{ext}` files, take max number + 1.

**3. Run only the new test file:**

```bash
{detected test command} {new-test-file}
```

**4. Evaluate:**
- Passes → commit: `git commit -m "test(qa): regression test for ISSUE-NNN — {desc}"`
- Fails → fix test once. Still failing → delete test, defer.
- Taking >2 min exploration → skip and defer.

**5. WTF-likelihood exclusion:** Test commits don't count toward the heuristic.

#### 8f. Self-Regulation (STOP AND EVALUATE)

Every 5 fixes (or after any revert), compute the WTF-likelihood:

```
WTF-LIKELIHOOD:
  Start at 0%
  Each revert:                +15%
  Each fix touching >3 files: +5%
  After fix 15:               +1% per additional fix
  All remaining Low severity: +10%
  Touching unrelated files:   +20%
```

**If WTF > 20%:** STOP immediately. Show the user what you've done so far. Ask whether to continue.

**Hard cap: 50 fixes.** After 50 fixes, stop regardless of remaining issues.

---

### Phase 9: Final QA

After all fixes are applied:

1. Re-run QA on all affected pages
2. Compute final health score
3. **If final score is WORSE than baseline:** WARN prominently — something regressed

---

### Phase 10: Report

Write the report to both local and project-scoped locations:

**Local:** `.avadbot/qa-reports/qa-report-{domain}-{YYYY-MM-DD}.md`

**Project-scoped:** Write test outcome artifact for cross-session context:
```bash
SLUG=$(git remote get-url origin 2>/dev/null | sed 's|.*[:/]\([^/]*/[^/]*\)\.git$|\1|;s|.*[:/]\([^/]*/[^/]*\)$|\1|' | tr '/' '-')
mkdir -p ~/.avadbot/projects/$SLUG
```
Write to `~/.avadbot/projects/{slug}/{user}-{branch}-test-outcome-{datetime}.md`

**Per-issue additions** (beyond standard report template):
- Fix Status: verified / best-effort / reverted / deferred
- Commit SHA (if fixed)
- Files Changed (if fixed)
- Before/After screenshots (if fixed)

**Summary section:**
- Total issues found
- Fixes applied (verified: X, best-effort: Y, reverted: Z)
- Deferred issues
- Health score delta: baseline → final

**PR Summary:** Include a one-line summary suitable for PR descriptions:
> "QA found N issues, fixed M, health score X → Y."

---

### Phase 11: TODOS.md Update

If the repo has a `TODOS.md`:

1. **New deferred bugs** → add as TODOs with severity, category, and repro steps
2. **Fixed bugs that were in TODOS.md** → annotate with "Fixed by /qa on {branch}, {date}"

---

## Additional Rules (qa-specific)

11. **Clean working tree required for fixes.** If `git status --porcelain` is non-empty, report-only mode is allowed but fixes are blocked until the tree is clean.
12. **One commit per fix.** Never bundle multiple fixes into one commit.
13. **Only modify tests when generating regression tests in Phase 8e.5.** Never modify CI configuration. Never modify existing tests — only create new test files.
14. **Revert on regression.** If a fix makes things worse, `git revert HEAD` immediately.
15. **Self-regulate.** Follow the WTF-likelihood heuristic. When in doubt, stop and ask.
