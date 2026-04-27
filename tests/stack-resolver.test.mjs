import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolve } from '../lib/stack-resolver.mjs';
import { parse as parseCurated } from '../lib/curated-stack.mjs';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOCK_CURATED = path.join(ROOT, 'tests/fixtures/curated-stack-mock.yaml');

function loadPerfil(name) {
  const md = readFileSync(path.join(ROOT, `tests/fixtures/perfil-vibecoder/${name}.md`), 'utf8');
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

test('resolve: junior+pro combina essentials + by_role.junior + by_plan.pro', () => {
  const perfil = loadPerfil('junior-balanceado');
  const curated = parseCurated(MOCK_CURATED);
  // junior tem context7 ja instalado → filtrado fora
  // tdd-helper conflita com code-saver — primeiro vence (tdd-helper, vem em by_role antes de by_plan)
  const { items, dropped } = resolve(perfil, curated);
  const names = items.map(i => i.name);
  assert.ok(!names.includes('context7'), 'context7 deveria ser filtrado (ja_tem_instalado)');
  assert.ok(names.includes('superpowers'));
  assert.ok(names.includes('tdd-helper'));
  assert.ok(!names.includes('code-saver'), 'code-saver deveria ser dropado por incompatible');
  assert.ok(dropped.some(d => d.name === 'code-saver' && d.kept === 'tdd-helper'));
});

test('resolve: source_section preenchido corretamente', () => {
  const perfil = loadPerfil('junior-balanceado');
  const curated = parseCurated(MOCK_CURATED);
  const { items } = resolve(perfil, curated);
  const superpowers = items.find(i => i.name === 'superpowers');
  assert.equal(superpowers.source_section, 'by_role');
});

test('resolve: papel sem entry em by_role retorna so essentials + by_plan', () => {
  const perfil = { ...loadPerfil('junior-balanceado'), papel: 'curioso', ja_tem_instalado: { mcps: [] } };
  const curated = parseCurated(MOCK_CURATED);
  const { items } = resolve(perfil, curated);
  const names = items.map(i => i.name);
  assert.ok(names.includes('context7')); // essentials (nao filtrado pq mcps vazio)
  assert.ok(names.includes('code-saver')); // by_plan.pro
  assert.ok(!names.includes('superpowers')); // sem by_role.curioso
});

test('resolve: ja_tem_instalado filtra por kind certo', () => {
  const perfil = { ...loadPerfil('junior-balanceado'), ja_tem_instalado: { skills: ['tdd-helper'], plugins: ['superpowers'] } };
  const curated = parseCurated(MOCK_CURATED);
  const { items } = resolve(perfil, curated);
  const names = items.map(i => i.name);
  assert.ok(!names.includes('tdd-helper'));
  assert.ok(!names.includes('superpowers'));
});

test('resolve: tudo vazio retorna {items:[], dropped:[]}', () => {
  const perfil = { papel: 'inexistente', plano_claude: 'inexistente', ja_tem_instalado: {} };
  const curated = { schema_version: 1, essentials: [], by_role: {}, by_plan: {}, incompatible: [] };
  const { items, dropped } = resolve(perfil, curated);
  assert.deepEqual(items, []);
  assert.deepEqual(dropped, []);
});

test('resolve: dedupe por name (essentials vence)', () => {
  const perfil = { papel: 'junior', plano_claude: 'pro', ja_tem_instalado: {} };
  const curated = {
    schema_version: 1,
    essentials: [{ name: 'dup', kind: 'mcp', install: 'a', why: 'a', source: 'curated' }],
    by_role: { junior: [{ name: 'dup', kind: 'mcp', install: 'b', why: 'b', source: 'curated' }] },
    by_plan: {},
    incompatible: [],
  };
  const { items } = resolve(perfil, curated);
  assert.equal(items.length, 1);
  assert.equal(items[0].source_section, 'essentials');
  assert.equal(items[0].install, 'a');
});
