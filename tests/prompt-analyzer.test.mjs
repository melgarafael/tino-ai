import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLazy, analyzeStuck } from '../hooks/lib/prompt-analyzer.mjs';

// ===== analyzeLazy =====

test('analyzeLazy: prompt curto sem contexto eh flagged', () => {
  const r = analyzeLazy('faz isso');
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /curto|contexto/i.test(x)));
});

test('analyzeLazy: pergunta clara curta NAO eh flagged', () => {
  const r = analyzeLazy('como rodo os testes?');
  assert.equal(r.flagged, false);
});

test('analyzeLazy: palavra vaga isolada eh flagged', () => {
  const r = analyzeLazy('isso');
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /vag/i.test(x)));
});

test('analyzeLazy: whitelist "ok" / "sim" / "continue" NAO flagged', () => {
  for (const p of ['ok', 'sim', 'prossiga', 'continue', 'cancela']) {
    const r = analyzeLazy(p);
    assert.equal(r.flagged, false, `"${p}" nao deveria ser flagged`);
  }
});

test('analyzeLazy: comando claude (^/) NAO flagged', () => {
  const r = analyzeLazy('/tino:refresh');
  assert.equal(r.flagged, false);
});

test('analyzeLazy: error paste sem pergunta eh flagged', () => {
  const errorText = `Error: cannot find module
    at Module._resolveFilename (internal/modules/cjs/loader.js:889:15)
    at Function.Module._load (internal/modules/cjs/loader.js:745:27)`;
  const r = analyzeLazy(errorText);
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /error|paste/i.test(x)));
});

test('analyzeLazy: prompt longo com contexto NAO flagged', () => {
  const r = analyzeLazy('Preciso adicionar autenticacao ao endpoint /api/users — pode usar JWT? O resto do projeto ja usa.');
  assert.equal(r.flagged, false);
});

// ===== analyzeStuck =====

test('analyzeStuck: "tenta de novo" curto eh flagged', () => {
  const r = analyzeStuck('tenta de novo', []);
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /tenta|novo/i.test(x)));
});

test('analyzeStuck: prompt identico nas ultimas 3 eh flagged', () => {
  const history = [
    { prompt: 'arruma o bug do login', ts: 1 },
    { prompt: 'arruma o bug do login', ts: 2 },
  ];
  const r = analyzeStuck('arruma o bug do login', history);
  assert.equal(r.flagged, true);
  assert.ok(r.repetitions >= 1);
});

test('analyzeStuck: history vazio + prompt limpo NAO flagged', () => {
  const r = analyzeStuck('preciso refatorar a funcao login pra retornar Promise', []);
  assert.equal(r.flagged, false);
});
