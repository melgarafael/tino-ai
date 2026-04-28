import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseStdinJson, loadPerfil } from '../hooks/lib/hook-context.mjs';

test('parseStdinJson: parses JSON string', () => {
  const input = '{"prompt":"hello","cwd":"/tmp"}';
  const result = parseStdinJson(input);
  assert.equal(result.prompt, 'hello');
  assert.equal(result.cwd, '/tmp');
});

test('parseStdinJson: throws on invalid JSON', () => {
  assert.throws(() => parseStdinJson('not json {{'), /JSON/i);
});

test('loadPerfil: returns null when perfil file missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-hook-ctx-'));
  const result = await loadPerfil(tmp);
  assert.equal(result, null);
});
