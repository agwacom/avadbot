# Bot Triage Reply Templates

Shared reference for replying to automated bot review comments (Greptile, CodeRabbit, etc.) on GitHub PRs. Used by `/avadbot:avad-review` (Step 2.5) and `/avadbot:avad-ship` (Step 3.75).

---

## Escalation Detection

Before composing a reply, check if a prior avadbot reply already exists on this comment thread:

1. **For line-level comments:** Fetch replies via `gh api repos/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies`. Check if any reply body contains avadbot markers: `**Fixed**`, `**Not a bug.**`, `**Already fixed**`.

2. **For top-level comments:** Scan issue comments for replies posted after the bot comment that contain avadbot markers.

3. **If a prior avadbot reply exists AND the bot posted again on the same file+category:** Use Tier 2 (firm) templates.

4. **If no prior avadbot reply exists:** Use Tier 1 (friendly) templates.

If escalation detection fails (API error, ambiguous thread): default to Tier 1. Never escalate on ambiguity.

---

## Reply Templates

### Tier 1 — First Response (Friendly, evidence-included)

**For FIXES (issue was fixed):**

```
**Fixed** in `<commit-sha>`.

\`\`\`diff
- <old problematic line(s)>
+ <new fixed line(s)>
\`\`\`

**Why:** <1-sentence explanation of what was wrong and how the fix addresses it>
```

**For ALREADY FIXED (addressed in a prior commit on this branch):**

```
**Already fixed** in `<commit-sha>`.

**What was done:** <1-2 sentences describing how the existing commit addresses this issue>
```

**For FALSE POSITIVES (the comment is incorrect):**

```
**Not a bug.** <1 sentence directly stating why this is incorrect>

**Evidence:**
- <specific code reference showing the pattern is safe/correct>
- <e.g., "The nil check is handled by X which raises Y, not returns nil">

**Suggested re-rank:** This appears to be a `<style|noise|misread>` issue, not a `<what the bot called it>`. Consider lowering severity.
```

---

### Tier 2 — Re-flagged Issue (Firm, overwhelming evidence)

Use when escalation detection identifies a prior avadbot reply on the same thread and the bot re-flagged the same issue.

```
**This has been reviewed and confirmed as [intentional/already-fixed/not-a-bug].**

\`\`\`diff
<full relevant diff showing the change or safe pattern>
\`\`\`

**Evidence chain:**
1. <file:line permalink showing the safe pattern or fix>
2. <commit SHA where it was addressed, if applicable>
3. <architecture rationale or design decision, if applicable>

**Suggested re-rank:** Please recalibrate — this is a `<actual category>` issue, not `<claimed category>`.
```

---

## Severity Re-ranking

When classifying comments, assess whether the bot's implied severity matches reality:

- If flagged as **security/correctness/race-condition** but actually a **style/performance** nit: include `**Suggested re-rank:**` in the reply.
- Always be specific — cite code and line numbers, not opinions.
