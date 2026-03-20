/**
 * SKILL.md parser and validator for avadbot.
 *
 * Extracts $B commands from code blocks, validates them against
 * the command registry and snapshot flags.
 */

import { ALL_COMMANDS } from '../../skills/avad-browse/src/commands';
import { parseSnapshotArgs } from '../../skills/avad-browse/src/snapshot';
import * as fs from 'fs';
import * as path from 'path';

export interface BrowseCommand {
  command: string;
  args: string[];
  line: number;
  raw: string;
}

export interface ValidationResult {
  valid: BrowseCommand[];
  invalid: BrowseCommand[];
  snapshotFlagErrors: Array<{ command: BrowseCommand; error: string }>;
  warnings: string[];
}

/**
 * Extract all $B invocations from bash code blocks in a SKILL.md file.
 */
export function extractBrowseCommands(skillPath: string): BrowseCommand[] {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const lines = content.split('\n');
  const commands: BrowseCommand[] = [];

  let inBashBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      if (inBashBlock) {
        inBashBlock = false;
      } else if (line.trimStart().startsWith('```bash')) {
        inBashBlock = true;
      }
      continue;
    }

    if (!inBashBlock) continue;

    const matches = line.matchAll(/\$B\s+(\S+)(?:\s+([^\$]*))?/g);
    for (const match of matches) {
      const command = match[1];
      let argsStr = (match[2] || '').trim();

      // Strip inline comments
      let inQuote = false;
      for (let j = 0; j < argsStr.length; j++) {
        if (argsStr[j] === '"') inQuote = !inQuote;
        if (argsStr[j] === '#' && !inQuote) {
          argsStr = argsStr.slice(0, j).trim();
          break;
        }
      }

      // Parse args — handle quoted strings
      const args: string[] = [];
      if (argsStr) {
        const argMatches = argsStr.matchAll(/"([^"]*)"|(\S+)/g);
        for (const am of argMatches) {
          args.push(am[1] ?? am[2]);
        }
      }

      commands.push({
        command,
        args,
        line: i + 1,
        raw: match[0].trim(),
      });
    }
  }

  return commands;
}

/**
 * Extract and validate all $B commands in a SKILL.md file.
 */
export function validateSkill(skillPath: string): ValidationResult {
  const commands = extractBrowseCommands(skillPath);
  const result: ValidationResult = {
    valid: [],
    invalid: [],
    snapshotFlagErrors: [],
    warnings: [],
  };

  if (commands.length === 0) {
    result.warnings.push('no $B commands found');
    return result;
  }

  for (const cmd of commands) {
    if (!ALL_COMMANDS.has(cmd.command)) {
      result.invalid.push(cmd);
      continue;
    }

    if (cmd.command === 'snapshot' && cmd.args.length > 0) {
      try {
        parseSnapshotArgs(cmd.args);
      } catch (err: any) {
        result.snapshotFlagErrors.push({ command: cmd, error: err.message });
        continue;
      }
    }

    result.valid.push(cmd);
  }

  return result;
}

/**
 * Parse a markdown weight table anchored to a "### Weights" heading.
 */
export function extractWeightsFromTable(content: string): Map<string, number> {
  const weights = new Map<string, number>();

  const weightsIdx = content.indexOf('### Weights');
  if (weightsIdx === -1) return weights;

  const section = content.slice(weightsIdx);
  const lines = section.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#') && !line.startsWith('###')) break;
    if (line.startsWith('### ') && i > 0) break;

    const match = line.match(/^\|\s*(\w[\w\s]*\w|\w+)\s*\|\s*(\d+)%\s*\|$/);
    if (match) {
      const category = match[1].trim();
      const pct = parseInt(match[2], 10);
      if (category !== 'Category' && !isNaN(pct)) {
        weights.set(category, pct);
      }
    }
  }

  return weights;
}
