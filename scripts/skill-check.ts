#!/usr/bin/env bun
/**
 * skill:check — Health dashboard for all avadbot SKILL.md files.
 *
 * Reports:
 *   - Frontmatter validation (name, description, version)
 *   - Browse command validation (valid/invalid/snapshot errors)
 *   - Template coverage (which SKILL.md files have .tmpl sources)
 *   - Freshness check (generated files match committed files)
 *   - Dead reference detection (files referenced in SKILL.md but missing)
 */

import { validateSkill } from '../test/helpers/skill-parser';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(import.meta.dir, '..');
const SKILLS_SCAN_DIR = ROOT;

let hasErrors = false;

// ─── Auto-discover skills ───────────────────────────────────

function discoverSkills(): Array<{ dir: string; name: string; hasTmpl: boolean }> {
  const entries = fs.readdirSync(SKILLS_SCAN_DIR, { withFileTypes: true });
  const skills: Array<{ dir: string; name: string; hasTmpl: boolean }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(SKILLS_SCAN_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : entry.name;
    const hasTmpl = fs.existsSync(path.join(SKILLS_SCAN_DIR, entry.name, 'SKILL.md.tmpl'));

    skills.push({ dir: entry.name, name, hasTmpl });
  }

  return skills.sort((a, b) => a.dir.localeCompare(b.dir));
}

const skills = discoverSkills();

if (skills.length === 0) {
  console.error(`ERROR: No skills found in ${SKILLS_SCAN_DIR}/*/SKILL.md`);
  console.error('Expected: avad-ship, avad-review, avad-qa, browse, ...');
  process.exit(1);
}

// ─── Frontmatter Validation ─────────────────────────────────

console.log('  Frontmatter:');
for (const skill of skills) {
  const content = fs.readFileSync(path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md'), 'utf-8');
  const issues: string[] = [];

  if (!content.startsWith('---\n')) issues.push('missing frontmatter');
  if (!/^name:\s*.+$/m.test(content)) issues.push('missing name');
  if (!/^description:\s*.+$/m.test(content)) issues.push('missing description');

  const nameMatch = content.match(/^name:\s*(.+)$/m);
  if (nameMatch && nameMatch[1].trim() !== skill.dir) {
    issues.push(`name mismatch: frontmatter "${nameMatch[1].trim()}" vs dir "${skill.dir}"`);
  }

  if (issues.length > 0) {
    hasErrors = true;
    console.log(`  \u274c ${skill.dir.padEnd(30)} \u2014 ${issues.join(', ')}`);
  } else {
    console.log(`  \u2705 ${skill.dir.padEnd(30)} \u2014 OK`);
  }
}

// ─── Browse Command Validation ──────────────────────────────

console.log('\n  Browse commands:');
for (const skill of skills) {
  const skillPath = path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md');
  const result = validateSkill(skillPath);

  if (result.warnings.length > 0) {
    console.log(`  \u26a0\ufe0f  ${skill.dir.padEnd(30)} \u2014 ${result.warnings.join(', ')}`);
    continue;
  }

  const totalValid = result.valid.length;
  const totalInvalid = result.invalid.length;
  const totalSnapErrors = result.snapshotFlagErrors.length;

  if (totalInvalid > 0 || totalSnapErrors > 0) {
    hasErrors = true;
    console.log(`  \u274c ${skill.dir.padEnd(30)} \u2014 ${totalValid} valid, ${totalInvalid} invalid, ${totalSnapErrors} snapshot errors`);
    for (const inv of result.invalid) {
      console.log(`      line ${inv.line}: unknown command '${inv.command}'`);
    }
    for (const se of result.snapshotFlagErrors) {
      console.log(`      line ${se.command.line}: ${se.error}`);
    }
  } else {
    console.log(`  \u2705 ${skill.dir.padEnd(30)} \u2014 ${totalValid} commands, all valid`);
  }
}

// ─── Templates ──────────────────────────────────────────────

console.log('\n  Templates:');
for (const skill of skills) {
  if (skill.hasTmpl) {
    const outPath = path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md');
    if (!fs.existsSync(outPath)) {
      hasErrors = true;
      console.log(`  \u274c ${skill.dir.padEnd(30)} \u2014 .tmpl exists but SKILL.md missing! Run: bun run gen:skill-docs`);
    } else {
      console.log(`  \u2705 ${skill.dir.padEnd(30)} \u2014 SKILL.md.tmpl \u2192 SKILL.md`);
    }
  } else {
    console.log(`  \u26a0\ufe0f  ${skill.dir.padEnd(30)} \u2014 no template (hand-maintained)`);
  }
}

// ─── Dead References ────────────────────────────────────────

console.log('\n  Dead references:');
let deadRefCount = 0;
for (const skill of skills) {
  const skillPath = path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf-8');

  // Find relative file references — must end with a file extension (e.g., .md, .ts, .json)
  const refMatches = content.matchAll(/(?:^|\s|`)([a-zA-Z][\w-]*\/[\w-]+(?:\/[\w.-]+)*\/[\w.-]+\.\w{1,10})(?:`|\s|$)/gm);
  for (const m of refMatches) {
    const ref = m[1];
    // Try resolving relative to skill dir first, then ROOT
    const fromSkill = path.join(SKILLS_SCAN_DIR, skill.dir, ref);
    const fromRoot = path.join(ROOT, ref);
    if (!fs.existsSync(fromSkill) && !fs.existsSync(fromRoot)) {
      if (!ref.includes('://') && !ref.startsWith('http') && !ref.includes('.com/')) {
        hasErrors = true;
        deadRefCount++;
        console.log(`  \u274c ${skill.dir.padEnd(30)} \u2014 dead ref: ${ref}`);
      }
    }
  }
}
if (deadRefCount === 0) {
  console.log('  \u2705 No dead references found');
}

// ─── Freshness ──────────────────────────────────────────────

console.log('\n  Freshness:');
const templatedSkills = skills.filter(s => s.hasTmpl);
if (templatedSkills.length === 0) {
  console.log('  \u26a0\ufe0f  No templates to check');
} else {
  try {
    execSync('bun run scripts/gen-skill-docs.ts --dry-run', { cwd: ROOT, stdio: 'pipe' });
    console.log('  \u2705 All generated files are fresh');
  } catch (err: any) {
    hasErrors = true;
    const output = err.stdout?.toString() || '';
    console.log('  \u274c Generated files are stale:');
    for (const line of output.split('\n').filter((l: string) => l.startsWith('STALE'))) {
      console.log(`      ${line}`);
    }
    console.log('      Run: bun run gen:skill-docs');
  }
}

console.log('');
process.exit(hasErrors ? 1 : 0);
