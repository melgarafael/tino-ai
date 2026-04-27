import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  fetchCatalog, fetchItem, search, invalidateCache,
  AitmplUnavailableError, AitmplSchemaError,
} from '../lib/aitmpl-client.mjs';
import { startMockServer } from './fixtures/aitmpl/mock-server.mjs';

let mock; let cacheDir;

before(async () => { mock = await startMockServer(); });
after(async () => { if (mock) await mock.stop(); });
beforeEach(async () => { cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-aitmpl-cache-')); });

function makeOpts(extra = {}) {
  return { baseUrl: mock.baseUrl, cacheDir, ttlMs: 60_000, ...extra };
}

test('fetchCatalog: busca components.json e retorna items por kind', async () => {
  const cat = await fetchCatalog(makeOpts({ kinds: ['skills'] }));
  assert.ok(cat.items?.skills, 'items.skills deveria existir');
  assert.ok(Array.isArray(cat.items.skills));
  assert.ok(cat.items.skills.length >= 2);
  assert.equal(cat.items.skills[0].name, 'superpowers-tdd');
});

test('fetchCatalog: cache hit nao bate na rede', async () => {
  await fetchCatalog(makeOpts({ kinds: ['skills'] }));
  mock.setFailMode(true);
  const cat = await fetchCatalog(makeOpts({ kinds: ['skills'] }));
  mock.setFailMode(false);
  assert.ok(cat.items.skills.length >= 2, 'deveria ter vindo do cache');
});

test('fetchCatalog: cache stale + network fail retorna stale com warning', async () => {
  await fetchCatalog(makeOpts({ kinds: ['skills'], ttlMs: 1 }));
  await new Promise((r) => setTimeout(r, 10));
  mock.setFailMode(true);
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const cat = await fetchCatalog(makeOpts({ kinds: ['skills'], ttlMs: 1 }));
    assert.ok(cat.items.skills.length >= 2);
    assert.ok(warnings.some((w) => w.toLowerCase().includes('stale')), `esperava warning de stale: ${warnings}`);
  } finally {
    console.warn = orig;
    mock.setFailMode(false);
  }
});

test('fetchCatalog: cache vazio + network fail joga AitmplUnavailableError', async () => {
  mock.setFailMode(true);
  try {
    await fetchCatalog(makeOpts({ kinds: ['skills'] }));
    assert.fail('deveria ter jogado');
  } catch (e) {
    assert.ok(e instanceof AitmplUnavailableError, `esperava AitmplUnavailableError, veio ${e?.name}`);
  } finally {
    mock.setFailMode(false);
  }
});

// ===== fetchItem =====

test('fetchItem: encontra item existente por name', async () => {
  const it = await fetchItem('skills', 'superpowers-tdd', makeOpts());
  assert.ok(it, 'deveria retornar item');
  assert.equal(it.name, 'superpowers-tdd');
  assert.equal(it.type, 'skill');
});

test('fetchItem: retorna null quando name nao existe', async () => {
  const it = await fetchItem('skills', 'nao-existe-xyz', makeOpts());
  assert.equal(it, null);
});

test('fetchItem: retorna null quando kind nao existe', async () => {
  const it = await fetchItem('nao-existe-kind', 'qualquer', makeOpts());
  assert.equal(it, null);
});

// ===== search =====

test('search: encontra por substring no name ou description', async () => {
  const res = await search('TDD', makeOpts());
  assert.ok(Array.isArray(res));
  assert.ok(res.some((it) => it.name === 'superpowers-tdd'), `esperava superpowers-tdd, vieram: ${res.map(r => r.name)}`);
});

test('search: respeita limit', async () => {
  const res = await search('a', makeOpts({ limit: 1 }));
  assert.equal(res.length, 1);
});

test('search: query vazia retorna lista vazia', async () => {
  const res = await search('', makeOpts());
  assert.deepEqual(res, []);
});
