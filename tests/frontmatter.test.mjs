// tests/frontmatter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../lib/frontmatter.mjs';

test('parse: texto sem frontmatter retorna body cru e meta vazio', () => {
  const text = '# Titulo\n\nCorpo sem frontmatter.';
  const { meta, body } = parse(text);
  assert.deepEqual(meta, {});
  assert.equal(body, text);
});

test('parse: string, number (decimal), boolean', () => {
  const text = `---\ntitulo: Meu Doc\nnota: 9.4\nativo: true\narquivado: false\n---\ncorpo`;
  const { meta } = parse(text);
  assert.equal(meta.titulo, 'Meu Doc');
  assert.equal(meta.nota, 9.4);
  assert.equal(meta.ativo, true);
  assert.equal(meta.arquivado, false);
});

test('parse: array inline [a, b, c]', () => {
  const text = `---\ntags: [foco, ativo, perfil]\n---\nbody`;
  const { meta } = parse(text);
  assert.deepEqual(meta.tags, ['foco', 'ativo', 'perfil']);
});

test('parse: body multi-linha preserva markdown', () => {
  const text = `---\nk: v\n---\n# H1\n\n- item 1\n- item 2\n\n\`\`\`js\nconst a = 1;\n\`\`\`\n`;
  const { body } = parse(text);
  assert.match(body, /# H1/);
  assert.match(body, /- item 1/);
  assert.match(body, /const a = 1;/);
});

test('round-trip: parse(serialize(meta, body)) retorna valores equivalentes', () => {
  const meta = {
    titulo: 'Tino',
    tags: ['foco', 'ativo'],
    nota: 9.4,
    ativo: true,
    arquivado: false,
  };
  const body = '# Tino\n\nCorpo de teste.\n';
  const text = serialize(meta, body);
  const parsed = parse(text);
  assert.deepEqual(parsed.meta, meta);
  assert.equal(parsed.body.trim(), body.trim());
});

test('round-trip: arrays preservam ordem e tipos', () => {
  const meta = { tags: ['a', 'b', 'c'] };
  const body = 'corpo';
  const parsed = parse(serialize(meta, body));
  assert.deepEqual(parsed.meta.tags, ['a', 'b', 'c']);
});

test('round-trip: booleans nao viram string', () => {
  const meta = { on: true, off: false };
  const parsed = parse(serialize(meta, ''));
  assert.equal(parsed.meta.on, true);
  assert.equal(parsed.meta.off, false);
});

test('round-trip: decimais preservam', () => {
  const meta = { score: 3.1415, whole: 42 };
  const parsed = parse(serialize(meta, ''));
  assert.equal(parsed.meta.score, 3.1415);
  assert.equal(parsed.meta.whole, 42);
});
