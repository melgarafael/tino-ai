import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks/anti-preguicoso.mjs');

let vault;

beforeEach(async () => {
  vault = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-hook-'));
  await fs.mkdir(path.join(vault, 'Tino'), { recursive: true });
});

function runHook(stdin, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK], { env: { ...process.env, ...env, TINO_VAULT_PATH: vault } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', reject);
    proc.stdin.write(JSON.stringify(stdin));
    proc.stdin.end();
  });
}

async function writePerfil(intervencao) {
  const md = `---
schema_version: 1
papel: junior
experiencia_dev: iniciante
plano_claude: pro
sistema: darwin
tipo_projeto: [webapp]
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ${intervencao}
---
body
`;
  await fs.writeFile(path.join(vault, 'Tino', '_perfil-vibecoder.md'), md, 'utf8');
}

test('anti-preguicoso: perfil ausente -> exit 0 silent', async () => {
  const { code, stdout, stderr } = await runHook({ prompt: 'isso aqui', cwd: '/tmp' });
  assert.equal(code, 0);
  assert.equal(stderr.trim(), '');
});

test('anti-preguicoso: ativa + prompt vago -> exit 0 + stderr tem box', async () => {
  await writePerfil('ativa');
  const { code, stderr } = await runHook({ prompt: 'isso', cwd: '/tmp' });
  assert.equal(code, 0);
  assert.ok(stderr.includes('Tino') && stderr.includes('preguic'));
});

test('anti-preguicoso: agressiva + prompt curto -> exit 2 + stderr tem box', async () => {
  await writePerfil('agressiva');
  const { code, stderr } = await runHook({ prompt: 'faz', cwd: '/tmp' });
  assert.equal(code, 2);
  assert.ok(stderr.includes('Tino'));
});
