import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parse as parseYaml } from 'yaml';
import { write, validate } from '../lib/perfil-vibecoder-writer.mjs';

let vaultDir;

beforeEach(async () => {
  vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-vault-'));
  await fs.mkdir(path.join(vaultDir, 'Tino'), { recursive: true });
});

const validFm = {
  schema_version: 1,
  papel: 'junior',
  experiencia_dev: 'iniciante',
  plano_claude: 'pro',
  sistema: 'darwin',
  tipo_projeto: ['webapp'],
  modo_autonomia: 'balanceado',
  tolerancia_risco: 'media',
  intervencao_hooks: 'ativa',
};

const validBody = {
  importante: 'Construir Tino',
  evitar: 'Erros silenciosos',
  notas: '',
};

test('write: cria _perfil-vibecoder.md valido', async () => {
  const filePath = await write(vaultDir, validFm, validBody);
  assert.equal(filePath, path.join(vaultDir, 'Tino', '_perfil-vibecoder.md'));
  const content = await fs.readFile(filePath, 'utf8');
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  const parsed = parseYaml(m[1]);
  assert.equal(parsed.papel, 'junior');
  assert.ok(parsed.created_at);
  assert.ok(parsed.updated_at);
  assert.ok(content.includes('## O que mais importa pra você agora'));
  assert.ok(content.includes('Construir Tino'));
});

test('validate: aceita frontmatter valido', () => {
  const errs = validate(validFm);
  assert.deepEqual(errs, [], JSON.stringify(errs));
});

test('validate: rejeita frontmatter invalido', () => {
  const bad = { ...validFm, papel: 'inexistente' };
  const errs = validate(bad);
  assert.ok(errs.length > 0);
  assert.ok(errs.some((e) => e.includes('papel') || e.includes('enum')), `vieram: ${errs}`);
});
