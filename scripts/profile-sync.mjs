#!/usr/bin/env node
// scripts/profile-sync.mjs
// Regenera _perfil.md preservando contadores e reseta o counter do refresh.
//
// Fluxo:
//   1. Valida vault tem Tino/_perfil.md
//   2. Re-roda setup.mjs logicamente (scan + geracao) — aqui chamado via import do scanner
//      para manter comportamento consistente; em modo --mock usa heuristicas determinsticas
//   3. Preserva {processadas, favoritadas, thumb_up, thumb_down, acerto} do perfil antigo
//   4. Escreve backup em Tino/_perfil.backup-<timestamp>.md
//   5. Reseta refreshes_desde_ultimo_profile_sync -> 0 em _config.md
//   6. Imprime summary JSON
//
// Flags:
//   --vault <path>  obrigatorio
//   --mock          regenera perfil heuristicamente (sem LLM). default nesta wave.
//   --dry-run       nao escreve; imprime diff sumarizado

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { parse as parseFm, serialize as serializeFm } from '../lib/frontmatter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SETUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'setup.mjs');

function parseArgs(argv) {
  const args = { vault: null, mock: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--vault') args.vault = argv[++i];
    else if (a === '--mock') args.mock = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'profile-sync — regenera _perfil.md preservando contadores',
    '',
    'Uso:',
    '  node scripts/profile-sync.mjs --vault <path> [--mock] [--dry-run]',
  ].join('\n') + '\n');
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function timestampCompact(d = new Date()) {
  const iso = d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return iso;
}

function diffChips(oldMeta, newMeta) {
  const keys = ['foco_ativo', 'identidade', 'evita'];
  const out = {};
  for (const k of keys) {
    const oldArr = Array.isArray(oldMeta[k]) ? oldMeta[k] : [];
    const newArr = Array.isArray(newMeta[k]) ? newMeta[k] : [];
    const oldSet = new Set(oldArr);
    const newSet = new Set(newArr);
    const added = newArr.filter((x) => !oldSet.has(x));
    const removed = oldArr.filter((x) => !newSet.has(x));
    out[k] = { added, removed };
  }
  return out;
}

function runSetupCli(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SETUP_SCRIPT, ...args], { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err && typeof err.code === 'number') { resolve({ code: err.code, stdout, stderr }); return; }
      if (err) { reject(err); return; }
      resolve({ code: 0, stdout, stderr });
    });
  });
}

export async function runProfileSync(opts) {
  if (!opts.vault) throw new Error('--vault e obrigatorio');
  const absVault = path.resolve(opts.vault);
  const tinoDir = path.join(absVault, 'Tino');
  const perfilPath = path.join(tinoDir, '_perfil.md');
  const configMdPath = path.join(tinoDir, '_config.md');

  if (!(await pathExists(perfilPath))) {
    throw new Error(`${perfilPath} nao encontrado — rode /tino:setup primeiro`);
  }
  const oldRaw = await fs.readFile(perfilPath, 'utf8');
  const oldParsed = parseFm(oldRaw);
  const preserved = {
    processadas: oldParsed.meta.processadas ?? 0,
    favoritadas: oldParsed.meta.favoritadas ?? 0,
    thumb_up: oldParsed.meta.thumb_up ?? 0,
    thumb_down: oldParsed.meta.thumb_down ?? 0,
    acerto: oldParsed.meta.acerto ?? 0,
  };

  // Para regenerar, precisamos escrever o novo perfil em um sandbox e comparar.
  // Estrategia simples: copia vault para tmp, roda setup --force, le o novo _perfil.md.
  // Assim nao precisamos modificar setup.mjs para nao-mexer-em-contadores.
  const os = await import('node:os');
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-profile-sync-'));

  // Copia recursiva dos arquivos do vault (sem _perfil existente — queremos gerar do zero).
  async function copyDir(src, dst) {
    await fs.mkdir(dst, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '.obsidian') continue;
      const s = path.join(src, e.name);
      const d = path.join(dst, e.name);
      if (e.isDirectory()) {
        // Ignora a pasta Tino/ — so queremos os arquivos-fonte do vault para extrair perfil.
        if (e.name === 'Tino') continue;
        await copyDir(s, d);
      } else if (e.isFile()) {
        await fs.copyFile(s, d);
      }
    }
  }
  await copyDir(absVault, sandbox);

  const setupArgs = ['--vault', sandbox, '--force'];
  if (opts.mock) setupArgs.push('--mock');
  const { code, stderr } = await runSetupCli(setupArgs);
  if (code !== 0) {
    throw new Error(`setup falhou (code ${code}): ${stderr}`);
  }
  const newPerfilPath = path.join(sandbox, 'Tino', '_perfil.md');
  const newRaw = await fs.readFile(newPerfilPath, 'utf8');
  const newParsed = parseFm(newRaw);

  // Merge: preserva contadores no novo meta.
  const mergedMeta = { ...newParsed.meta, ...preserved };
  const mergedText = serializeFm(mergedMeta, newParsed.body);

  const chipsDiff = diffChips(oldParsed.meta, newParsed.meta);

  let backupPath = null;
  if (!opts.dryRun) {
    backupPath = path.join(tinoDir, `_perfil.backup-${timestampCompact()}.md`);
    await fs.writeFile(backupPath, oldRaw, 'utf8');
    await fs.writeFile(perfilPath, mergedText, 'utf8');

    // Reseta counter em _config.md (cria se nao existir).
    let cfgMeta = { versao: 1, criado: new Date().toISOString().slice(0, 10) };
    let cfgBody = '# Config do Tino\n';
    if (await pathExists(configMdPath)) {
      const raw = await fs.readFile(configMdPath, 'utf8');
      const parsed = parseFm(raw);
      cfgMeta = parsed.meta;
      cfgBody = parsed.body;
    }
    cfgMeta.refreshes_desde_ultimo_profile_sync = 0;
    await fs.writeFile(configMdPath, serializeFm(cfgMeta, cfgBody), 'utf8');
  }

  // Cleanup sandbox.
  await fs.rm(sandbox, { recursive: true, force: true });

  return {
    summary: {
      vault: absVault,
      dry_run: !!opts.dryRun,
      backup: backupPath,
      counter_reset: !opts.dryRun,
      diff: chipsDiff,
      preserved,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.vault) {
    process.stderr.write('erro: --vault e obrigatorio\n');
    printHelp();
    process.exit(2);
  }
  try {
    const { summary } = await runProfileSync(args);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`fatal: ${e?.stack || e?.message || String(e)}\n`);
    process.exit(2);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) main();

export { parseArgs };
