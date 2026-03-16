import { describe, test, expect } from 'bun:test';
import { sanitizeTestName, parseNDJSON } from './helpers/session-runner';

describe('session-runner helpers', () => {
  test('sanitizeTestName strips leading slashes and replaces path separators', () => {
    expect(sanitizeTestName('/avad/review')).toBe('avad-review');
    expect(sanitizeTestName('plain-name')).toBe('plain-name');
  });

  test('parseNDJSON counts assistant turns and extracts tool calls', () => {
    const parsed = parseNDJSON([
      '',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"path":"README.md"}},{"type":"text","text":"done"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"cmd":"pwd"}},{"type":"tool_use","input":{"cmd":"ls"}}]}}',
      '{"type":"result","subtype":"success","result":"ok"}',
    ]);

    expect(parsed.turnCount).toBe(2);
    expect(parsed.toolCallCount).toBe(3);
    expect(parsed.resultLine?.subtype).toBe('success');
    expect(parsed.toolCalls).toEqual([
      { tool: 'Read', input: { path: 'README.md' }, output: '' },
      { tool: 'Bash', input: { cmd: 'pwd' }, output: '' },
      { tool: 'unknown', input: { cmd: 'ls' }, output: '' },
    ]);
  });

  test('parseNDJSON skips malformed lines and keeps the last result event', () => {
    const parsed = parseNDJSON([
      '{not-json',
      '{"type":"assistant","message":{"content":[]}}',
      '{"type":"result","subtype":"max_turns","result":"partial"}',
      '{"type":"result","subtype":"success","result":"final"}',
    ]);

    expect(parsed.transcript).toHaveLength(3);
    expect(parsed.turnCount).toBe(1);
    expect(parsed.toolCallCount).toBe(0);
    expect(parsed.resultLine?.subtype).toBe('success');
    expect(parsed.resultLine?.result).toBe('final');
  });

  test('parseNDJSON ignores blank assistant content arrays without failing', () => {
    const parsed = parseNDJSON([
      '{"type":"assistant","message":{"content":[]}}',
      '{"type":"assistant","message":{}}',
    ]);

    expect(parsed.turnCount).toBe(2);
    expect(parsed.toolCallCount).toBe(0);
    expect(parsed.toolCalls).toEqual([]);
    expect(parsed.resultLine).toBeNull();
  });
});
