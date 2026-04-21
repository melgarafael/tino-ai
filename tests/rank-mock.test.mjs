// tests/rank-mock.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankMock } from '../lib/rank-mock.mjs';

const perfilBase = {
  meta: {
    foco_ativo: ['Claude Agent SDK', 'Managed Agents', 'MCP'],
    identidade: ['SaaS B2B', 'Founder', 'Next.js'],
    evita: ['video generation', 'voice cloning'],
  },
  body: '',
};

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

test('rank-mock: foco_ativo literal -> nota >= 9', () => {
  const novidade = {
    titulo: 'Claude Agent SDK 1.0',
    resumo_bruto: 'Stable APIs for tool orchestration.',
    data: daysAgo(1),
  };
  const r = rankMock(perfilBase, novidade);
  assert.ok(r.nota >= 9, `esperava >= 9, recebi ${r.nota}`);
  assert.equal(r.veredito, 'Foca');
  assert.equal(r.cite, '_perfil.md');
});

test('rank-mock: match com evita -> nota < 5', () => {
  const novidade = {
    titulo: 'Runway Gen-4 video generation',
    resumo_bruto: 'Another breakthrough in video generation models.',
    data: daysAgo(1),
  };
  const r = rankMock(perfilBase, novidade);
  assert.ok(r.nota < 5, `esperava < 5, recebi ${r.nota}`);
  assert.equal(r.veredito, 'Ignore');
});

test('rank-mock: novidade neutra -> 5-6.9 (Acompanha)', () => {
  const novidade = {
    titulo: 'Some random tech news about pasta recipes',
    resumo_bruto: 'Pasta carbonara tutorial in 4k.',
    data: daysAgo(30),
  };
  const r = rankMock(perfilBase, novidade);
  assert.ok(r.nota >= 5 && r.nota < 7, `esperava 5-6.9, recebi ${r.nota}`);
  assert.equal(r.veredito, 'Acompanha');
});

test('rank-mock: determinismo — mesma entrada, mesma saida', () => {
  const novidade = {
    titulo: 'Claude Agent SDK 1.0',
    resumo_bruto: 'Stable APIs.',
    data: '2026-04-20T10:00:00Z',
  };
  const a = rankMock(perfilBase, novidade);
  const b = rankMock(perfilBase, novidade);
  assert.deepEqual(a, b);
});

test('rank-mock: nota sempre em [0, 10]', () => {
  const casos = [
    { titulo: 'video generation voice cloning', resumo_bruto: 'video generation', data: null }, // multi-evita
    { titulo: 'Claude Agent SDK MCP Managed Agents', resumo_bruto: 'SaaS B2B Founder Next.js', data: daysAgo(1) }, // pile
    { titulo: '', resumo_bruto: '', data: null },
  ];
  for (const n of casos) {
    const r = rankMock(perfilBase, n);
    assert.ok(r.nota >= 0 && r.nota <= 10, `nota fora do range: ${r.nota}`);
    assert.equal(Number.isFinite(r.nota), true);
    // 1 casa decimal
    assert.equal(Math.round(r.nota * 10) / 10, r.nota);
  }
});

test('rank-mock: identidade match soma sem estourar cap', () => {
  const novidade = {
    titulo: 'Next.js tips for SaaS B2B Founder devs',
    resumo_bruto: 'Nothing about foco.',
    data: null,
  };
  const r = rankMock(perfilBase, novidade);
  // base 5 + identidade cap +3 = 8; sem foco, sem recencia -> 8.0
  assert.ok(r.nota >= 7 && r.nota < 9);
  assert.equal(r.veredito, 'Considera');
});

test('rank-mock: ajustes.ignore_tags penaliza', () => {
  const novidade = {
    titulo: 'Claude Agent SDK 1.0 with crypto integration',
    resumo_bruto: 'Crypto primitives in the SDK.',
    data: daysAgo(1),
  };
  const ajustes = [{ ignore_tags: ['crypto'] }];
  const semAjustes = rankMock(perfilBase, novidade);
  const comAjustes = rankMock(perfilBase, novidade, ajustes);
  assert.ok(comAjustes.nota < semAjustes.nota, 'ajustes deviam reduzir a nota');
});

test('rank-mock: output shape { nota, veredito, resumo, justificativa, cite }', () => {
  const r = rankMock(perfilBase, { titulo: 'x', resumo_bruto: 'y', data: null });
  assert.equal(typeof r.nota, 'number');
  assert.equal(typeof r.veredito, 'string');
  assert.equal(typeof r.resumo, 'string');
  assert.equal(typeof r.justificativa, 'string');
  assert.equal(typeof r.cite, 'string');
  assert.match(r.justificativa, /heuristic/i);
});
