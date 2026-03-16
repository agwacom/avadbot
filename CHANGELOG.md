# Avad Skills Changelog

## 2026-03-15

### Decisions & Discussion

- **Skills must be flat** — Claude Code only discovers skills directly under `~/.claude/skills/`, not nested in package subdirectories. Exception: gstack works as a package because it has a root `SKILL.md`, but sub-skills (`gstack:qa`) are NOT individually invocable.

- **Renamed avad-land → avad-ship** — better reflects the workflow purpose.

- **avad-ship enhancements** (taken from gstack-fork/ship):
  - Bisectable commits — split in logical order (infra → models → controllers → VERSION+CHANGELOG)
  - Auto version bump — finds version in VERSION / package.json / pyproject.toml / Cargo.toml. Creates VERSION if none found. PATCH/MINOR auto, MAJOR asks user.
  - Auto CHANGELOG — creates CHANGELOG.md if not exists, auto-generates entry from diff.

- **avad-review enhancements**:
  - Bot triage now generic — supports Greptile, CodeRabbit, SonarCloud, any bot (not just Greptile)
  - Added suppressions system — reads `~/.avadbot/projects/<repo>/bot-review-history.md` to auto-skip known false positives
  - History writes to two files: per-project (for suppressions) + global `~/.avadbot/bot-review-history.md` (for retro)

- **Review checklist path changed** — from `.claude/avad/review-checklist.md` (inside project) to `~/.avadbot/projects/<repo>/review-checklist.md` (centralized with other per-project data)

- **Namespace: `~/.avadbot/`** — chosen over `~/.avad/` to avoid confusion with the machine username `avad`.

- **Frontmatter: `version` and `allowed-tools`** — not supported by Claude Code (warnings), but kept anyway for future use / internal tooling.

- **License** — MIT. Dual copyright: original gstack (Garry Tan) + avadbot (avad). Required by MIT to keep original notice.

### Resolved Questions

- **Standalone vs package?** → Standalone skills. Decided by practice — Claude Code discovers flat skills, not nested packages.
- **Clean up old gstack sub-skills from `~/.claude/skills/` root?** → Yes, cleaned up. avadbot skills replace them.
- **Delete `oldbackup/gstack/`?** → Yes, deleted. avadbot is the canonical version.
- **Remove `gstack` from `~/.claude/skills/`?** → Yes, removed. avadbot skills are the active install.
