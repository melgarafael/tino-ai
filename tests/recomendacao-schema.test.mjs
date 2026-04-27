import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = JSON.parse(
  readFileSync(path.join(ROOT, 'config/schemas/recomendacao.schema.json'), 'utf8')
);

function loadFixture(name) {
  const md = readFileSync(
    path.join(ROOT, `tests/fixtures/recomendacao/${name}.md`),
    'utf8'
  );
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`fixture ${name} sem frontmatter`);
  return parseYaml(m[1]);
}

function makeValidator() {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(SCHEMA);
}

test('valid recomendacao passa no schema', () => {
  const data = loadFixture('valid');
  const v = makeValidator();
  assert.equal(v(data), true, JSON.stringify(v.errors, null, 2));
});

test('recomendacao sem campo obrigatorio falha', () => {
  const data = loadFixture('missing-required');
  const v = makeValidator();
  assert.equal(v(data), false);
  assert.ok(v.errors.some((e) => e.keyword === 'required'));
});

test('recomendacao com source_section invalido falha', () => {
  const data = loadFixture('bad-enum');
  const v = makeValidator();
  assert.equal(v(data), false);
  assert.ok(v.errors.some((e) => e.keyword === 'enum'));
});
