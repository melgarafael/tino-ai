// tests/deep-dive.test.mjs
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
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'deep-dive.mjs');

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SCRIPT, ...args], { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err && typeof err.code === 'number') { resolve({ code: err.code, stdout, stderr }); return; }
      if (err) { reject(err); return; }
      resolve({ code: 0, stdout, stderr });
    });
  });
}

async function mkVaultWithNovidade({ favorito }) {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-dd-vault-'));
  const tinoDir = path.join(vault, 'Tino');
  const novidadesDir = path.join(tinoDir, 'novidades');
  const favoritosDir = path.join(tinoDir, 'favoritos');
  await fs.mkdir(novidadesDir, { recursive: true });
  await fs.mkdir(favoritosDir, { recursive: true });

  const id = 'claude-agent-sdk-1-0';
  const meta = {
    id,
    titulo: 'Claude Agent SDK 1.0',
    fonte: 'anthropic_news',
    data: '2026-04-21',
    tipo: 'news',
    nota: 9.2,
    veredito: 'Foca',
    resumo: 'Stable APIs para tool orchestration e streaming.',
    cite: '_perfil.md',
    url: 'https://www.anthropic.com/news/claude-agent-sdk-1-0',
    favorito,
  };
  const body = 'Match heuristico contra _perfil.md';
  await fs.writeFile(path.join(novidadesDir, `${id}.md`), serialize(meta, body) + '\n', 'utf8');

  // perfil minimo so pra nao quebrar outras invocacoes.
  await fs.writeFile(path.join(tinoDir, '_perfil.md'), '---\ntipo: perfil\n---\n\n# perfil\n', 'utf8');
  return { vault, id };
}

test('deep-dive: sem favorito -> exit code != 0 e nao escreve arquivo', async () => {
  const { vault, id } = await mkVaultWithNovidade({ favorito: false });
  const { code, stderr } = await runScript(['--vault', vault, '--id', id, '--mock']);
  assert.notEqual(code, 0, `stderr: ${stderr}`);
  assert.ok(/favorit/i.test(stderr), `esperava mensagem sobre favorito; stderr=${stderr}`);

  const favs = await fs.readdir(path.join(vault, 'Tino', 'favoritos'));
  assert.equal(favs.length, 0, 'nao deveria ter gerado arquivo em favoritos/');
});

test('deep-dive: com favorito + mock -> template em favoritos/', async () => {
  const { vault, id } = await mkVaultWithNovidade({ favorito: true });
  const { code, stdout } = await runScript(['--vault', vault, '--id', id, '--mock']);
  assert.equal(code, 0, `stdout: ${stdout}`);
  const summary = JSON.parse(stdout);
  const outPath = summary.out;
  assert.ok(outPath.includes('-deep-dive.md'));
  const exists = await fs.stat(outPath).then(() => true, () => false);
  assert.ok(exists, `arquivo nao criado em ${outPath}`);
});

test('deep-dive: template tem as 3 secoes obrigatorias', async () => {
  const { vault, id } = await mkVaultWithNovidade({ favorito: true });
  const { code, stdout } = await runScript(['--vault', vault, '--id', id, '--mock']);
  assert.equal(code, 0);
  const summary = JSON.parse(stdout);
  const text = await fs.readFile(summary.out, 'utf8');
  assert.ok(/^##\s+Tutoriais de uso/m.test(text), 'falta secao Tutoriais de uso');
  assert.ok(/^##\s+Casos de sucesso/m.test(text), 'falta secao Casos de sucesso');
  assert.ok(/^##\s+O que a comunidade esta falando/m.test(text), 'falta secao comunidade');
});
