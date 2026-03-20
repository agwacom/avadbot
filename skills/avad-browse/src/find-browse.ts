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

  // Primary tiers — new name (avad-browse)
  // Ordering matches the $B cascade in gen-skill-docs.ts — local before global.

  // 1. Project-local plugin structure (avadbot IS the project root)
  if (root) {
    const pluginLocal = join(root, 'skills', 'avad-browse', 'dist', 'avad-browse');
    if (existsSync(pluginLocal)) return pluginLocal;
  }

  // 2. Parent repo subdirectory (--plugin-dir ./avadbot from parent project)
  if (root) {
    try {
      const entries = require('fs').readdirSync(root);
      for (const entry of entries) {
        const candidate = join(root, entry, 'skills', 'avad-browse', 'dist', 'avad-browse');
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }

  // 3. Dev mode symlink (.claude/skills/avad-browse/)
  if (root) {
    const devMode = join(root, '.claude', 'skills', 'avad-browse', 'dist', 'avad-browse');
    if (existsSync(devMode)) return devMode;
  }

  // 4. Plugin-namespaced install (.claude/skills/avadbot/avad-browse/)
  if (root) {
    const pluginNS = join(root, '.claude', 'skills', 'avadbot', 'avad-browse', 'dist', 'avad-browse');
    if (existsSync(pluginNS)) return pluginNS;
  }

  // 5. Global install (setup script)
  const global = join(home, '.claude', 'skills', 'avad-browse', 'dist', 'avad-browse');
  if (existsSync(global)) return global;

  // 6. Global plugin-namespaced
  const globalPluginNS = join(home, '.claude', 'skills', 'avadbot', 'avad-browse', 'dist', 'avad-browse');
  if (existsSync(globalPluginNS)) return globalPluginNS;

  // 7. Marketplace plugin install
  const pluginsDir = join(home, '.claude', 'plugins');
  if (existsSync(pluginsDir)) {
    try {
      const entries = require('fs').readdirSync(pluginsDir);
      for (const entry of entries) {
        const candidate = join(pluginsDir, entry, 'skills', 'avad-browse', 'dist', 'avad-browse');
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }

  // Legacy fallbacks — old name (browse)

  if (root) {
    const legacyLocal = join(root, 'skills', 'browse', 'dist', 'browse');
    if (existsSync(legacyLocal)) return legacyLocal;
  }

  if (root) {
    const legacyDev = join(root, '.claude', 'skills', 'browse', 'dist', 'browse');
    if (existsSync(legacyDev)) return legacyDev;
  }

  const legacyGlobal = join(home, '.claude', 'skills', 'browse', 'dist', 'browse');
  if (existsSync(legacyGlobal)) return legacyGlobal;

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
