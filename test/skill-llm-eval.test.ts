/**
 * LLM-as-a-Judge evals for avadbot skill documentation quality.
 *
 * Uses Anthropic API to evaluate whether skill docs are clear,
 * complete, and actionable for an AI agent.
 *
 * Requires: ANTHROPIC_API_KEY + EVALS=1
 * Cost: ~$0.05-0.15 per run
 */

import { describe, test, expect, afterAll } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { callJudge, judge } from './helpers/llm-judge';
import type { JudgeScore } from './helpers/llm-judge';
import { EvalCollector } from './helpers/eval-store';

const ROOT = path.resolve(import.meta.dir, '..');
const evalsEnabled = !!process.env.EVALS;
const describeEval = evalsEnabled ? describe : describe.skip;
const evalCollector = evalsEnabled ? new EvalCollector('llm-judge') : null;

// Skills to evaluate documentation quality
const SKILLS_TO_EVAL = [
  { dir: 'browse', name: 'browse', sections: ['## Snapshot', '## Command Reference', '## Tips'] },
  { dir: 'avad-qa', name: 'avad-qa', sections: ['## Workflow', '## Health Score'] },
  { dir: 'avad-review', name: 'avad-review', sections: [] },
  { dir: 'avad-ship', name: 'avad-ship', sections: [] },
  { dir: 'avad-plan-ceo-review', name: 'avad-plan-ceo-review', sections: [] },
  { dir: 'avad-plan-eng-review', name: 'avad-plan-eng-review', sections: [] },
  { dir: 'avad-retro', name: 'avad-retro', sections: [] },
];

describeEval('Skill documentation quality evals', () => {
  // Evaluate each skill's SKILL.md overall
  for (const skill of SKILLS_TO_EVAL) {
    test(`${skill.name}/SKILL.md scores >= 3 on all dimensions`, async () => {
      const t0 = Date.now();
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');

      const scores = await judge(`${skill.name} skill reference`, content);
      console.log(`${skill.name} scores:`, JSON.stringify(scores, null, 2));

      evalCollector?.addTest({
        name: `${skill.name}/SKILL.md`,
        suite: 'Skill documentation quality evals',
        tier: 'llm-judge',
        passed: scores.clarity >= 3 && scores.completeness >= 3 && scores.actionability >= 3,
        duration_ms: Date.now() - t0,
        cost_usd: 0.02,
        judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
        judge_reasoning: scores.reasoning,
      });

      expect(scores.clarity).toBeGreaterThanOrEqual(3);
      expect(scores.completeness).toBeGreaterThanOrEqual(3);
      expect(scores.actionability).toBeGreaterThanOrEqual(3);
    }, 30_000);
  }
});

// Browse-specific quality evals (command reference, snapshot flags)
describeEval('Browse documentation quality evals', () => {
  const browseSkillPath = path.join(ROOT, 'browse', 'SKILL.md');
  if (!fs.existsSync(browseSkillPath)) return;
  const browseContent = fs.readFileSync(browseSkillPath, 'utf-8');

  test('command reference table scores >= 4', async () => {
    const t0 = Date.now();
    const start = browseContent.indexOf('## Command Reference');
    const end = browseContent.indexOf('## Tips');
    if (start === -1) return;
    const section = browseContent.slice(start, end > start ? end : undefined);

    const scores = await judge('command reference table', section);
    console.log('Command reference scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'browse command reference',
      suite: 'Browse documentation quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.completeness >= 4 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('snapshot flags section scores >= 4', async () => {
    const t0 = Date.now();
    const start = browseContent.indexOf('## Snapshot');
    const end = browseContent.indexOf('## Command Reference');
    if (start === -1) return;
    const section = browseContent.slice(start, end > start ? end : undefined);

    const scores = await judge('snapshot flags reference', section);
    console.log('Snapshot flags scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'browse snapshot flags',
      suite: 'Browse documentation quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.completeness >= 4 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(4);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);
});

// QA skill quality evals
describeEval('QA skill quality evals', () => {
  const qaPath = path.join(ROOT, 'avad-qa', 'SKILL.md');
  if (!fs.existsSync(qaPath)) return;
  const qaContent = fs.readFileSync(qaPath, 'utf-8');

  test('avad-qa workflow quality scores >= 4', async () => {
    const t0 = Date.now();
    const start = qaContent.indexOf('## Workflow');
    const end = qaContent.indexOf('## Health Score');
    if (start === -1) return;
    const section = qaContent.slice(start, end > start ? end : undefined);

    const scores = await callJudge<JudgeScore>(`You are evaluating the quality of a QA testing workflow document for an AI coding agent.

The agent reads this document to learn how to systematically QA test a web application. The workflow references
a headless browser CLI ($B commands) that is documented separately — do NOT penalize for missing CLI definitions.

Rate on three dimensions (1-5 scale):
- **clarity** (1-5): Can an agent follow the step-by-step phases without ambiguity?
- **completeness** (1-5): Are all phases, decision points, and outputs well-defined?
- **actionability** (1-5): Can an agent execute the workflow and produce the expected deliverables?

Respond with ONLY valid JSON:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief explanation"}

Here is the QA workflow to evaluate:

${section}`);
    console.log('QA workflow scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'avad-qa workflow',
      suite: 'QA skill quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.completeness >= 3 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(3);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);

  test('avad-qa health score rubric is unambiguous', async () => {
    const t0 = Date.now();
    const start = qaContent.indexOf('## Health Score');
    if (start === -1) return;
    const section = qaContent.slice(start);

    const scores = await callJudge<JudgeScore>(`You are evaluating a health score rubric that an AI agent must follow to compute a numeric QA score.

Rate on three dimensions (1-5 scale):
- **clarity** (1-5): Are the categories, deduction criteria, and weights unambiguous?
- **completeness** (1-5): Are all edge cases and scoring boundaries defined?
- **actionability** (1-5): Can an agent compute a correct score from this rubric alone?

Respond with ONLY valid JSON:
{"clarity": N, "completeness": N, "actionability": N, "reasoning": "brief explanation"}

Here is the rubric to evaluate:

${section}`);
    console.log('QA health rubric scores:', JSON.stringify(scores, null, 2));

    evalCollector?.addTest({
      name: 'avad-qa health rubric',
      suite: 'QA skill quality evals',
      tier: 'llm-judge',
      passed: scores.clarity >= 4 && scores.completeness >= 3 && scores.actionability >= 4,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: scores.clarity, completeness: scores.completeness, actionability: scores.actionability },
      judge_reasoning: scores.reasoning,
    });

    expect(scores.clarity).toBeGreaterThanOrEqual(4);
    expect(scores.completeness).toBeGreaterThanOrEqual(3);
    expect(scores.actionability).toBeGreaterThanOrEqual(4);
  }, 30_000);
});

// Baseline score pinning
describeEval('Baseline score pinning', () => {
  const baselinesPath = path.join(ROOT, 'test', 'fixtures', 'eval-baselines.json');

  test('LLM eval scores do not regress below baselines', async () => {
    const t0 = Date.now();
    if (!fs.existsSync(baselinesPath)) {
      console.log('No baseline file found — skipping pinning check');
      return;
    }

    const baselines = JSON.parse(fs.readFileSync(baselinesPath, 'utf-8'));
    const regressions: string[] = [];

    const browseSkillPath = path.join(ROOT, 'browse', 'SKILL.md');
    if (!fs.existsSync(browseSkillPath)) return;
    const skillContent = fs.readFileSync(browseSkillPath, 'utf-8');

    const cmdStart = skillContent.indexOf('## Command Reference');
    if (cmdStart === -1) return;
    const cmdEnd = skillContent.indexOf('## Tips');
    const cmdSection = skillContent.slice(cmdStart, cmdEnd > cmdStart ? cmdEnd : undefined);
    const cmdScores = await judge('command reference table', cmdSection);

    for (const dim of ['clarity', 'completeness', 'actionability'] as const) {
      if (cmdScores[dim] < baselines.command_reference[dim]) {
        regressions.push(`command_reference.${dim}: ${cmdScores[dim]} < baseline ${baselines.command_reference[dim]}`);
      }
    }

    if (process.env.UPDATE_BASELINES) {
      baselines.command_reference = {
        clarity: cmdScores.clarity,
        completeness: cmdScores.completeness,
        actionability: cmdScores.actionability,
      };
      fs.writeFileSync(baselinesPath, JSON.stringify(baselines, null, 2) + '\n');
      console.log('Updated eval baselines');
    }

    const passed = regressions.length === 0;
    evalCollector?.addTest({
      name: 'baseline score pinning',
      suite: 'Baseline score pinning',
      tier: 'llm-judge',
      passed,
      duration_ms: Date.now() - t0,
      cost_usd: 0.02,
      judge_scores: { clarity: cmdScores.clarity, completeness: cmdScores.completeness, actionability: cmdScores.actionability },
      judge_reasoning: passed ? 'All scores at or above baseline' : regressions.join('; '),
    });

    if (!passed) {
      throw new Error(`Score regressions detected:\n${regressions.join('\n')}`);
    }
  }, 60_000);
});

afterAll(async () => {
  if (evalCollector) {
    try {
      await evalCollector.finalize();
    } catch (err) {
      console.error('Failed to save eval results:', err);
    }
  }
});
