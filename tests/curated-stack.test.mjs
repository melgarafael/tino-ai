// tests/curated-stack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, validate } from '../lib/curated-stack.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STACK_PATH = path.join(ROOT, 'config/curated-stack.yaml');

test('parse: arquivo real eh YAML valido', () => {
  const obj = parse(STACK_PATH);
  assert.equal(obj.schema_version, 1);
  assert.ok(Array.isArray(obj.maintainers));
  assert.ok(Array.isArray(obj.essentials));
});

test('validate: arquivo real passa em todas as regras', () => {
  const obj = parse(STACK_PATH);
  const errs = validate(obj);
  assert.deepEqual(errs, [], `erros inesperados: ${JSON.stringify(errs, null, 2)}`);
});

test('validate: schema_version diferente de 1 falha', () => {
  const errs = validate({ schema_version: 2, maintainers: [], essentials: [], by_role: {}, by_plan: {}, incompatible: [] });
  assert.ok(errs.some((e) => e.includes('schema_version')));
});

test('validate: item sem campo obrigatorio falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'x', kind: 'mcp' }], // falta install, why, source
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('install')), `esperava erro de install, vieram: ${errs}`);
  assert.ok(errs.some((e) => e.includes('why')));
  assert.ok(errs.some((e) => e.includes('source')));
});

test('validate: kind invalido falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'x', kind: 'banana', install: 'x', why: 'x', source: 'curated' }],
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('kind')));
});

test('validate: source aitmpl sem aitmpl_id falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'x', kind: 'mcp', install: 'x', why: 'x', source: 'aitmpl' }],
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('aitmpl_id')));
});

test('validate: incompatible referenciando item ausente falha', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [{ name: 'a', kind: 'mcp', install: 'x', why: 'x', source: 'curated' }],
    by_role: {},
    by_plan: {},
    incompatible: [{ items: ['a', 'fantasma'], reason: 'r' }],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('fantasma')));
});

test('validate: nomes duplicados na mesma secao falham', () => {
  const obj = {
    schema_version: 1,
    maintainers: ['a@b.c'],
    essentials: [
      { name: 'a', kind: 'mcp', install: 'x', why: 'x', source: 'curated' },
      { name: 'a', kind: 'skill', install: 'y', why: 'y', source: 'curated' },
    ],
    by_role: {},
    by_plan: {},
    incompatible: [],
  };
  const errs = validate(obj);
  assert.ok(errs.some((e) => e.includes('duplicado')));
});
