# Review Checklist Seed

Use this file as a **bootstrap taxonomy**, not as the final checklist.

When generating `~/.avadbot/projects/<repo>/review-checklist.md`:
- Start from these categories and suppressions.
- Prune anything irrelevant to the project.
- Rename categories to match the project's actual risks and vocabulary.
- Add project-specific categories and suppressions from `CLAUDE.md`, `AGENTS.md`, architecture docs, and the codebase.
- Never copy this seed verbatim as the final checklist.

---

## Pass 1 — Critical Seed Categories

### SQL & Data Safety
- String interpolation in SQL or ad-hoc query building that should use parameter binding or query builders
- Read-modify-write patterns that should be atomic updates
- Validation-bypassing writes on fields that need constraints
- Query fanout or missing eager loading on hot paths

### Race Conditions & Concurrency
- Check-then-set patterns without uniqueness or retry handling
- Non-atomic state transitions
- Duplicate creation risks in retryable or concurrent paths
- Trusting stale reads for decisions that mutate shared state

### LLM Output Trust Boundary
- Persisting model output without shape or format validation
- Passing model-generated values into external systems without lightweight guards
- Using structured tool output without type checks or required-key checks

## Pass 2 — Informational Seed Categories

### Conditional Side Effects
- Branches that skip a required side effect
- Logs that imply work happened when it did not

### Magic Numbers & String Coupling
- Repeated literals that should be shared constants
- Strings used as both display text and programmatic contract

### Dead Code & Consistency
- Variables assigned but unused
- Docs/comments/changelogs describing stale behavior
- Version or release metadata that does not match the code

### LLM Prompt Issues
- Prompt instructions that drift from actual tool wiring
- Inconsistent token or word limits
- Prompt formatting that nudges unreliable outputs

### Test Gaps
- Missing negative-path assertions
- Missing checks for important side effects
- Missing integration coverage for security or enforcement paths

### Crypto & Entropy
- Weak randomness for security-sensitive values
- Secret comparisons that are not constant-time where they should be
- Truncation where hashing or signing is required

### Time Window Safety
- Date-bucket logic that misses partial-day behavior
- Related features using mismatched window semantics

### Type Coercion At Boundaries
- Cross-language or JSON boundary values that can silently change type
- Hash or digest inputs without canonical normalization

### View / Frontend
- Hot-path inline styles or expensive render-time lookups
- Filtering in memory where query-time filtering is expected
- Frontend logic that hides state or failure without observability

## Default Suppressions Seed

- Harmless readability redundancy when behavior is already clear
- Consistency-only style suggestions with no behavioral risk
- Threshold tuning comments that are likely to rot
- Issues already addressed elsewhere in the same diff
- Known-safe no-ops that do not affect correctness
