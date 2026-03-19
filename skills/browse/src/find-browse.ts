/**
 * find-browse — locate the avadbot browse binary.
 *
 * Compiled to browse/dist/find-browse (standalone binary, no bun runtime needed).
 * Outputs the absolute path to the browse binary on stdout, or exits 1 if not found.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Binary Discovery ───────────────────────────────────────────

function getGitRoot(): string | null {
  try {
    const proc = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) return null;
    return proc.stdout.toString().trim();
  } catch {
    return null;
  }
}

export function locateBinary(): string | null {
  const root = getGitRoot();
  const home = homedir();

  // 1. Project-local plugin structure (avadbot IS the project root)
  if (root) {
    const pluginLocal = join(root, 'skills', 'browse', 'dist', 'browse');
    if (existsSync(pluginLocal)) return pluginLocal;
  }

  // 2. Dev mode symlink (.claude/skills/browse/)
  if (root) {
    const devMode = join(root, '.claude', 'skills', 'browse', 'dist', 'browse');
    if (existsSync(devMode)) return devMode;
  }

  // 3. Global install (setup script)
  const global = join(home, '.claude', 'skills', 'browse', 'dist', 'browse');
  if (existsSync(global)) return global;

  // 4. Marketplace plugin install
  const pluginsDir = join(home, '.claude', 'plugins');
  if (existsSync(pluginsDir)) {
    try {
      const entries = require('fs').readdirSync(pluginsDir);
      for (const entry of entries) {
        const candidate = join(pluginsDir, entry, 'skills', 'browse', 'dist', 'browse');
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }

  return null;
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
  const bin = locateBinary();
  if (!bin) {
    process.stderr.write('ERROR: browse binary not found. Run: cd <skill-dir> && ./setup\n');
    process.exit(1);
  }

  console.log(bin);
}

if (import.meta.main) {
  main();
}
