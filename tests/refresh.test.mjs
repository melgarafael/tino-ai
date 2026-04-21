// tests/refresh.test.mjs
// Testes do orquestrador de refresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../lib/frontmatter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'refresh.mjs');
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'rss');
const SAMPLE_VAULT = path.join(PROJECT_ROOT, 'tino-vault-sample', 'perfil-raw');

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SCRIPT, ...args], { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err && typeof err.code === 'number') { resolve({ code: err.code, stdout, stderr }); return; }
      if (err) { reject(err); return; }
      resolve({ code: 0, stdout, stderr });
    });
  });
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isFile()) await fs.copyFile(s, d);
  }
}

async function mkVault() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-refresh-vault-'));
  await copyDir(SAMPLE_VAULT, tmp);
  return tmp;
}

function extractSummary(stdout) {
  // O script imprime o warning (opcional) + o JSON. Pega o primeiro { ate o fim.
  const idx = stdout.indexOf('{');
  if (idx < 0) return null;
  return JSON.parse(stdout.slice(idx));
}

test('refresh: e2e mock+fixture gera novidades/', async () => {
  const vault = await mkVault();
  const { code, stdout, stderr } = await runScript([
    '--vault', vault,
    '--mock',
    '--fixture-dir', FIXTURE_DIR,
    '--force',
  ]);
  assert.equal(code, 0, `stderr: ${stderr}`);
  const summary = extractSummary(stdout);
  assert.ok(summary, `no summary in stdout: ${stdout}`);
  assert.ok(summary.novidades_criadas > 0, `novidades_criadas=${summary.novidades_criadas}`);

  const novidadesDir = path.join(vault, 'Tino', 'novidades');
  const files = await fs.readdir(novidadesDir);
  const mds = files.filter((f) => f.endsWith('.md'));
  assert.ok(mds.length > 0, `esperava .md em ${novidadesDir}`);
});

test('refresh: incrementa counter em _config.md', async () => {
  const vault = await mkVault();
  const configPath = path.join(vault, 'Tino', '_config.md');

  // inicial: counter = 0 (sample)
  const before = parse(await fs.readFile(configPath, 'utf8')).meta;
  assert.equal(before.refreshes_desde_ultimo_profile_sync, 0);

  await runScript(['--vault', vault, '--mock', '--fixture-dir', FIXTURE_DIR, '--force']);
  const afterFirst = parse(await fs.readFile(configPath, 'utf8')).meta;
  assert.equal(afterFirst.refreshes_desde_ultimo_profile_sync, 1);

  await runScript(['--vault', vault, '--mock', '--fixture-dir', FIXTURE_DIR, '--force']);
  const afterSecond = parse(await fs.readFile(configPath, 'utf8')).meta;
  assert.equal(afterSecond.refreshes_desde_ultimo_profile_sync, 2);
});

test('refresh: counter >= threshold -> aviso profile-sync no stdout', async () => {
  const vault = await mkVault();
  const configPath = path.join(vault, 'Tino', '_config.md');
  // Pre-seta counter pra 2 e threshold pra 3 — assim a primeira refresh (count=3) dispara aviso.
  const raw = await fs.readFile(configPath, 'utf8');
  const { meta, body } = parse(raw);
  meta.refreshes_desde_ultimo_profile_sync = 2;
  await fs.writeFile(configPath, serialize(meta, body), 'utf8');

  const { code, stdout } = await runScript([
    '--vault', vault,
    '--mock',
    '--fixture-dir', FIXTURE_DIR,
    '--force',
    '--sync-threshold', '3',
  ]);
  assert.equal(code, 0);
  assert.ok(
    stdout.includes('profile-sync'),
    `esperava aviso profile-sync no stdout, recebi: ${stdout.slice(0, 500)}`,
  );
  const summary = extractSummary(stdout);
  assert.equal(summary.sync_recommended, true);
  assert.equal(summary.refreshes_desde_ultimo_profile_sync, 3);
});

test('refresh: 2 refreshes seguidos preservam favorito=true', async () => {
  const vault = await mkVault();
  const novidadesDir = path.join(vault, 'Tino', 'novidades');

  await runScript(['--vault', vault, '--mock', '--fixture-dir', FIXTURE_DIR, '--force']);
  const filesAfter1 = (await fs.readdir(novidadesDir)).filter((f) => f.endsWith('.md'));
  assert.ok(filesAfter1.length > 0);

  const target = path.join(novidadesDir, filesAfter1[0]);
  const firstRaw = await fs.readFile(target, 'utf8');
  const { meta, body } = parse(firstRaw);
  meta.favorito = true;
  await fs.writeFile(target, serialize(meta, body) + '\n', 'utf8');

  await runScript(['--vault', vault, '--mock', '--fixture-dir', FIXTURE_DIR, '--force']);
  const afterRaw = await fs.readFile(target, 'utf8');
  const afterParsed = parse(afterRaw);
  assert.equal(afterParsed.meta.favorito, true, 'favorito nao foi preservado');
});
