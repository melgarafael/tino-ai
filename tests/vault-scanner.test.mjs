// tests/vault-scanner.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanVault } from '../lib/vault-scanner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VAULT = path.resolve(__dirname, '..', 'tino-vault-sample', 'perfil-raw');

async function makeTempVault(structure) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-scanner-'));
  for (const [rel, content] of Object.entries(structure)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  return root;
}

test('scanVault: perfil-raw sample devolve README.md e foco-ativo.md com score > 0', async () => {
  const res = await scanVault(SAMPLE_VAULT);
  assert.equal(res.files.length >= 2, true, 'deveria ter pelo menos 2 arquivos');
  const paths = res.files.map((f) => f.path);
  assert.ok(paths.includes('README.md'), `esperava README.md em ${paths.join(', ')}`);
  assert.ok(paths.includes('foco-ativo.md'), `esperava foco-ativo.md em ${paths.join(', ')}`);
  for (const f of res.files) {
    assert.ok(f.score > 0, `score de ${f.path} deveria ser > 0, foi ${f.score}`);
  }
});

test('scanVault: foco-ativo.md recebe ponto no sinal de tags (sinal 5)', async () => {
  const res = await scanVault(SAMPLE_VAULT);
  const foco = res.files.find((f) => f.path === 'foco-ativo.md');
  assert.ok(foco, 'foco-ativo.md deveria existir');
  assert.equal(foco.signals.tags, 1, 'tag `foco` deveria ativar sinal 5');
});

test('scanVault: pasta Tino/ e ignorada por padrao', async () => {
  const root = await makeTempVault({
    'README.md': '# raiz',
    'Tino/_perfil.md': '# interno',
    'Tino/novidades/item.md': '# noticia',
  });
  const res = await scanVault(root);
  const paths = res.files.map((f) => f.path);
  assert.ok(paths.includes('README.md'));
  for (const p of paths) {
    assert.ok(!p.startsWith('Tino'), `nao deveria incluir ${p}`);
  }
});

test('scanVault: pasta vazia → files: []', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-empty-'));
  const res = await scanVault(root);
  assert.deepEqual(res.files, []);
});

test('scanVault: options.ignore pula pastas adicionais', async () => {
  const root = await makeTempVault({
    'README.md': '# raiz',
    'privado/segredo.md': '# nao leia',
    'publico/post.md': '# livre',
  });
  const res = await scanVault(root, { ignore: ['privado'] });
  const paths = res.files.map((f) => f.path);
  assert.ok(paths.includes('README.md'));
  assert.ok(paths.some((p) => p.includes('publico')));
  assert.ok(!paths.some((p) => p.includes('privado')), `vazou privado: ${paths.join(', ')}`);
});

test('scanVault: options.topN limita resultado', async () => {
  const root = await makeTempVault({
    'a.md': '# a',
    'b.md': '# b',
    'c.md': '# c',
    'README.md': '# readme',
  });
  const res = await scanVault(root, { topN: 2 });
  assert.equal(res.files.length, 2);
});

test('scanVault: ordena por score desc', async () => {
  const res = await scanVault(SAMPLE_VAULT);
  for (let i = 1; i < res.files.length; i++) {
    assert.ok(
      res.files[i - 1].score >= res.files[i].score,
      `ordem quebrada entre ${res.files[i - 1].path} (${res.files[i - 1].score}) e ${res.files[i].path} (${res.files[i].score})`,
    );
  }
});
