// tests/perfil-vibecoder-schema.test.mjs
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
  readFileSync(path.join(ROOT, 'config/schemas/perfil-vibecoder.schema.json'), 'utf8')
);

function loadFixture(name) {
  const md = readFileSync(
    path.join(ROOT, `tests/fixtures/perfil-vibecoder/${name}.md`),
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

test('valid fixture passa no schema', () => {
  const data = loadFixture('valid');
  const validate = makeValidator();
  const ok = validate(data);
  assert.equal(ok, true, JSON.stringify(validate.errors, null, 2));
});

test('fixture com enum invalido eh rejeitada', () => {
  const data = loadFixture('bad-enum');
  const validate = makeValidator();
  const ok = validate(data);
  assert.equal(ok, false);
  assert.ok(
    validate.errors.some((e) => e.keyword === 'enum'),
    `esperava erro de enum, vieram: ${JSON.stringify(validate.errors)}`
  );
});

test('fixture sem campo obrigatorio eh rejeitada', () => {
  const data = loadFixture('missing-required');
  const validate = makeValidator();
  const ok = validate(data);
  assert.equal(ok, false);
  assert.ok(
    validate.errors.some((e) => e.keyword === 'required'),
    `esperava erro de required, vieram: ${JSON.stringify(validate.errors)}`
  );
});
