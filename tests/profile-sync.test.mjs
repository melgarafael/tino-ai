// tests/profile-sync.test.mjs
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
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'profile-sync.mjs');
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
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-sync-vault-'));
  await copyDir(SAMPLE_VAULT, tmp);
  return tmp;
}

test('profile-sync: --dry-run nao escreve backup nem altera perfil', async () => {
  const vault = await mkVault();
  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  const before = await fs.readFile(perfilPath, 'utf8');

  const { code, stdout } = await runScript(['--vault', vault, '--mock', '--dry-run']);
  assert.equal(code, 0);
  const summary = JSON.parse(stdout);
  assert.equal(summary.dry_run, true);
  assert.equal(summary.backup, null);

  const after = await fs.readFile(perfilPath, 'utf8');
  assert.equal(after, before, 'dry-run nao deveria alterar _perfil.md');

  // Sem backup gerado.
  const tinoEntries = await fs.readdir(path.join(vault, 'Tino'));
  const backups = tinoEntries.filter((f) => f.startsWith('_perfil.backup-'));
  assert.equal(backups.length, 0);
});

test('profile-sync: reseta refreshes_desde_ultimo_profile_sync para 0', async () => {
  const vault = await mkVault();
  const configPath = path.join(vault, 'Tino', '_config.md');
  const raw = await fs.readFile(configPath, 'utf8');
  const { meta, body } = parse(raw);
  meta.refreshes_desde_ultimo_profile_sync = 17;
  await fs.writeFile(configPath, serialize(meta, body), 'utf8');

  const { code } = await runScript(['--vault', vault, '--mock']);
  assert.equal(code, 0);

  const after = parse(await fs.readFile(configPath, 'utf8')).meta;
  assert.equal(after.refreshes_desde_ultimo_profile_sync, 0);
});

test('profile-sync: cria backup do _perfil.md antigo', async () => {
  const vault = await mkVault();
  const perfilPath = path.join(vault, 'Tino', '_perfil.md');
  const before = await fs.readFile(perfilPath, 'utf8');

  const { code, stdout } = await runScript(['--vault', vault, '--mock']);
  assert.equal(code, 0);
  const summary = JSON.parse(stdout);
  assert.ok(summary.backup, 'esperava backup no summary');
  assert.ok(summary.backup.includes('_perfil.backup-'), summary.backup);

  const backupContent = await fs.readFile(summary.backup, 'utf8');
  assert.equal(backupContent, before, 'backup deveria ser identico ao perfil antigo');
});
