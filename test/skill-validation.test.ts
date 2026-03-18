/**
 * avadbot skill validation tests.
 *
 * Validates SKILL.md files across all avadbot skills:
 * - Browse commands are valid
 * - Snapshot flags are recognized
 * - Command registry is consistent
 * - YAML frontmatter is valid
 * - QA skill structure is complete
 * - Planted-bug fixtures are well-formed
 */

import { describe, test, expect } from 'bun:test';
import { validateSkill, extractWeightsFromTable } from './helpers/skill-parser';
import { ALL_COMMANDS, COMMAND_DESCRIPTIONS, READ_COMMANDS, WRITE_COMMANDS, META_COMMANDS } from '../skills/browse/src/commands';
import { SNAPSHOT_FLAGS } from '../skills/browse/src/snapshot';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const SKILLS_SCAN_DIR = path.join(ROOT, 'skills');

// All avadbot skills that contain $B browse commands
const BROWSE_SKILLS = [
  { dir: 'browse', name: 'browse' },
  { dir: 'avad-qa', name: 'avad-qa' },
];

// Auto-discover all avadbot skills (dirs with SKILL.md)
function discoverAllSkills(): Array<{ dir: string; name: string }> {
  const entries = fs.readdirSync(SKILLS_SCAN_DIR, { withFileTypes: true });
  const skills: Array<{ dir: string; name: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(SKILLS_SCAN_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : entry.name;
    skills.push({ dir: entry.name, name });
  }

  return skills.sort((a, b) => a.dir.localeCompare(b.dir));
}

const ALL_SKILLS = discoverAllSkills();

describe('SKILL.md command validation', () => {
  for (const skill of BROWSE_SKILLS) {
    const skillPath = path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    test(`all $B commands in ${skill.name}/SKILL.md are valid`, () => {
      const result = validateSkill(skillPath);
      expect(result.invalid).toHaveLength(0);
    });

    test(`all snapshot flags in ${skill.name}/SKILL.md are valid`, () => {
      const result = validateSkill(skillPath);
      expect(result.snapshotFlagErrors).toHaveLength(0);
    });
  }
});

describe('Command registry consistency', () => {
  test('COMMAND_DESCRIPTIONS covers all commands in sets', () => {
    const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
    for (const cmd of allCmds) {
      expect(descKeys.has(cmd)).toBe(true);
    }
  });

  test('COMMAND_DESCRIPTIONS has no extra commands not in sets', () => {
    const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    for (const key of Object.keys(COMMAND_DESCRIPTIONS)) {
      expect(allCmds.has(key)).toBe(true);
    }
  });

  test('ALL_COMMANDS matches union of all sets', () => {
    const union = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    expect(ALL_COMMANDS.size).toBe(union.size);
    for (const cmd of union) {
      expect(ALL_COMMANDS.has(cmd)).toBe(true);
    }
  });

  test('SNAPSHOT_FLAGS option keys are valid SnapshotOptions fields', () => {
    const validKeys = new Set([
      'interactive', 'compact', 'depth', 'selector',
      'diff', 'annotate', 'outputPath', 'cursorInteractive',
    ]);
    for (const flag of SNAPSHOT_FLAGS) {
      expect(validKeys.has(flag.optionKey)).toBe(true);
    }
  });
});

describe('SKILL.md frontmatter validation', () => {
  for (const skill of ALL_SKILLS) {
    test(`${skill.name}/SKILL.md has valid YAML frontmatter`, () => {
      const content = fs.readFileSync(path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md'), 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain('name:');
      expect(content).toContain('description:');
    });

    test(`${skill.dir}/SKILL.md frontmatter name matches directory name`, () => {
      const content = fs.readFileSync(path.join(SKILLS_SCAN_DIR, skill.dir, 'SKILL.md'), 'utf-8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      expect(nameMatch).not.toBeNull();
      expect(nameMatch![1].trim()).toBe(skill.dir);
    });
  }
});

describe('QA skill structure validation', () => {
  const qaPath = path.join(SKILLS_SCAN_DIR, 'avad-qa', 'SKILL.md');
  if (!fs.existsSync(qaPath)) return;
  const qaContent = fs.readFileSync(qaPath, 'utf-8');

  test('has all QA modes defined', () => {
    const modes = ['Diff-aware', 'Full', 'Quick', 'Regression'];
    for (const mode of modes) {
      expect(qaContent).toContain(mode);
    }
  });

  test('health score weights sum to 100% (if defined)', () => {
    const weights = extractWeightsFromTable(qaContent);
    if (weights.size > 0) {
      let sum = 0;
      for (const pct of weights.values()) {
        sum += pct;
      }
      expect(sum).toBe(100);
    }
  });
});

describe('Planted-bug fixture validation', () => {
  const fixtures = [
    { file: 'qa-eval-ground-truth.json', name: 'static' },
    { file: 'qa-eval-spa-ground-truth.json', name: 'SPA' },
    { file: 'qa-eval-checkout-ground-truth.json', name: 'checkout' },
  ];

  for (const fixture of fixtures) {
    test(`${fixture.name} ground truth has exactly 5 planted bugs`, () => {
      const groundTruth = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'test', 'fixtures', fixture.file), 'utf-8')
      );
      expect(groundTruth.bugs).toHaveLength(5);
      expect(groundTruth.total_bugs).toBe(5);
    });
  }

  test('review-eval-vuln.rb contains expected vulnerability patterns', () => {
    const content = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'review-eval-vuln.rb'), 'utf-8');
    expect(content).toContain('params[:id]');
    expect(content).toContain('update_column');
  });
});

describe('plugin.json validation', () => {
  test('plugin.json is valid', () => {
    const raw = fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf-8');
    const manifest = JSON.parse(raw);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
