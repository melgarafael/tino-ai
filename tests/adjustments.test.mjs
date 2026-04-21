// tests/adjustments.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAdjustments, writeAdjustments, recordThumb } from '../lib/adjustments.mjs';

async function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'tino-adjustments-'));
}

test('readAdjustments: arquivo inexistente retorna estrutura vazia', async () => {
  const dir = await tmpDir();
  const p = path.join(dir, '_ajustes.md');
  const data = await readAdjustments(p);
  assert.equal(typeof data.meta, 'object');
  assert.equal(data.meta.thumb_up, 0);
  assert.equal(data.meta.thumb_down, 0);
  assert.deepEqual(data.meta.ignore_tags, []);
  assert.deepEqual(data.items, []);
});

test('recordThumb: idempotente — duas gravacoes do mesmo id/sinal nao duplicam nem recontam', async () => {
  const dir = await tmpDir();
  const p = path.join(dir, '_ajustes.md');
  const r1 = await recordThumb(p, { id: '2026-04-21-x', titulo: 'Titulo X', sinal: 'errado' });
  const r2 = await recordThumb(p, { id: '2026-04-21-x', titulo: 'Titulo X', sinal: 'errado' });
  assert.equal(r1.added, true);
  assert.equal(r2.noop, true);
  const data = await readAdjustments(p);
  assert.equal(data.meta.thumb_down, 1);
  const errados = data.items.filter((i) => i.sinal === 'errado');
  assert.equal(errados.length, 1);
  assert.equal(errados[0].id, '2026-04-21-x');
});

test('recordThumb: incrementa contador e move item entre secoes ao inverter sinal', async () => {
  const dir = await tmpDir();
  const p = path.join(dir, '_ajustes.md');
  await recordThumb(p, { id: 'a', titulo: 'A', sinal: 'certeiro' });
  await recordThumb(p, { id: 'b', titulo: 'B', sinal: 'errado' });
  let data = await readAdjustments(p);
  assert.equal(data.meta.thumb_up, 1);
  assert.equal(data.meta.thumb_down, 1);

  // Inverte `a` de certeiro -> errado: move de secao, thumb_up decrementa, thumb_down incrementa.
  const rMove = await recordThumb(p, { id: 'a', titulo: 'A', sinal: 'errado' });
  assert.equal(rMove.moved, true);
  data = await readAdjustments(p);
  assert.equal(data.meta.thumb_up, 0);
  assert.equal(data.meta.thumb_down, 2);
  const certeiros = data.items.filter((i) => i.sinal === 'certeiro');
  const errados = data.items.filter((i) => i.sinal === 'errado');
  assert.equal(certeiros.length, 0);
  assert.equal(errados.length, 2);
  assert.ok(errados.some((i) => i.id === 'a'));
});

test('write/read round-trip: preserva meta + items', async () => {
  const dir = await tmpDir();
  const p = path.join(dir, '_ajustes.md');
  const payload = {
    meta: {
      atualizado: '2026-04-21',
      thumb_up: 3,
      thumb_down: 2,
      ignore_tags: ['video', 'audio'],
    },
    items: [
      { id: '2026-04-20-claude', titulo: 'Claude SDK', sinal: 'certeiro' },
      { id: '2026-04-19-flash', titulo: 'Gemini Flash', sinal: 'errado' },
    ],
  };
  await writeAdjustments(p, payload);
  const roundtrip = await readAdjustments(p);
  assert.equal(roundtrip.meta.thumb_up, 3);
  assert.equal(roundtrip.meta.thumb_down, 2);
  assert.deepEqual(roundtrip.meta.ignore_tags, ['video', 'audio']);
  const ids = roundtrip.items.map((i) => i.id).sort();
  assert.deepEqual(ids, ['2026-04-19-flash', '2026-04-20-claude']);
  const errado = roundtrip.items.find((i) => i.id === '2026-04-19-flash');
  assert.equal(errado.sinal, 'errado');
  assert.equal(errado.titulo, 'Gemini Flash');
});
