#!/usr/bin/env bun
/**
 * Generate SKILL.md files from .tmpl templates.
 *
 * Pipeline:
 *   auto-discover *.tmpl → find {{PLACEHOLDERS}} → resolve from source → format → write .md
 *
 * Supports --dry-run: generate to memory, exit 1 if different from committed file.
 * Used by skill:check and CI freshness checks.
 */

import { COMMAND_DESCRIPTIONS } from '../skills/avad-browse/src/commands';
import { SNAPSHOT_FLAGS } from '../skills/avad-browse/src/snapshot';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const SKILLS_SCAN_DIR = path.join(ROOT, 'skills');
const TEMPLATES_SCAN_DIR = path.join(ROOT, 'skills');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Placeholder Resolvers ──────────────────────────────────

function generateCommandReference(): string {
  const groups = new Map<string, Array<{ command: string; description: string; usage?: string }>>();
  for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
    const list = groups.get(meta.category) || [];
    list.push({ command: cmd, description: meta.description, usage: meta.usage });
    groups.set(meta.category, list);
  }

  const categoryOrder = [
    'Navigation', 'Reading', 'Interaction', 'Inspection',
    'Visual', 'Snapshot', 'Meta', 'Tabs', 'Server',
  ];

  const sections: string[] = [];
  for (const category of categoryOrder) {
    const commands = groups.get(category);
    if (!commands || commands.length === 0) continue;

    commands.sort((a, b) => a.command.localeCompare(b.command));

    sections.push(`### ${category}`);
    sections.push('| Command | Description |');
    sections.push('|---------|-------------|');
    for (const cmd of commands) {
      const display = cmd.usage ? `\`${cmd.usage}\`` : `\`${cmd.command}\``;
      sections.push(`| ${display} | ${cmd.description} |`);
    }
    sections.push('');
  }

  return sections.join('\n').trimEnd();
}

function generateSnapshotFlags(): string {
  const lines: string[] = [
    'The snapshot is your primary tool for understanding and interacting with pages.',
    '',
    '```',
  ];

  for (const flag of SNAPSHOT_FLAGS) {
    const label = flag.valueHint ? `${flag.short} ${flag.valueHint}` : flag.short;
    lines.push(`${label.padEnd(10)}${flag.long.padEnd(24)}${flag.description}`);
  }

  lines.push('```');
  lines.push('');
  lines.push('All flags can be combined freely. `-o` only applies when `-a` is also used.');
  lines.push('Example: `$B snapshot -i -a -C -o /tmp/annotated.png`');
  lines.push('');
  lines.push('**Ref numbering:** @e refs are assigned sequentially (@e1, @e2, ...) in tree order.');
  lines.push('@c refs from `-C` are numbered separately (@c1, @c2, ...).');
  lines.push('');
  lines.push('After snapshot, use @refs as selectors in any command:');
  lines.push('```bash');
  lines.push('$B click @e3       $B fill @e4 "value"     $B hover @e1');
  lines.push('$B html @e2        $B css @e5 "color"      $B attrs @e6');
  lines.push('$B click @c1       # cursor-interactive ref (from -C)');
  lines.push('```');
  lines.push('');
  lines.push('**Output format:** indented accessibility tree with @ref IDs, one element per line.');
  lines.push('```');
  lines.push('  @e1 [heading] "Welcome" [level=1]');
  lines.push('  @e2 [textbox] "Email"');
  lines.push('  @e3 [button] "Submit"');
  lines.push('```');
  lines.push('');
  lines.push('Refs are invalidated on navigation \u2014 run `snapshot` again after `goto`.');

  return lines.join('\n');
}

function generateBrowseSetup(): string {
  return `## SETUP (run this check BEFORE any browse command)

\`\`\`bash
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
\`\`\`

If \`NEEDS_SETUP\`:
1. Tell the user: "avadbot browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: \`cd <SKILL_DIR> && ./setup\`
3. If \`bun\` is not installed: \`curl -fsSL https://bun.sh/install | bash\``;
}

function generateQAMethodology(): string {
  return fs.readFileSync(path.join(ROOT, 'references', 'qa-methodology.md'), 'utf-8').trimEnd();
}

function generateVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  return pkg.version;
}

function generateSkillList(): string {
  const skills = discoverSkills();
  const lines: string[] = [
    '| Skill | Description |',
    '|-------|-------------|',
  ];

  for (const skillDir of skills) {
    const skillPath = path.join(SKILLS_SCAN_DIR, skillDir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*\|?\s*\n\s+(.+)$/m) ||
                      content.match(/^description:\s*(.+)$/m);

    const name = nameMatch ? nameMatch[1].trim() : skillDir;
    const desc = descMatch ? descMatch[1].trim() : '';

    lines.push(`| \`/${name}\` | ${desc} |`);
  }

  return lines.join('\n');
}

function generateTestBootstrap(): string {
  return `## Test Framework Bootstrap

Before running tests, check for the opt-out marker:

\`\`\`bash
[ -f .avadbot/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED" || echo "BOOTSTRAP_OK"
\`\`\`

If \`BOOTSTRAP_DECLINED\`: skip test bootstrap entirely.

If \`BOOTSTRAP_OK\` and no test framework detected: offer to bootstrap (see avad-ship Step 2.75 for the full bootstrap procedure). If user declines, write \`.avadbot/no-test-bootstrap\` and continue.`;
}

function generateDesignMethodology(): string {
  return `## Design Methodology

Design review state is stored per-project under \`~/.avadbot/projects/$SLUG/\`.

Design reports are stored under \`.avadbot/design-reports/\` in the project root.

When running design review:
1. Read \`DESIGN.md\` at the project root (if it exists) — this is the source of truth for the design system.
2. Screenshots go to \`.avadbot/design-reports/<branch>-<timestamp>/\`.
3. Compare screenshots against the DESIGN.md spec. Flag deviations, not preferences.
4. Only flag issues you can see in the screenshot or verify in the diff. Never flag hypothetical issues.`;
}

function generateBaseBranchDetect(): string {
  return `## Base Branch Detection

\`\`\`bash
# Detect base branch (prefer configured, fall back to common defaults)
BASE=""
[ -f docs/GIT_WORKFLOW.md ] && BASE=$(grep -m1 'target.*branch\\|integration.*branch\\|base.*branch' docs/GIT_WORKFLOW.md | grep -oE '(main|master|dev|develop|trunk)' | head -1)
[ -z "$BASE" ] && BASE=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
[ -z "$BASE" ] && BASE=$(git branch -r | grep -E 'origin/(main|master|dev|develop|trunk)' | head -1 | sed 's|origin/||' | tr -d ' ')
[ -z "$BASE" ] && BASE="main"
echo "Base branch: $BASE"
\`\`\``;
}

function generateReviewDashboard(): string {
  return `## Review Readiness Dashboard

\`\`\`bash
SLUG=$(basename "$(git remote get-url origin 2>/dev/null)" .git 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current | tr '/' '-')
cat ~/.avadbot/projects/$SLUG/$BRANCH-reviews.jsonl 2>/dev/null || echo "NO_REVIEWS"
\`\`\`

Parse the JSONL output. Find the most recent entry for each skill. Display the dashboard and log review runs to:

\`\`\`bash
~/.avadbot/projects/$SLUG/$BRANCH-reviews.jsonl
\`\`\``;
}

const RESOLVERS: Record<string, () => string> = {
  COMMAND_REFERENCE: generateCommandReference,
  SNAPSHOT_FLAGS: generateSnapshotFlags,
  BROWSE_SETUP: generateBrowseSetup,
  QA_METHODOLOGY: generateQAMethodology,
  VERSION: generateVersion,
  SKILL_LIST: generateSkillList,
  TEST_BOOTSTRAP: generateTestBootstrap,
  DESIGN_METHODOLOGY: generateDesignMethodology,
  BASE_BRANCH_DETECT: generateBaseBranchDetect,
  REVIEW_DASHBOARD: generateReviewDashboard,
};

// ─── Template Discovery ─────────────────────────────────────

function discoverSkills(): string[] {
  const entries = fs.readdirSync(SKILLS_SCAN_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && fs.existsSync(path.join(SKILLS_SCAN_DIR, e.name, 'SKILL.md')))
    .map(e => e.name)
    .sort();
}

function discoverTemplates(): string[] {
  const templates: string[] = [];
  const entries = fs.readdirSync(TEMPLATES_SCAN_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      // Root-level template
      if (entry.name.endsWith('.tmpl')) {
        templates.push(path.join(TEMPLATES_SCAN_DIR, entry.name));
      }
      continue;
    }

    // Skill directory template
    const tmplPath = path.join(TEMPLATES_SCAN_DIR, entry.name, 'SKILL.md.tmpl');
    if (fs.existsSync(tmplPath)) {
      templates.push(tmplPath);
    }
  }

  return templates.sort();
}

// ─── Template Processing ────────────────────────────────────

const GENERATED_HEADER = `<!-- AUTO-GENERATED from {{SOURCE}} \u2014 do not edit directly -->\n<!-- Regenerate: bun run gen:skill-docs -->\n`;

function processTemplate(tmplPath: string): { outputPath: string; content: string } {
  const tmplContent = fs.readFileSync(tmplPath, 'utf-8');
  const relTmplPath = path.relative(ROOT, tmplPath);
  const outputPath = tmplPath.replace(/\.tmpl$/, '');

  // Replace placeholders
  let content = tmplContent.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    const resolver = RESOLVERS[name];
    if (!resolver) throw new Error(`Unknown placeholder {{${name}}} in ${relTmplPath}`);
    return resolver();
  });

  // Check for any remaining unresolved placeholders
  const remaining = content.match(/\{\{(\w+)\}\}/g);
  if (remaining) {
    throw new Error(`Unresolved placeholders in ${relTmplPath}: ${remaining.join(', ')}`);
  }

  // Prepend generated header (after frontmatter)
  const header = GENERATED_HEADER.replace('{{SOURCE}}', path.basename(tmplPath));
  const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
  if (fmEnd !== -1) {
    const insertAt = content.indexOf('\n', fmEnd) + 1;
    content = content.slice(0, insertAt) + header + content.slice(insertAt);
  } else {
    content = header + content;
  }

  return { outputPath, content };
}

// ─── Main ───────────────────────────────────────────────────

const templates = discoverTemplates();

if (templates.length === 0) {
  console.log('No .tmpl files found.');
  process.exit(0);
}

let hasChanges = false;

for (const tmplPath of templates) {
  const { outputPath, content } = processTemplate(tmplPath);
  const relOutput = path.relative(ROOT, outputPath);

  if (DRY_RUN) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';
    if (existing !== content) {
      console.log(`STALE: ${relOutput}`);
      hasChanges = true;
    } else {
      console.log(`FRESH: ${relOutput}`);
    }
  } else {
    fs.writeFileSync(outputPath, content);
    console.log(`GENERATED: ${relOutput}`);
  }
}

if (DRY_RUN && hasChanges) {
  console.error('\nGenerated SKILL.md files are stale. Run: bun run gen:skill-docs');
  process.exit(1);
}
