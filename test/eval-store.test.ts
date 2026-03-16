import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  extractToolSummary,
  findPreviousRun,
  compareEvalResults,
  formatComparison,
  EvalCollector,
  type EvalResult,
} from './helpers/eval-store';

function makeEvalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    schema_version: 1,
    version: '1.1.0',
    branch: 'main',
    git_sha: 'abc123',
    timestamp: '2026-03-16T08:00:00.000Z',
    hostname: 'test-host',
    tier: 'e2e',
    total_tests: 1,
    passed: 1,
    failed: 0,
    total_cost_usd: 1.25,
    total_duration_ms: 1500,
    tests: [
      {
        name: 'qa-checkout',
        suite: 'qa',
        tier: 'e2e',
        passed: true,
        duration_ms: 1500,
        cost_usd: 1.25,
      },
    ],
    ...overrides,
  };
}

describe('eval-store helpers', () => {
  let tmpDir: string;
  let stderrWrite: typeof process.stderr.write;
  let stderrBuffer: string[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avadbot-eval-store-'));
    stderrBuffer = [];
    stderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: any, encoding?: any, cb?: any) => {
      stderrBuffer.push(String(chunk));
      if (typeof encoding === 'function') encoding();
      if (typeof cb === 'function') cb();
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = stderrWrite;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('extractToolSummary counts tool_use items only from assistant messages', () => {
    const summary = extractToolSummary([
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read' },
            { type: 'tool_use', name: 'Read' },
            { type: 'tool_use', name: 'Bash' },
          ],
        },
      },
      { type: 'user', message: { content: [{ type: 'tool_use', name: 'Ignored' }] } },
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use' }] },
      },
    ]);

    expect(summary).toEqual({
      Bash: 1,
      Read: 2,
      unknown: 1,
    });
  });

  test('findPreviousRun prefers the same branch and skips invalid files', () => {
    const sameBranchOlder = makeEvalResult({
      branch: 'feature-x',
      timestamp: '2026-03-16T08:00:00.000Z',
    });
    const otherBranchNewer = makeEvalResult({
      branch: 'main',
      timestamp: '2026-03-16T09:00:00.000Z',
    });
    const exclude = path.join(tmpDir, 'exclude.json');

    fs.writeFileSync(path.join(tmpDir, 'same-branch.json'), JSON.stringify(sameBranchOlder));
    fs.writeFileSync(path.join(tmpDir, 'other-branch.json'), JSON.stringify(otherBranchNewer));
    fs.writeFileSync(path.join(tmpDir, 'broken.json'), '{not-json');
    fs.writeFileSync(exclude, JSON.stringify(makeEvalResult()));

    const previous = findPreviousRun(tmpDir, 'e2e', 'feature-x', exclude);
    expect(previous).toBe(path.join(tmpDir, 'same-branch.json'));
  });

  test('findPreviousRun falls back to newest timestamp when same branch is absent', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'older.json'),
      JSON.stringify(makeEvalResult({ branch: 'dev', timestamp: '2026-03-16T07:00:00.000Z' })),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'newer.json'),
      JSON.stringify(makeEvalResult({ branch: 'main', timestamp: '2026-03-16T10:00:00.000Z' })),
    );

    const previous = findPreviousRun(tmpDir, 'e2e', 'feature-y', path.join(tmpDir, 'exclude.json'));
    expect(previous).toBe(path.join(tmpDir, 'newer.json'));
  });

  test('compareEvalResults tracks status changes and aggregates tool counts', () => {
    const before = makeEvalResult({
      total_tests: 2,
      passed: 1,
      failed: 1,
      total_cost_usd: 2.0,
      total_duration_ms: 2000,
      tests: [
        {
          name: 'qa-checkout',
          suite: 'qa',
          tier: 'e2e',
          passed: false,
          duration_ms: 1200,
          cost_usd: 0.8,
          transcript: [
            {
              type: 'assistant',
              message: { content: [{ type: 'tool_use', name: 'Read' }] },
            },
          ],
        },
        {
          name: 'qa-login',
          suite: 'qa',
          tier: 'e2e',
          passed: true,
          duration_ms: 800,
          cost_usd: 1.2,
          transcript: [
            {
              type: 'assistant',
              message: { content: [{ type: 'tool_use', name: 'Bash' }] },
            },
          ],
        },
      ],
    });
    const after = makeEvalResult({
      total_tests: 2,
      passed: 1,
      failed: 1,
      total_cost_usd: 2.5,
      total_duration_ms: 3200,
      tests: [
        {
          name: 'qa-checkout',
          suite: 'qa',
          tier: 'e2e',
          passed: true,
          duration_ms: 1500,
          cost_usd: 1.4,
          transcript: [
            {
              type: 'assistant',
              message: {
                content: [
                  { type: 'tool_use', name: 'Read' },
                  { type: 'tool_use', name: 'Read' },
                ],
              },
            },
          ],
        },
        {
          name: 'qa-search',
          suite: 'qa',
          tier: 'e2e',
          passed: false,
          duration_ms: 1700,
          cost_usd: 1.1,
          transcript: [
            {
              type: 'assistant',
              message: { content: [{ type: 'tool_use', name: 'Bash' }] },
            },
          ],
        },
      ],
    });

    const comparison = compareEvalResults(before, after, 'before.json', 'after.json');

    expect(comparison.improved).toBe(1);
    expect(comparison.regressed).toBe(0);
    expect(comparison.unchanged).toBe(2);
    expect(comparison.tool_count_before).toBe(2);
    expect(comparison.tool_count_after).toBe(3);
    expect(comparison.total_cost_delta).toBeCloseTo(0.5);
    expect(comparison.total_duration_delta).toBe(1200);
    expect(comparison.deltas.map(d => d.name)).toEqual([
      'qa-checkout',
      'qa-search',
      'qa-login (removed)',
    ]);
  });

  test('formatComparison includes status, cost, duration, and tool deltas', () => {
    const output = formatComparison({
      before_file: 'before.json',
      after_file: 'after.json',
      before_branch: 'main',
      after_branch: 'main',
      before_timestamp: '2026-03-16T08:00:00.000Z',
      after_timestamp: '2026-03-16T09:00:00.000Z',
      deltas: [
        {
          name: 'qa-checkout',
          before: { passed: false, cost_usd: 0.7, tool_summary: { Read: 1 } },
          after: { passed: true, cost_usd: 0.8, tool_summary: { Read: 2 } },
          status_change: 'improved',
        },
      ],
      total_cost_delta: 0.1,
      total_duration_delta: 5000,
      improved: 1,
      regressed: 0,
      unchanged: 0,
      tool_count_before: 1,
      tool_count_after: 2,
    });

    expect(output).toContain('1 improved');
    expect(output).toContain('Cost:   +$0.10');
    expect(output).toContain('Duration: +5s');
    expect(output).toContain('Tool calls: 1 → 2 (+1)');
    expect(output).toContain('Read: 1 → 2 (+1)');
  });

  test('EvalCollector writes partial and final eval artifacts', async () => {
    const collector = new EvalCollector('e2e', tmpDir);

    collector.addTest({
      name: 'qa-checkout',
      suite: 'qa',
      tier: 'e2e',
      passed: true,
      duration_ms: 2100,
      cost_usd: 1.23,
      turns_used: 4,
    });

    const partialPath = path.join(tmpDir, '_partial-e2e.json');
    expect(fs.existsSync(partialPath)).toBe(true);

    const partial = JSON.parse(fs.readFileSync(partialPath, 'utf-8'));
    expect(partial._partial).toBe(true);
    expect(partial.total_tests).toBe(1);
    expect(partial.total_cost_usd).toBe(1.23);

    const finalPath = await collector.finalize();
    expect(finalPath.startsWith(tmpDir)).toBe(true);
    expect(fs.existsSync(finalPath)).toBe(true);

    const finalResult = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));
    expect(finalResult._partial).toBeUndefined();
    expect(finalResult.total_tests).toBe(1);
    expect(finalResult.passed).toBe(1);
    expect(finalResult.failed).toBe(0);
    expect(stderrBuffer.join('')).toContain('Eval Results');
  });

  test('EvalCollector creates a missing nested eval directory before writing', async () => {
    const nestedDir = path.join(tmpDir, 'missing', 'nested', 'evals');
    const collector = new EvalCollector('llm-judge', nestedDir);

    collector.addTest({
      name: 'review-judge',
      suite: 'review',
      tier: 'llm-judge',
      passed: false,
      duration_ms: 900,
      cost_usd: 0.42,
      judge_scores: { correctness: 6 },
    });

    const partialPath = path.join(nestedDir, '_partial-e2e.json');
    expect(fs.existsSync(partialPath)).toBe(true);

    const finalPath = await collector.finalize();
    expect(fs.existsSync(finalPath)).toBe(true);
    expect(path.dirname(finalPath)).toBe(nestedDir);
  });
});
