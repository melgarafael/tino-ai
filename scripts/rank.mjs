#!/usr/bin/env node
// scripts/rank.mjs
// CLI: rankeia itens cacheados de novidades contra um _perfil.md.
//
// Flags:
//   --profile <path>       _perfil.md (obrigatorio no modo explicito)
//   --cache-dir <path>     diretorio com os JSONs do fetch-all (obrigatorio)
//   --out-dir <path>       diretorio destino dos <id>.md (obrigatorio)
//   --adjustments <path>   opcional, <vault>/Tino/_ajustes.md
//   --mock                 usa rankMock deterministico (sem LLM)
//   --dry-run              imprime ranks sem escrever
//
// Fluxo mock:
//   1. Le perfil (frontmatter + body via lib/frontmatter.mjs)
//   2. Le ajustes se existir (frontmatter com ignore_tags)
//   3. Le TODOS os .json do cache-dir, flat-concatena items
//   4. rankMock(perfil, item, ajustes) por item
//   5. Preserva `favorito: true` de arquivo existente em out-dir
//   6. Escreve <out-dir>/<id>.md com frontmatter dashboard-compatible
//   7. Summary JSON em stdout: { ranqueados, foca, considera, acompanha, ignore, ... }

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../lib/frontmatter.mjs';
import { rankMock } from '../lib/rank-mock.mjs';
import { readAdjustments } from '../lib/adjustments.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const args = {
    profile: null,
    cacheDir: null,
    outDir: null,
    adjustments: null,
    mock: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--profile') args.profile = argv[++i];
    else if (a === '--cache-dir') args.cacheDir = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--adjustments') args.adjustments = argv[++i];
    else if (a === '--mock') args.mock = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  const msg = [
    'rank — rankeia items do cache do Tino contra o _perfil.md',
    '',
    'Uso:',
    '  node scripts/rank.mjs --profile <path> --cache-dir <dir> --out-dir <dir> [opcoes]',
    '',
    'Opcoes:',
    '  --profile <path>       _perfil.md de entrada',
    '  --cache-dir <path>     diretorio com JSONs do fetch-all',
    '  --out-dir <path>       diretorio destino dos <id>.md',
    '  --adjustments <path>   opcional, _ajustes.md',
    '  --mock                 usa rankMock deterministico',
    '  --dry-run              imprime sem escrever',
  ].join('\n');
  process.stdout.write(msg + '\n');
}

async function readPerfil(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return parse(text);
}

async function readAjustes(filePath) {
  if (!filePath) return [];
  try {
    const data = await readAdjustments(filePath);
    // Monta shape consumido pelo rank-mock:
    //   { ignore_tags: [...], thumbs_down: [{ id, titulo }] }
    const thumbsDown = (data.items || [])
      .filter((it) => it && it.sinal === 'errado')
      .map((it) => ({ id: it.id, titulo: it.titulo }));
    return [{
      ignore_tags: Array.isArray(data.meta.ignore_tags) ? data.meta.ignore_tags : [],
      thumbs_down: thumbsDown,
    }];
  } catch (e) {
    if (e && e.code === 'ENOENT') return [];
    throw e;
  }
}

async function readCacheItems(cacheDir) {
  const entries = await fs.readdir(cacheDir, { withFileTypes: true });
  const items = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.toLowerCase().endsWith('.json')) continue;
    const abs = path.join(cacheDir, e.name);
    try {
      const text = await fs.readFile(abs, 'utf8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const it of parsed) if (it && typeof it === 'object') items.push(it);
      }
    } catch {
      // pula arquivo invalido
    }
  }
  return items;
}

function slugifyId(id) {
  const s = String(id || '').trim();
  // Mantem caracteres alfanumericos, . _ - ; substitui : e / e demais por _
  return s
    .replace(/[\\/]/g, '_')
    .replace(/[^A-Za-z0-9._:-]/g, '_')
    .replace(/:/g, '-')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sem-id';
}

async function readExistingFavorito(outPath) {
  try {
    const existing = await fs.readFile(outPath, 'utf8');
    const { meta } = parse(existing);
    return meta.favorito === true;
  } catch {
    return false;
  }
}

function buildMdMeta(item, rank, existingFavorito) {
  return {
    id: String(item.id || ''),
    titulo: String(item.titulo || ''),
    fonte: String(item.fonte || ''),
    data: String(item.data || ''),
    tipo: String(item.tipo || ''),
    nota: rank.nota,
    veredito: rank.veredito,
    resumo: String(rank.resumo || ''),
    cite: String(rank.cite || ''),
    url: String(item.url || ''),
    favorito: existingFavorito === true,
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function run(args, { rankFn = rankMock } = {}) {
  if (!args.profile) throw new Error('--profile e obrigatorio');
  if (!args.cacheDir) throw new Error('--cache-dir e obrigatorio');
  if (!args.outDir) throw new Error('--out-dir e obrigatorio');
  if (!args.mock) {
    // Wave 5: so mock e suportado; real ranker via agent vira em wave futura.
    throw new Error('apenas --mock e suportado nesta wave. Passe --mock.');
  }

  const perfil = await readPerfil(args.profile);
  const ajustes = await readAjustes(args.adjustments);
  const items = await readCacheItems(args.cacheDir);

  if (!args.dryRun) await ensureDir(args.outDir);

  const tally = { Foca: 0, Considera: 0, Acompanha: 0, Ignore: 0 };
  const written = [];

  for (const item of items) {
    const rank = rankFn(perfil, item, ajustes);
    tally[rank.veredito] = (tally[rank.veredito] || 0) + 1;

    const slug = slugifyId(item.id);
    const outPath = path.join(args.outDir, `${slug}.md`);
    const existingFavorito = args.dryRun ? false : await readExistingFavorito(outPath);
    const meta = buildMdMeta(item, rank, existingFavorito);
    const body = rank.justificativa || '';
    const text = serialize(meta, body);

    if (!args.dryRun) {
      await fs.writeFile(outPath, text + '\n', 'utf8');
    }
    written.push({ id: meta.id, slug, nota: meta.nota, veredito: meta.veredito });
  }

  const summary = {
    ranqueados: written.length,
    foca: tally.Foca,
    considera: tally.Considera,
    acompanha: tally.Acompanha,
    ignore: tally.Ignore,
    out: args.outDir,
    dry_run: !!args.dryRun,
  };
  return { summary, written };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { summary } = await run(args);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`fatal: ${e?.stack || e?.message || String(e)}\n`);
    process.exit(2);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  main();
}

export { parseArgs };
