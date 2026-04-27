import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { render } from '../lib/claude-md-template.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPerfil(name) {
  const md = readFileSync(path.join(ROOT, `tests/fixtures/perfil-vibecoder/${name}.md`), 'utf8');
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

test('render: contém papel + objetivos + stack', () => {
  const perfil = loadPerfil('empresario-autonomo');
  const md = render(perfil);
  assert.ok(md.includes('empresario'));
  assert.ok(md.includes('Lançar SaaS de IA pra contadores em 60 dias'));
  assert.ok(md.includes('fastapi'));
  assert.ok(md.includes('nextjs'));
});

test('render junior+iniciante+perguntativo: regra "explique antes de codar"', () => {
  const perfil = loadPerfil('junior-balanceado');
  const md = render({ ...perfil, experiencia_dev: 'iniciante', modo_autonomia: 'perguntativo' });
  assert.ok(/explique|português|portugues/i.test(md), 'esperava regra de explicar em pt');
  assert.ok(/plano|antes de implementar/i.test(md), 'esperava regra de plano');
});

test('render baixa tolerancia: regra de bloquear rm', () => {
  const perfil = loadPerfil('junior-balanceado');
  const md = render({ ...perfil, tolerancia_risco: 'baixa' });
  assert.ok(/rm|delete|destruti/i.test(md), 'esperava regra contra delete');
});

test('render autonomo+alta+silenciosa: tom diferente', () => {
  const perfil = loadPerfil('empresario-autonomo');
  const md = render(perfil);
  assert.ok(md.includes('autonomo'));
  assert.ok(md.includes('alta'));
  // intervencao silenciosa: NÃO deve sugerir hooks no comportamento padrão
  assert.ok(!/anti-burro|anti-preguicoso/.test(md), 'silenciosa nao deveria mencionar hooks');
});
