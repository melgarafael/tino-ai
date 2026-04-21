#!/usr/bin/env node
// scripts/deep-dive.mjs
// Enriquece uma novidade favoritada com tutorial + casos + comunidade.
//
// Flags:
//   --vault <path>   obrigatorio
//   --id <id>        obrigatorio — id ou slug do arquivo em Tino/novidades/
//   --mock           gera template sem invocar agent/Claude (default nesta wave)
//
// Sai com erro se a novidade nao existe OU se `favorito: true` nao estiver setado.
// Em modo mock, escreve <vault>/Tino/favoritos/<id>-deep-dive.md com 3 secoes:
//   ## Tutoriais de uso
//   ## Casos de sucesso
//   ## O que a comunidade esta falando

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse as parseFm, serialize as serializeFm } from '../lib/frontmatter.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const args = { vault: null, id: null, mock: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--vault') args.vault = argv[++i];
    else if (a === '--id') args.id = argv[++i];
    else if (a === '--mock') args.mock = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'deep-dive — enriquece uma novidade favoritada',
    '',
    'Uso:',
    '  node scripts/deep-dive.mjs --vault <path> --id <id> [--mock]',
  ].join('\n') + '\n');
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function locateNovidade(novidadesDir, id) {
  // 1. tenta match exato <id>.md
  const direct = path.join(novidadesDir, `${id}.md`);
  if (await pathExists(direct)) return direct;
  // 2. tenta contains (slug contem id)
  let files = [];
  try { files = await fs.readdir(novidadesDir); } catch { return null; }
  const target = id.toLowerCase();
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.md')) continue;
    const slug = f.slice(0, -3).toLowerCase();
    if (slug === target) return path.join(novidadesDir, f);
  }
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.md')) continue;
    if (f.toLowerCase().includes(target)) return path.join(novidadesDir, f);
  }
  // 3. tenta comparar via meta.id/titulo
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.md')) continue;
    try {
      const raw = await fs.readFile(path.join(novidadesDir, f), 'utf8');
      const { meta } = parseFm(raw);
      if (String(meta.id || '').toLowerCase() === target) return path.join(novidadesDir, f);
      if (String(meta.titulo || '').toLowerCase().includes(target)) return path.join(novidadesDir, f);
    } catch { /* skip */ }
  }
  return null;
}

function buildDeepDiveTemplate({ meta }) {
  const titulo = meta.titulo || meta.id || 'Novidade';
  const url = meta.url || '';
  const fonte = meta.fonte || '';
  const lines = [];
  lines.push(`# Deep dive — ${titulo}`);
  lines.push('');
  lines.push('> Template gerado em modo `--mock`. Invoque o subagent `deep-diver` para preencher com pesquisa real.');
  lines.push('');
  if (url) lines.push(`Fonte original: ${url}`);
  if (fonte) lines.push(`Feed: ${fonte}`);
  lines.push('');
  lines.push('## Tutoriais de uso');
  lines.push('');
  lines.push('_(a preencher: passo-a-passo, exemplos minimos, comandos reproduziveis)_');
  lines.push('');
  lines.push('## Casos de sucesso');
  lines.push('');
  lines.push('_(a preencher: quem ja usou, resultados mensuraveis, lessons learned)_');
  lines.push('');
  lines.push('## O que a comunidade esta falando');
  lines.push('');
  lines.push('_(a preencher: posts, threads, repos, reacoes notaveis)_');
  lines.push('');
  return lines.join('\n');
}

export async function runDeepDive(opts) {
  if (!opts.vault) throw new Error('--vault e obrigatorio');
  if (!opts.id) throw new Error('--id e obrigatorio');

  const absVault = path.resolve(opts.vault);
  const tinoDir = path.join(absVault, 'Tino');
  const novidadesDir = path.join(tinoDir, 'novidades');
  const favoritosDir = path.join(tinoDir, 'favoritos');

  if (!(await pathExists(novidadesDir))) {
    throw new Error(`${novidadesDir} nao encontrado — rode /tino:refresh primeiro`);
  }

  const file = await locateNovidade(novidadesDir, opts.id);
  if (!file) {
    const err = new Error(`novidade "${opts.id}" nao encontrada em ${novidadesDir}`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  const raw = await fs.readFile(file, 'utf8');
  const { meta } = parseFm(raw);

  if (meta.favorito !== true) {
    const err = new Error(`novidade "${opts.id}" nao esta favoritada (meta.favorito != true). Marque como favorito antes de rodar deep-dive para nao desperdicar custo.`);
    err.code = 'NOT_FAVORITO';
    throw err;
  }

  if (!opts.mock) {
    const err = new Error('modo real requer invocar o subagent `deep-diver` via Claude Code. Rode com --mock para gerar template, ou use /tino:deep-dive pelo Claude.');
    err.code = 'REAL_MODE_REQUIRES_AGENT';
    throw err;
  }

  await fs.mkdir(favoritosDir, { recursive: true });
  const slug = path.basename(file, '.md');
  const outPath = path.join(favoritosDir, `${slug}-deep-dive.md`);
  const body = buildDeepDiveTemplate({ meta });
  const outMeta = {
    id: String(meta.id || slug),
    titulo: String(meta.titulo || ''),
    fonte: String(meta.fonte || ''),
    url: String(meta.url || ''),
    tipo: 'deep-dive',
    modo: 'mock',
    gerado_em: new Date().toISOString().slice(0, 10),
  };
  await fs.writeFile(outPath, serializeFm(outMeta, body) + '\n', 'utf8');

  return {
    summary: {
      vault: absVault,
      source: file,
      out: outPath,
      mode: 'mock',
      sections: ['Tutoriais de uso', 'Casos de sucesso', 'O que a comunidade esta falando'],
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.vault || !args.id) {
    process.stderr.write('erro: --vault e --id sao obrigatorios\n');
    printHelp();
    process.exit(2);
  }
  try {
    const { summary } = await runDeepDive(args);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`${e?.message || String(e)}\n`);
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) main();

export { parseArgs };
