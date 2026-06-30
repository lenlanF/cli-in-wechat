import test from 'node:test';
import assert from 'node:assert/strict';

import { LocalAgentAdapter } from '../src/adapters/local-agent.js';
import { DEFAULT_SETTINGS } from '../src/adapters/base.js';

function opts() {
  return {
    settings: { ...DEFAULT_SETTINGS, sessionIds: {}, workDir: process.cwd() },
    workDir: process.cwd(),
    timeout: 30_000,
  };
}

test('LocalAgentAdapter sends prompt through stdin', async () => {
  const adapter = new LocalAgentAdapter('nodeecho', 'Node Echo', 'node', {
    command: 'node',
    args: ['-e', 'process.stdin.pipe(process.stdout)'],
    promptMode: 'stdin',
  });

  const result = await adapter.execute('hello stdin', opts());

  assert.equal(result.error, false);
  assert.equal(result.text, 'hello stdin');
});

test('LocalAgentAdapter appends prompt as CLI argument', async () => {
  const adapter = new LocalAgentAdapter('nodearg', 'Node Arg', 'node', {
    command: 'node',
    args: ['-e', 'console.log(process.argv.at(-1))'],
    promptMode: 'arg',
  });

  const result = await adapter.execute('hello arg', opts());

  assert.equal(result.error, false);
  assert.equal(result.text, 'hello arg');
});

test('LocalAgentAdapter expands template arguments', async () => {
  const adapter = new LocalAgentAdapter('nodetemplate', 'Node Template', 'node', {
    command: 'node',
    args: ['-e', 'console.log(process.argv.at(-1))', 'prefix:{prompt}:suffix'],
    promptMode: 'template',
  });

  const result = await adapter.execute('hello template', opts());

  assert.equal(result.error, false);
  assert.equal(result.text, 'prefix:hello template:suffix');
});

test('LocalAgentAdapter includes media local and NAS paths in stdin prompt', async () => {
  const adapter = new LocalAgentAdapter('nodemedia', 'Node Media', 'node', {
    command: 'node',
    args: ['-e', 'process.stdin.pipe(process.stdout)'],
    promptMode: 'stdin',
  });

  const result = await adapter.execute('handle file', {
    ...opts(),
    media: [{
      type: 'file',
      path: 'D:\\wx\\.wx-media\\report.pdf',
      fileName: 'report.pdf',
      nasPath: '\\\\NAS01\\wechat-inbox\\2026-06-30\\report.pdf',
      size: 12,
    }],
  });

  assert.equal(result.error, false);
  assert.match(result.text, /handle file/);
  assert.match(result.text, /D:\\wx\\.wx-media\\report\.pdf/);
  assert.match(result.text, /\\\\NAS01\\wechat-inbox\\2026-06-30\\report\.pdf/);
});
