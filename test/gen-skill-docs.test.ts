/**
 * Template generation quality tests.
 *
 * Validates:
 * - Generated SKILL.md files have correct structure
 * - All templates produce valid output
 * - No unresolved placeholders remain
 * - Generated files are fresh (match --dry-run)
 * - Command reference is complete and sorted
 */

import { describe, test, expect } from 'bun:test';
import { ALL_COMMANDS, COMMAND_DESCRIPTIONS } from '../browse/src/commands';
import { SNAPSHOT_FLAGS } from '../browse/src/snapshot';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(import.meta.dir, '..');

function discoverTemplates(): Array<{ tmpl: string; output: string; dir: string }> {
  const templates: Array<{ tmpl: string; output: string; dir: string }> = [];
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tmplPath = path.join(ROOT, entry.name, 'SKILL.md.tmpl');
    if (fs.existsSync(tmplPath)) {
      templates.push({
        tmpl: tmplPath,
        output: path.join(ROOT, entry.name, 'SKILL.md'),
        dir: entry.name,
      });
    }
  }

  return templates;
}

function discoverAllSkills(): string[] {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && fs.existsSync(path.join(ROOT, e.name, 'SKILL.md')))
    .map(e => e.name)
    .sort();
}

const TEMPLATES = discoverTemplates();
const ALL_SKILLS = discoverAllSkills();

describe('Template generation output', () => {
  for (const tmpl of TEMPLATES) {
    test(`${tmpl.dir}/SKILL.md exists and has AUTO-GENERATED header`, () => {
      expect(fs.existsSync(tmpl.output)).toBe(true);
      const content = fs.readFileSync(tmpl.output, 'utf-8');
      expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
      expect(content).toContain('Regenerate: bun run gen:skill-docs');
    });

    test(`${tmpl.dir}/SKILL.md has no unresolved placeholders`, () => {
      const content = fs.readFileSync(tmpl.output, 'utf-8');
      const unresolved = content.match(/\{\{[A-Z_]+\}\}/g);
      expect(unresolved).toBeNull();
    });

    test(`${tmpl.dir}/SKILL.md.tmpl contains at least one placeholder`, () => {
      const content = fs.readFileSync(tmpl.tmpl, 'utf-8');
      const placeholders = content.match(/\{\{[A-Z_]+\}\}/g);
      expect(placeholders).not.toBeNull();
      expect(placeholders!.length).toBeGreaterThan(0);
    });

    test(`${tmpl.dir}/SKILL.md has valid YAML frontmatter`, () => {
      const content = fs.readFileSync(tmpl.output, 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain('name:');
      expect(content).toContain('description:');
    });
  }
});

describe('Freshness check', () => {
  test('generated files match --dry-run output', () => {
    try {
      execSync('bun run scripts/gen-skill-docs.ts --dry-run', { cwd: ROOT, stdio: 'pipe' });
    } catch (err: any) {
      const output = err.stdout?.toString() || '';
      const staleFiles = output.split('\n').filter((l: string) => l.startsWith('STALE'));
      expect(staleFiles).toHaveLength(0);
    }
  });
});

describe('Command reference quality', () => {
  // Only run if browse/SKILL.md exists (has COMMAND_REFERENCE)
  const browsePath = path.join(ROOT, 'browse', 'SKILL.md');
  if (!fs.existsSync(browsePath)) return;
  const browseContent = fs.readFileSync(browsePath, 'utf-8');

  test('contains all command categories', () => {
    const categories = new Set(Object.values(COMMAND_DESCRIPTIONS).map(d => d.category));
    for (const cat of categories) {
      expect(browseContent).toContain(`### ${cat}`);
    }
  });

  test('contains all commands', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(browseContent).toContain(`\`${cmd}`);
    }
  });

  test('command tables are sorted alphabetically within categories', () => {
    // Extract command names from table rows
    const tableRows = browseContent.matchAll(/^\| `(\w[\w-]*)(?:\s|`)/gm);
    const commands: string[] = [];
    let lastCategory = '';

    for (const line of browseContent.split('\n')) {
      if (line.startsWith('### ')) {
        // New category — reset
        if (commands.length > 1) {
          const sorted = [...commands].sort();
          expect(commands).toEqual(sorted);
        }
        commands.length = 0;
        lastCategory = line;
      }
      const match = line.match(/^\| `(\w[\w-]*)(?:\s|`)/);
      if (match) {
        commands.push(match[1]);
      }
    }
    // Check last category
    if (commands.length > 1) {
      const sorted = [...commands].sort();
      expect(commands).toEqual(sorted);
    }
  });

  test('all command descriptions have meaningful length', () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description.length).toBeGreaterThanOrEqual(8);
    }
  });

  test('no command description contains pipe character', () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description).not.toContain('|');
    }
  });
});

describe('Snapshot flags quality', () => {
  const browsePath = path.join(ROOT, 'browse', 'SKILL.md');
  if (!fs.existsSync(browsePath)) return;
  const browseContent = fs.readFileSync(browsePath, 'utf-8');

  test('contains all snapshot flags', () => {
    for (const flag of SNAPSHOT_FLAGS) {
      expect(browseContent).toContain(flag.short);
      expect(browseContent).toContain(flag.long);
    }
  });

  test('flags with values include value hints', () => {
    for (const flag of SNAPSHOT_FLAGS) {
      if (flag.takesValue && flag.valueHint) {
        expect(browseContent).toContain(flag.valueHint);
      }
    }
  });

  test('all snapshot flag descriptions have meaningful length', () => {
    for (const flag of SNAPSHOT_FLAGS) {
      expect(flag.description.length).toBeGreaterThanOrEqual(10);
    }
  });
});
