import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { computePatch, applyPatch, backup } from '../lib/settings-patch.mjs';

test('computePatch: baixa risco -> deny array', () => {
  const patch = computePatch({ tolerancia_risco: 'baixa', modo_autonomia: 'perguntativo' });
  assert.ok(patch.add.permissions?.deny?.some((p) => /rm/i.test(p)));
});

test('computePatch: alta risco + autonomo -> allow array generoso', () => {
  const patch = computePatch({ tolerancia_risco: 'alta', modo_autonomia: 'autonomo' });
  assert.ok(patch.add.permissions?.allow?.length > 0);
  assert.ok(patch.add.permissions.allow.some((p) => /Bash/i.test(p)));
});

test('applyPatch: merge sem destruir keys existentes', () => {
  const curr = { existingKey: 'untouched', permissions: { allow: ['Read'] } };
  const patch = { add: { permissions: { allow: ['Bash(npm:*)'] } } };
  const next = applyPatch(curr, patch);
  assert.equal(next.existingKey, 'untouched');
  assert.deepEqual(next.permissions.allow, ['Read', 'Bash(npm:*)']);
});

test('applyPatch: settings vazio funciona', () => {
  const next = applyPatch({}, { add: { permissions: { allow: ['Read'] } } });
  assert.deepEqual(next.permissions.allow, ['Read']);
});

test('backup: cria copia com timestamp', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-'));
  const orig = path.join(tmp, 'settings.json');
  await fs.writeFile(orig, '{"x":1}', 'utf8');
  const bak = await backup(orig);
  assert.ok(bak.includes('tino-bak'));
  const content = await fs.readFile(bak, 'utf8');
  assert.equal(content, '{"x":1}');
});
