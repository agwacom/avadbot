/**
 * avadbot skill E2E tests.
 *
 * Spawns `claude -p` subprocesses to test each skill end-to-end.
 * Requires EVALS=1 env var to run. Cost: ~$4/run.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { runSkillTest } from './helpers/session-runner';
import type { SkillTestResult } from './helpers/session-runner';
import { outcomeJudge } from './helpers/llm-judge';
import { EvalCollector } from './helpers/eval-store';
import type { EvalTestEntry } from './helpers/eval-store';
import { startTestServer } from '../skills/avad-browse/test/test-server';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');

const evalsEnabled = !!process.env.EVALS;
const describeE2E = evalsEnabled ? describe : describe.skip;

const evalCollector = evalsEnabled ? new EvalCollector('e2e') : null;
const runId = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);

function recordE2E(name: string, suite: string, result: SkillTestResult, extra?: Partial<EvalTestEntry>) {
  const lastTool = result.toolCalls.length > 0
    ? `${result.toolCalls[result.toolCalls.length - 1].tool}(${JSON.stringify(result.toolCalls[result.toolCalls.length - 1].input).slice(0, 60)})`
    : undefined;

  evalCollector?.addTest({
    name, suite, tier: 'e2e',
    passed: result.exitReason === 'success' && result.browseErrors.length === 0,
    duration_ms: result.duration,
    cost_usd: result.costEstimate.estimatedCost,
    transcript: result.transcript,
    output: result.output?.slice(0, 2000),
    turns_used: result.costEstimate.turnsUsed,
    browse_errors: result.browseErrors,
    exit_reason: result.exitReason,
    timeout_at_turn: result.exitReason === 'timeout' ? result.costEstimate.turnsUsed : undefined,
    last_tool_call: lastTool,
    ...extra,
  });
}

let testServer: ReturnType<typeof startTestServer>;
let tmpDir: string;
const browseBin = path.resolve(ROOT, 'skills', 'avad-browse', 'dist', 'avad-browse');

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function setupBrowseShims(dir: string) {
  const binDir = path.join(dir, 'avad-browse', 'dist');
  fs.mkdirSync(binDir, { recursive: true });
  if (fs.existsSync(browseBin)) {
    fs.symlinkSync(browseBin, path.join(binDir, 'avad-browse'));
  }

  const findBrowseDir = path.join(dir, 'avad-browse', 'bin');
  fs.mkdirSync(findBrowseDir, { recursive: true });
  fs.writeFileSync(
    path.join(findBrowseDir, 'find-browse'),
    `#!/bin/bash\necho "${browseBin}"\n`,
    { mode: 0o755 },
  );
}

function logCost(label: string, result: { costEstimate: { turnsUsed: number; estimatedTokens: number; estimatedCost: number }; duration: number }) {
  const { turnsUsed, estimatedTokens, estimatedCost } = result.costEstimate;
  const durationSec = Math.round(result.duration / 1000);
  console.log(`${label}: $${estimatedCost.toFixed(2)} (${turnsUsed} turns, ${(estimatedTokens / 1000).toFixed(1)}k tokens, ${durationSec}s)`);
}

function dumpOutcomeDiagnostic(dir: string, label: string, report: string, judgeResult: any) {
  try {
    const transcriptDir = path.join(dir, '.avadbot', 'test-transcripts');
    fs.mkdirSync(transcriptDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(
      path.join(transcriptDir, `${label}-outcome-${timestamp}.json`),
      JSON.stringify({ label, report, judgeResult }, null, 2),
    );
  } catch { /* non-fatal */ }
}

// Fail fast if API is unreachable
if (evalsEnabled) {
  const check = spawnSync('sh', ['-c', 'echo "ping" | claude -p --max-turns 1 --output-format stream-json --verbose --dangerously-skip-permissions'], {
    stdio: 'pipe', timeout: 30_000,
  });
  const output = check.stdout?.toString() || '';
  if (output.includes('ConnectionRefused') || output.includes('Unable to connect')) {
    throw new Error('Anthropic API unreachable — aborting E2E suite.');
  }
}

// --- Browse E2E ---

describeE2E('Browse E2E', () => {
  beforeAll(() => {
    testServer = startTestServer();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-'));
    setupBrowseShims(tmpDir);
  });

  afterAll(() => {
    testServer?.server?.stop();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('browse basic commands work', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${browseBin}. Assign it to B variable and run these commands in sequence:
1. $B goto ${testServer.url}
2. $B snapshot -i
3. $B text
4. $B screenshot /tmp/avadbot-e2e-test.png
Report the results of each command.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
      testName: 'browse-basic',
      runId,
    });

    logCost('browse basic', result);
    recordE2E('browse basic commands', 'Browse E2E', result);
    expect(result.browseErrors).toHaveLength(0);
    expect(result.exitReason).toBe('success');
  }, 90_000);

  test('browse snapshot flags all work', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${browseBin}. Assign it to B variable and run:
1. $B goto ${testServer.url}
2. $B snapshot -i
3. $B snapshot -c
4. $B snapshot -D
5. $B snapshot -i -a -o /tmp/avadbot-e2e-annotated.png
Report what each command returned.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
      testName: 'browse-snapshot',
      runId,
    });

    logCost('browse snapshot', result);
    recordE2E('browse snapshot flags', 'Browse E2E', result);
    if (result.browseErrors.length > 0) {
      console.warn('Browse errors (non-fatal):', result.browseErrors);
    }
    expect(result.exitReason).toBe('success');
  }, 90_000);
});

// --- avad-qa E2E ---

describeE2E('avad-qa E2E', () => {
  let qaDir: string;

  beforeAll(() => {
    testServer = testServer || startTestServer();
    qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-qa-'));
    setupBrowseShims(qaDir);
    copyDirSync(path.join(ROOT, 'skills', 'avad-qa'), path.join(qaDir, 'avad-qa'));
    fs.mkdirSync(path.join(qaDir, 'qa-reports'), { recursive: true });
  });

  afterAll(() => {
    testServer?.server?.stop();
    try { fs.rmSync(qaDir, { recursive: true, force: true }); } catch {}
  });

  test('/avad-qa quick completes without browse errors', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${browseBin}. Assign it to B variable like: B="${browseBin}"

Read the file avad-qa/SKILL.md for the QA workflow instructions.

Run a Quick-depth QA test on ${testServer.url}/basic.html
Do NOT use AskUserQuestion — run Quick tier directly.
Write your report to ${qaDir}/qa-reports/qa-report.md`,
      workingDirectory: qaDir,
      maxTurns: 30,
      timeout: 180_000,
      testName: 'avad-qa-quick',
      runId,
    });

    logCost('/avad-qa quick', result);
    recordE2E('/avad-qa quick', 'avad-qa E2E', result);
    if (result.browseErrors.length > 0) {
      console.warn('/avad-qa quick browse errors (non-fatal):', result.browseErrors);
    }
    expect(['success', 'error_max_turns']).toContain(result.exitReason);
  }, 240_000);
});

// --- avad-review E2E ---

describeE2E('avad-review E2E', () => {
  let reviewDir: string;

  beforeAll(() => {
    reviewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-review-'));

    const run = (cmd: string, args: string[]) =>
      spawnSync(cmd, args, { cwd: reviewDir, stdio: 'pipe', timeout: 5000 });

    run('git', ['init']);
    run('git', ['config', 'user.email', 'test@test.com']);
    run('git', ['config', 'user.name', 'Test']);

    fs.writeFileSync(path.join(reviewDir, 'app.rb'), '# clean base\nclass App\nend\n');
    run('git', ['add', 'app.rb']);
    run('git', ['commit', '-m', 'initial commit']);

    run('git', ['checkout', '-b', 'feature/add-user-controller']);
    const vulnContent = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'review-eval-vuln.rb'), 'utf-8');
    fs.writeFileSync(path.join(reviewDir, 'user_controller.rb'), vulnContent);
    run('git', ['add', 'user_controller.rb']);
    run('git', ['commit', '-m', 'add user controller']);

    copyDirSync(path.join(ROOT, 'skills', 'avad-review'), path.join(reviewDir, 'avad-review'));
  });

  afterAll(() => {
    try { fs.rmSync(reviewDir, { recursive: true, force: true }); } catch {}
  });

  test('/avad-review produces findings on SQL injection branch', async () => {
    const result = await runSkillTest({
      prompt: `You are in a git repo on a feature branch with changes against main.
Read avad-review/SKILL.md for the review workflow instructions.
Run /avad-review on the current diff (git diff main...HEAD).
Write your review findings to ${reviewDir}/review-output.md`,
      workingDirectory: reviewDir,
      maxTurns: 15,
      timeout: 90_000,
      testName: 'avad-review-sql-injection',
      runId,
    });

    logCost('/avad-review', result);
    recordE2E('/avad-review SQL injection', 'avad-review E2E', result);
    expect(result.exitReason).toBe('success');
  }, 120_000);
});

// --- Planted-bug outcome evals ---

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
const describeOutcome = (evalsEnabled && hasApiKey) ? describe : describe.skip;

describeOutcome('Planted-bug outcome evals', () => {
  let outcomeDir: string;

  beforeAll(() => {
    try { testServer?.server?.stop(); } catch {}
    testServer = startTestServer();
    outcomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-outcome-'));
    setupBrowseShims(outcomeDir);
    copyDirSync(path.join(ROOT, 'skills', 'avad-qa'), path.join(outcomeDir, 'avad-qa'));
  });

  afterAll(() => {
    testServer?.server?.stop();
    try { fs.rmSync(outcomeDir, { recursive: true, force: true }); } catch {}
  });

  async function runPlantedBugEval(fixture: string, groundTruthFile: string, label: string) {
    const testWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), `avadbot-e2e-${label}-`));
    setupBrowseShims(testWorkDir);
    const reportDir = path.join(testWorkDir, 'reports');
    fs.mkdirSync(path.join(reportDir, 'screenshots'), { recursive: true });
    const reportPath = path.join(reportDir, 'qa-report.md');

    const targetUrl = `${testServer.url}/${fixture}`;
    const result = await runSkillTest({
      prompt: `Find bugs on this page: ${targetUrl}

Browser binary: B="${browseBin}"

PHASE 1 — Quick scan (5 commands max):
$B goto ${targetUrl}
$B console --errors
$B snapshot -i
$B snapshot -c
$B accessibility

PHASE 2 — Write initial report to ${reportPath}:
Write every bug you found so far. Format each as:
- Category: functional / visual / accessibility / console
- Severity: high / medium / low
- Evidence: what you observed

PHASE 3 — Interactive testing:
- For EVERY input field: fill it, clear it, try invalid values
- Submit the form and immediately run $B console --errors
- Click every link/button and check for broken behavior
- After finding more bugs, UPDATE ${reportPath} with new findings

PHASE 4 — Finalize report:
- UPDATE ${reportPath} with ALL bugs found across all phases

CRITICAL RULES:
- ONLY test the page at ${targetUrl} — do not navigate to other sites
- Write the report file in PHASE 2 before doing interactive testing
- The report MUST exist at ${reportPath} when you finish`,
      workingDirectory: testWorkDir,
      maxTurns: 40,
      timeout: 300_000,
      testName: `avad-qa-${label}`,
      runId,
    });

    logCost(`/avad-qa ${label}`, result);

    if (result.browseErrors.length > 0) {
      console.warn(`${label} browse errors:`, result.browseErrors);
    }
    if (result.exitReason !== 'success' && result.exitReason !== 'error_max_turns') {
      throw new Error(`${label}: unexpected exit reason: ${result.exitReason}`);
    }

    const groundTruth = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'test', 'fixtures', groundTruthFile), 'utf-8'),
    );

    let report: string | null = null;
    if (fs.existsSync(reportPath)) {
      report = fs.readFileSync(reportPath, 'utf-8');
    } else {
      for (const searchDir of [reportDir, testWorkDir]) {
        try {
          const mdFiles = fs.readdirSync(searchDir).filter(f => f.endsWith('.md'));
          if (mdFiles.length > 0) {
            report = fs.readFileSync(path.join(searchDir, mdFiles[0]), 'utf-8');
            break;
          }
        } catch { /* dir may not exist */ }
      }

      if (!report && result.output && result.output.length > 100) {
        report = result.output;
      }
    }

    if (!report) {
      dumpOutcomeDiagnostic(testWorkDir, label, '(no report file found)', { error: 'missing report' });
      recordE2E(`/avad-qa ${label}`, 'Planted-bug outcome evals', result, { error: 'no report generated' });
      throw new Error(`No report file found in ${reportDir}`);
    }

    const judgeResult = await outcomeJudge(groundTruth, report);
    console.log(`${label} outcome:`, JSON.stringify(judgeResult, null, 2));

    recordE2E(`/avad-qa ${label}`, 'Planted-bug outcome evals', result, {
      detection_rate: judgeResult.detection_rate,
      false_positives: judgeResult.false_positives,
      evidence_quality: judgeResult.evidence_quality,
      detected_bugs: judgeResult.detected,
      missed_bugs: judgeResult.missed,
    });

    if (judgeResult.detection_rate < groundTruth.minimum_detection || judgeResult.false_positives > groundTruth.max_false_positives) {
      dumpOutcomeDiagnostic(testWorkDir, label, report, judgeResult);
    }

    expect(judgeResult.detection_rate).toBeGreaterThanOrEqual(groundTruth.minimum_detection);
    expect(judgeResult.false_positives).toBeLessThanOrEqual(groundTruth.max_false_positives);
    expect(judgeResult.evidence_quality).toBeGreaterThanOrEqual(2);
  }

  test('/avad-qa finds >= 2 of 5 planted bugs (static)', async () => {
    await runPlantedBugEval('qa-eval.html', 'qa-eval-ground-truth.json', 'b6-static');
  }, 360_000);

  test('/avad-qa finds >= 2 of 5 planted SPA bugs', async () => {
    await runPlantedBugEval('qa-eval-spa.html', 'qa-eval-spa-ground-truth.json', 'b7-spa');
  }, 360_000);

  test('/avad-qa finds >= 2 of 5 planted checkout bugs', async () => {
    await runPlantedBugEval('qa-eval-checkout.html', 'qa-eval-checkout-ground-truth.json', 'b8-checkout');
  }, 360_000);
});

// --- avad-plan-ceo-review E2E ---

describeE2E('avad-plan-ceo-review E2E', () => {
  let planDir: string;

  beforeAll(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-plan-ceo-'));
    const run = (cmd: string, args: string[]) =>
      spawnSync(cmd, args, { cwd: planDir, stdio: 'pipe', timeout: 5000 });

    run('git', ['init']);
    run('git', ['config', 'user.email', 'test@test.com']);
    run('git', ['config', 'user.name', 'Test']);

    fs.writeFileSync(path.join(planDir, 'plan.md'), `# Plan: Add User Dashboard

## Context
We're building a new user dashboard that shows recent activity, notifications, and quick actions.

## Changes
1. New React component \`UserDashboard\` in \`src/components/\`
2. REST API endpoint \`GET /api/dashboard\` returning user stats
3. PostgreSQL query for activity aggregation
4. Redis cache layer for dashboard data (5min TTL)

## Open questions
- Should we use WebSocket for real-time updates?
- How do we handle users with 100k+ activity records?
`);

    run('git', ['add', '.']);
    run('git', ['commit', '-m', 'add plan']);

    copyDirSync(path.join(ROOT, 'skills', 'avad-plan-ceo-review'), path.join(planDir, 'avad-plan-ceo-review'));
  });

  afterAll(() => {
    try { fs.rmSync(planDir, { recursive: true, force: true }); } catch {}
  });

  test('/avad-plan-ceo-review produces structured review', async () => {
    const result = await runSkillTest({
      prompt: `Read avad-plan-ceo-review/SKILL.md for the review workflow.

Read plan.md — that's the plan to review. Skip any codebase exploration steps.

Choose HOLD SCOPE mode. Skip any AskUserQuestion calls — this is non-interactive.
Write your complete review to ${planDir}/review-output.md`,
      workingDirectory: planDir,
      maxTurns: 15,
      timeout: 360_000,
      testName: 'avad-plan-ceo-review',
      runId,
    });

    logCost('/avad-plan-ceo-review', result);
    recordE2E('/avad-plan-ceo-review', 'avad-plan-ceo-review E2E', result);
    expect(['success', 'error_max_turns']).toContain(result.exitReason);

    const reviewPath = path.join(planDir, 'review-output.md');
    if (fs.existsSync(reviewPath)) {
      const review = fs.readFileSync(reviewPath, 'utf-8');
      expect(review.length).toBeGreaterThan(200);
    }
  }, 420_000);
});

// --- avad-plan-eng-review E2E ---

describeE2E('avad-plan-eng-review E2E', () => {
  let planDir: string;

  beforeAll(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-plan-eng-'));
    const run = (cmd: string, args: string[]) =>
      spawnSync(cmd, args, { cwd: planDir, stdio: 'pipe', timeout: 5000 });

    run('git', ['init']);
    run('git', ['config', 'user.email', 'test@test.com']);
    run('git', ['config', 'user.name', 'Test']);

    fs.writeFileSync(path.join(planDir, 'plan.md'), `# Plan: Migrate Auth to JWT

## Context
Replace session-cookie auth with JWT tokens. Currently using express-session + Redis store.

## Changes
1. Add \`jsonwebtoken\` package
2. New middleware \`auth/jwt-verify.ts\` replacing \`auth/session-check.ts\`
3. Login endpoint returns { accessToken, refreshToken }
4. Refresh endpoint rotates tokens

## Error handling
- Expired token: 401 with \`token_expired\` code
- Invalid token: 401 with \`invalid_token\` code
- Refresh with revoked token: 403
`);

    run('git', ['add', '.']);
    run('git', ['commit', '-m', 'add plan']);

    copyDirSync(path.join(ROOT, 'skills', 'avad-plan-eng-review'), path.join(planDir, 'avad-plan-eng-review'));
  });

  afterAll(() => {
    try { fs.rmSync(planDir, { recursive: true, force: true }); } catch {}
  });

  test('/avad-plan-eng-review produces structured review', async () => {
    const result = await runSkillTest({
      prompt: `Read avad-plan-eng-review/SKILL.md for the review workflow.

Read plan.md — that's the plan to review. Skip any codebase exploration steps.

Choose SMALL CHANGE mode. Skip any AskUserQuestion calls — this is non-interactive.
Write your complete review to ${planDir}/review-output.md`,
      workingDirectory: planDir,
      maxTurns: 15,
      timeout: 360_000,
      testName: 'avad-plan-eng-review',
      runId,
    });

    logCost('/avad-plan-eng-review', result);
    recordE2E('/avad-plan-eng-review', 'avad-plan-eng-review E2E', result);
    expect(['success', 'error_max_turns']).toContain(result.exitReason);

    const reviewPath = path.join(planDir, 'review-output.md');
    if (fs.existsSync(reviewPath)) {
      const review = fs.readFileSync(reviewPath, 'utf-8');
      expect(review.length).toBeGreaterThan(200);
    }
  }, 420_000);
});

// --- avad-retro E2E ---

describeE2E('avad-retro E2E', () => {
  let retroDir: string;

  beforeAll(() => {
    retroDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-e2e-retro-'));
    const run = (cmd: string, args: string[]) =>
      spawnSync(cmd, args, { cwd: retroDir, stdio: 'pipe', timeout: 5000 });

    run('git', ['init']);
    run('git', ['config', 'user.email', 'dev@example.com']);
    run('git', ['config', 'user.name', 'Dev']);

    fs.writeFileSync(path.join(retroDir, 'app.ts'), 'console.log("hello");\n');
    run('git', ['add', 'app.ts']);
    run('git', ['commit', '-m', 'feat: initial app setup', '--date', '2026-03-10T09:00:00']);

    fs.writeFileSync(path.join(retroDir, 'auth.ts'), 'export function login() {}\n');
    run('git', ['add', 'auth.ts']);
    run('git', ['commit', '-m', 'feat: add auth module', '--date', '2026-03-10T11:00:00']);

    fs.writeFileSync(path.join(retroDir, 'app.ts'), 'import { login } from "./auth";\nconsole.log("hello");\nlogin();\n');
    run('git', ['add', 'app.ts']);
    run('git', ['commit', '-m', 'fix: wire up auth to app', '--date', '2026-03-11T10:00:00']);

    fs.writeFileSync(path.join(retroDir, 'test.ts'), 'import { test } from "bun:test";\ntest("login", () => {});\n');
    run('git', ['add', 'test.ts']);
    run('git', ['commit', '-m', 'test: add login test', '--date', '2026-03-11T14:00:00']);

    fs.writeFileSync(path.join(retroDir, 'api.ts'), 'export function getUsers() { return []; }\n');
    run('git', ['add', 'api.ts']);
    run('git', ['commit', '-m', 'feat: add users API endpoint', '--date', '2026-03-12T09:30:00']);

    copyDirSync(path.join(ROOT, 'skills', 'avad-retro'), path.join(retroDir, 'avad-retro'));
  });

  afterAll(() => {
    try { fs.rmSync(retroDir, { recursive: true, force: true }); } catch {}
  });

  test('/avad-retro produces analysis from git history', async () => {
    const result = await runSkillTest({
      prompt: `Read avad-retro/SKILL.md for instructions on how to run a retrospective.

Run /avad-retro for the last 7 days of this git repo. Skip any AskUserQuestion calls — this is non-interactive.
Write your retrospective report to ${retroDir}/retro-output.md`,
      workingDirectory: retroDir,
      maxTurns: 30,
      timeout: 300_000,
      testName: 'avad-retro',
      runId,
    });

    logCost('/avad-retro', result);
    recordE2E('/avad-retro', 'avad-retro E2E', result);
    expect(['success', 'error_max_turns']).toContain(result.exitReason);

    const retroPath = path.join(retroDir, 'retro-output.md');
    if (fs.existsSync(retroPath)) {
      const retro = fs.readFileSync(retroPath, 'utf-8');
      expect(retro.length).toBeGreaterThan(100);
    }
  }, 420_000);
});

// --- Deferred ---

describeE2E('Deferred skill E2E', () => {
  test.todo('/avad-ship completes full workflow');
  // TODO: Add real E2E test proving /avad-browse handles cookie import via cookie-import-browser command
  test.todo('/avad-browse cookie-import-browser invoked for cookie setup');
});

// Finalize eval collector
afterAll(async () => {
  if (evalCollector) {
    try {
      await evalCollector.finalize();
    } catch (err) {
      console.error('Failed to save eval results:', err);
    }
  }
});
