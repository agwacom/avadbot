#!/usr/bin/env bun
/**
 * dev:skill — Watch mode for SKILL.md template development.
 *
 * Auto-discovers .tmpl files, regenerates SKILL.md on change,
 * validates all $B commands immediately.
 */

import { validateSkill } from '../test/helpers/skill-parser';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── Auto-discover templates ────────────────────────────────

function discoverTemplates(): Array<{ tmpl: string; output: string }> {
  const templates: Array<{ tmpl: string; output: string }> = [];
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tmplPath = path.join(ROOT, entry.name, 'SKILL.md.tmpl');
    if (fs.existsSync(tmplPath)) {
      templates.push({
        tmpl: tmplPath,
        output: `${entry.name}/SKILL.md`,
      });
    }
  }

  return templates.sort((a, b) => a.output.localeCompare(b.output));
}

const TEMPLATES = discoverTemplates();

function regenerateAndValidate() {
  // Regenerate
  try {
    execSync('bun run scripts/gen-skill-docs.ts', { cwd: ROOT, stdio: 'pipe' });
  } catch (err: any) {
    console.log(`  [gen]   ERROR: ${err.stderr?.toString().trim() || err.message}`);
    return;
  }

  // Validate each generated file
  for (const { output } of TEMPLATES) {
    const fullPath = path.join(ROOT, output);
    if (!fs.existsSync(fullPath)) continue;

    const result = validateSkill(fullPath);
    const totalValid = result.valid.length;
    const totalInvalid = result.invalid.length;
    const totalSnapErrors = result.snapshotFlagErrors.length;

    if (result.warnings.length > 0) {
      console.log(`  [check] \u26a0\ufe0f  ${output} \u2014 ${result.warnings.join(', ')}`);
    } else if (totalInvalid > 0 || totalSnapErrors > 0) {
      console.log(`  [check] \u274c ${output} (${totalValid} valid)`);
      for (const inv of result.invalid) {
        console.log(`          Unknown command: '${inv.command}' at line ${inv.line}`);
      }
      for (const se of result.snapshotFlagErrors) {
        console.log(`          ${se.error} at line ${se.command.line}`);
      }
    } else {
      console.log(`  [check] \u2705 ${output} \u2014 ${totalValid} commands, all valid`);
    }
  }
}

// Initial run
console.log(`  [watch] Found ${TEMPLATES.length} template(s):`);
for (const { output } of TEMPLATES) {
  console.log(`          ${output}`);
}
console.log('');
regenerateAndValidate();

// Watch template files
for (const { tmpl } of TEMPLATES) {
  if (!fs.existsSync(tmpl)) continue;
  fs.watch(tmpl, () => {
    console.log(`\n  [watch] ${path.relative(ROOT, tmpl)} changed`);
    regenerateAndValidate();
  });
}

// Watch source files (browse command registry)
const SOURCE_FILES = [
  path.join(ROOT, 'browse', 'src', 'commands.ts'),
  path.join(ROOT, 'browse', 'src', 'snapshot.ts'),
];

for (const src of SOURCE_FILES) {
  if (!fs.existsSync(src)) continue;
  fs.watch(src, () => {
    console.log(`\n  [watch] ${path.relative(ROOT, src)} changed`);
    regenerateAndValidate();
  });
}

console.log('\n  [watch] Press Ctrl+C to stop\n');
