// tests/setup.test.mjs
// Smoke-tests do orquestrador scripts/setup.mjs.
// Cobertura:
//   - --mock produz _perfil.md valido (frontmatter parseavel, 3 secoes)
//   - --mock menciona "Claude" e "Tomik" (palavras do sample)
//   - --force sobrescreve
//   - Sem --force e com Tino/ existente: idempotente, avisa
//   - --vault inexistente: exit code != 0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from '../lib/frontmatter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SETUP_SCRIPT = path.join(REPO_ROOT, 'scripts', 'setup.mjs');
const SAMPLE_VAULT = path.join(REPO_ROOT, 'tino-vault-sample', 'perfil-raw');

function runSetup(args, opts = {}) {
  const res = spawnSync('node', [SETUP_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...opts,
  });
  return {
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

// Copia o sample pra um tmpdir para nao sujar o vault real do repo.
async function cloneSampleVault() {
  const dst = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-setup-test-'));
  const entries = await fs.readdir(SAMPLE_VAULT, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile()) {
      const src = path.join(SAMPLE_VAULT, e.name);
      await fs.copyFile(src, path.join(dst, e.name));
    }
  }
  return dst;
}

test('setup --mock escreve _perfil.md valido com frontmatter e 3 secoes', async () => {
  const vault = await cloneSampleVault();
  const { code, stdout } = runSetup(['--vault', vault, '--mock', '--force']);
  assert.equal(code, 0, `stdout:\n${stdout}`);

  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  const raw = await fs.readFile(perfilPath, 'utf8');
  const { meta, body } = parse(raw);

  assert.equal(meta.tipo, 'perfil');
  assert.equal(meta.modo, 'mock');
  assert.ok(typeof meta.fontes === 'number' && meta.fontes > 0);
  assert.match(body, /## Identidade/);
  assert.match(body, /## Foco ativo/);
  assert.match(body, /## Evita/);
});

test('setup --mock menciona "Claude" e "Tomik" (vindas do sample)', async () => {
  const vault = await cloneSampleVault();
  const { code } = runSetup(['--vault', vault, '--mock', '--force']);
  assert.equal(code, 0);

  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  const raw = await fs.readFile(perfilPath, 'utf8');
  const lower = raw.toLowerCase();
  assert.ok(lower.includes('claude'), 'esperava mencao a "Claude" no _perfil.md');
  assert.ok(lower.includes('tomik'), 'esperava mencao a "Tomik" no _perfil.md');
});

test('setup cria _config.md, novidades/ e favoritos/ dentro de Tino/', async () => {
  const vault = await cloneSampleVault();
  const { code } = runSetup(['--vault', vault, '--mock', '--force']);
  assert.equal(code, 0);

  const tinoDir = path.join(vault, 'Tino');
  const configStat = await fs.stat(path.join(tinoDir, '_config.md'));
  assert.ok(configStat.isFile());
  const novidadesStat = await fs.stat(path.join(tinoDir, 'novidades'));
  assert.ok(novidadesStat.isDirectory());
  const favoritosStat = await fs.stat(path.join(tinoDir, 'favoritos'));
  assert.ok(favoritosStat.isDirectory());
});

test('setup --force sobrescreve _perfil.md existente', async () => {
  const vault = await cloneSampleVault();
  // Primeira rodada cria o arquivo.
  runSetup(['--vault', vault, '--mock', '--force']);
  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  // Adultera pra saber se foi sobrescrito.
  await fs.writeFile(perfilPath, 'CONTEUDO ADULTERADO', 'utf8');

  const { code } = runSetup(['--vault', vault, '--mock', '--force']);
  assert.equal(code, 0);
  const raw = await fs.readFile(perfilPath, 'utf8');
  assert.ok(!raw.includes('CONTEUDO ADULTERADO'), 'esperava que --force sobrescrevesse');
  assert.match(raw, /tipo: perfil/);
});

test('setup sem --force e com Tino/ existente: idempotente, nao destroi, avisa', async () => {
  const vault = await cloneSampleVault();
  // Cria uma primeira versao com --mock --force.
  runSetup(['--vault', vault, '--mock', '--force']);
  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  const before = await fs.readFile(perfilPath, 'utf8');

  // Segunda rodada SEM --force e sem --mock: nao deve destruir.
  const { code, stdout } = runSetup(['--vault', vault]);
  assert.equal(code, 0);
  assert.match(stdout.toLowerCase(), /aviso|force/);

  const after = await fs.readFile(perfilPath, 'utf8');
  assert.equal(after, before, 'conteudo mudou sem --force');
});

test('setup --vault inexistente: exit code != 0', () => {
  const bogus = path.join(os.tmpdir(), `nao-existe-${Date.now()}`);
  const { code, stderr } = runSetup(['--vault', bogus]);
  assert.notEqual(code, 0, 'esperava exit code != 0');
  assert.match(stderr.toLowerCase(), /vault|nao encontrado|erro/);
});

test('setup sem --vault: exit code != 0 e mensagem de erro', () => {
  const { code, stderr } = runSetup([]);
  assert.notEqual(code, 0);
  assert.match(stderr.toLowerCase(), /vault|obrigat/);
});

test('setup sem --mock gera placeholder com modo: placeholder', async () => {
  const vault = await cloneSampleVault();
  const { code } = runSetup(['--vault', vault, '--force']);
  assert.equal(code, 0);

  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  const raw = await fs.readFile(perfilPath, 'utf8');
  const { meta, body } = parse(raw);
  assert.equal(meta.modo, 'placeholder');
  assert.match(body, /profile-extractor/);
});

test('setup imprime JSON summary no stdout', async () => {
  const vault = await cloneSampleVault();
  const { code, stdout } = runSetup(['--vault', vault, '--mock', '--force']);
  assert.equal(code, 0);

  // Pega o ultimo bloco JSON do stdout.
  const match = stdout.match(/\{[\s\S]*\}\s*$/);
  assert.ok(match, `esperava JSON no fim do stdout:\n${stdout}`);
  const summary = JSON.parse(match[0]);
  assert.equal(summary.mode, 'mock');
  assert.equal(summary.wrote, true);
  assert.ok(Array.isArray(summary.topFiles));
  assert.ok(summary.topFiles.length > 0);
});
