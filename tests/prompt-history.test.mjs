import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { append, readLastN, rotate } from '../hooks/lib/prompt-history.mjs';

let dir;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-history-'));
});

test('append + readLastN: ordem mais-recente-primeiro', async () => {
  const file = path.join(dir, 'h.jsonl');
  await append(file, { ts: 1, prompt: 'a', session_id: 's1', cwd: '/x' });
  await append(file, { ts: 2, prompt: 'b', session_id: 's1', cwd: '/x' });
  await append(file, { ts: 3, prompt: 'c', session_id: 's1', cwd: '/x' });
  const last = await readLastN(file, 2);
  assert.equal(last.length, 2);
  assert.equal(last[0].prompt, 'c');
  assert.equal(last[1].prompt, 'b');
});

test('readLastN: arquivo ausente retorna []', async () => {
  const result = await readLastN(path.join(dir, 'nao-existe.jsonl'), 5);
  assert.deepEqual(result, []);
});

test('rotate: trunca pras ultimas N entries', async () => {
  const file = path.join(dir, 'h.jsonl');
  for (let i = 0; i < 10; i++) {
    await append(file, { ts: i, prompt: `p${i}`, session_id: 's', cwd: '/x' });
  }
  await rotate(file, 3);
  const all = await readLastN(file, 100);
  assert.equal(all.length, 3);
  assert.equal(all[0].prompt, 'p9');
  assert.equal(all[2].prompt, 'p7');
});

test('rotate: arquivo menor que limite nao muda', async () => {
  const file = path.join(dir, 'h.jsonl');
  await append(file, { ts: 1, prompt: 'a', session_id: 's', cwd: '/x' });
  await rotate(file, 10);
  const all = await readLastN(file, 5);
  assert.equal(all.length, 1);
});
