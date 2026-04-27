import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { render } from '../lib/recomendacao-render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = JSON.parse(
  readFileSync(path.join(ROOT, 'config/schemas/recomendacao.schema.json'), 'utf8')
);

function extractFm(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

function makeValidator() {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(SCHEMA);
}

test('render: produz markdown que valida no schema', () => {
  const items = [
    { name: 'context7', kind: 'mcp', source_section: 'essentials', install: 'x', why: 'docs' },
    { name: 'superpowers', kind: 'plugin', source_section: 'by_role', install: 'y', why: 'tdd' },
  ];
  const perfil = { papel: 'junior', plano_claude: 'pro' };
  const md = render(items, perfil, []);
  const fm = extractFm(md);
  const v = makeValidator();
  assert.equal(v(fm), true, JSON.stringify(v.errors, null, 2));
});

test('render: counts batem com items', () => {
  const items = [
    { name: 'a', kind: 'mcp', source_section: 'essentials', install: 'x', why: 'x' },
    { name: 'b', kind: 'plugin', source_section: 'by_role', install: 'x', why: 'x' },
    { name: 'c', kind: 'plugin', source_section: 'by_role', install: 'x', why: 'x' },
  ];
  const extras = [
    { name: 'd', kind: 'skill', install: 'x', why: 'x', aitmpl_id: 'd' },
  ];
  const md = render(items, { papel: 'x' }, extras);
  const fm = extractFm(md);
  assert.equal(fm.counts.total, 4);
  assert.equal(fm.counts.essentials, 1);
  assert.equal(fm.counts.by_role, 2);
  assert.equal(fm.counts.extras_aitmpl, 1);
});

test('render: extras ganham source_section "extras_aitmpl"', () => {
  const items = [];
  const extras = [
    { name: 'extra-x', kind: 'skill', install: 'i', why: 'w', aitmpl_id: 'extra-x' },
  ];
  const md = render(items, {}, extras);
  const fm = extractFm(md);
  assert.equal(fm.items[0].source_section, 'extras_aitmpl');
  assert.equal(fm.items[0].aitmpl_id, 'extra-x');
});
