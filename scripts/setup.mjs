#!/usr/bin/env node
// scripts/setup.mjs
// Orquestrador deterministico do /tino:setup.
// CLI:
//   --vault <path>  (obrigatorio) caminho para vault Obsidian
//   --top <N>       (default 30)  quantos arquivos surfacear via scanner
//   --mock          gera _perfil.md heuristicamente (sem invocar Claude)
//   --force         sobrescreve Tino/_perfil.md se ja existir
//
// Contrato de saida: JSON summary no stdout no final.
// Sem --mock e sem Tino/ existente: escreve placeholder pro agent preencher.
// Sem --mock e com Tino/ existente sem --force: nao sobrescreve, avisa, sai 0.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { scanVault } from '../lib/vault-scanner.mjs';
import { serialize } from '../lib/frontmatter.mjs';

// --- arg parsing simples ---
function parseArgs(argv) {
  const out = { vault: null, top: 30, mock: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vault') {
      out.vault = argv[++i];
    } else if (a === '--top') {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) out.top = n;
    } else if (a === '--mock') {
      out.mock = true;
    } else if (a === '--force') {
      out.force = true;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      'Uso: node scripts/setup.mjs --vault <path> [--top N] [--mock] [--force]',
      '',
      '  --vault <path>  Caminho para um vault Obsidian (obrigatorio)',
      '  --top N         Numero de arquivos a surfacear (default 30)',
      '  --mock          Gera _perfil.md deterministicamente a partir de heuristicas',
      '  --force         Sobrescreve Tino/_perfil.md existente',
      '',
    ].join('\n'),
  );
}

// --- buckets para mock mode ---
// Match: chave lowercase (substring no pool); valor: label canonico a gravar.
// O label preserva casing/acentos esperados pelo dashboard (hydrateProfile).
const IDENTIDADE_CHIPS = {
  'saas b2b': 'SaaS B2B',
  'founder': 'Founder',
  'cto': 'CTO',
  'claude code': 'Claude Code',
  'obsidian': 'Obsidian',
  'next.js': 'Next.js',
  'supabase': 'Supabase',
};

const FOCO_CHIPS = {
  'claude agent sdk': 'Claude Agent SDK',
  'managed agents': 'Managed Agents',
  'context engineering': 'Context engineering',
  'mcp': 'MCP',
  'rag': 'RAG',
  'llm': 'LLM',
};

// Padroes para extrair "evita". Cada regex captura uma linha/frase apos o gatilho.
// Como Obsidian costuma usar bullets, tambem aceitamos a linha inteira do bullet.
const EVITA_TRIGGERS = [/\bevita\b/i, /sem interesse em/i, /n[aã]o uso/i];

function pickChips(pool, chipsMap) {
  const hits = [];
  for (const [needle, label] of Object.entries(chipsMap)) {
    if (pool.includes(needle)) hits.push(label);
  }
  return hits;
}

// Extrai itens de "Evita" varrendo linha-a-linha.
// Estrategia: se uma linha inteira eh um bullet sob um header "Evita", pega ate linha vazia ou proximo header.
// Adicionalmente, captura frases apos os triggers "sem interesse em" / "nao uso" na mesma linha.
function extractEvita(texts) {
  const out = [];
  const seen = new Set();
  const push = (s) => {
    const v = s.trim().replace(/^[-*]\s+/, '').trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  for (const text of texts) {
    const lines = text.split(/\r?\n/);
    let inEvitaBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Headers-markdown que indicam bloco "evita".
      if (/^#{1,6}\s+.*evita/i.test(line)) {
        inEvitaBlock = true;
        continue;
      }
      // Proximo header encerra bloco.
      if (inEvitaBlock && /^#{1,6}\s+/.test(line)) {
        inEvitaBlock = false;
      }
      if (inEvitaBlock) {
        if (/^\s*$/.test(line)) {
          // linha vazia: nao encerra (Obsidian permite bullets apos vazio), mas ignora.
          continue;
        }
        if (/^\s*[-*]\s+/.test(line)) {
          push(line);
        }
      }
      // Triggers inline.
      for (const re of EVITA_TRIGGERS) {
        const m = line.match(re);
        if (m) {
          // Captura do trigger ate o fim da linha (ou ate um ponto).
          const after = line.slice(m.index + m[0].length).trim();
          if (after) {
            // Remove pontuacao inicial tipo ":" ou "-".
            const clean = after.replace(/^[-:]\s*/, '').replace(/\.$/, '');
            if (clean) push(clean);
          }
        }
      }
    }
  }
  return out;
}

// Extrai narrativa de identidade dos arquivos README-like.
// Prioriza o bloco sob um header "Sobre"/"About"/"Perfil"/"Identidade" (eh la
// que mora a apresentacao pessoal). Fallback: primeiro paragrafo narrativo.
// Pega ate 3 sentencas do melhor candidato encontrado.
function extractIdentidadeBody(docs) {
  const prefer = docs.filter((d) =>
    /\b(readme|sobre|about|perfil)\b/i.test(path.basename(d.path)),
  );
  const source = prefer.length > 0 ? prefer : docs.slice(0, 1);

  const IDENT_HEADER = /^#{1,6}\s+.*\b(sobre|about|perfil|identidade)\b/i;

  for (const d of source) {
    const lines = d.body.split(/\r?\n/);

    // 1. Tenta bloco sob header de identidade.
    const blockParagraphs = [];
    {
      let inBlock = false;
      let buf = [];
      const flush = () => {
        if (buf.length > 0) {
          blockParagraphs.push(buf.join(' ').trim());
          buf = [];
        }
      };
      for (const l of lines) {
        if (IDENT_HEADER.test(l)) {
          inBlock = true;
          continue;
        }
        if (inBlock && /^#{1,6}\s+/.test(l)) {
          flush();
          inBlock = false;
          continue;
        }
        if (!inBlock) continue;
        if (/^\s*$/.test(l)) {
          flush();
          continue;
        }
        if (/^\s*[-*]\s+/.test(l)) {
          flush();
          // bullets entram como "paragrafo" porque aqui eles carregam identidade
          // tipo "- Rafael Melgaço, founder e CTO do Tomik CRM".
          const clean = l.replace(/^\s*[-*]\s+/, '').trim();
          if (clean) blockParagraphs.push(clean);
          continue;
        }
        buf.push(l.trim());
      }
      flush();
    }

    if (blockParagraphs.length > 0) {
      const joined = blockParagraphs.join(' ').trim();
      const sentences = joined.match(/[^.!?]+[.!?]+/g) || [joined];
      return sentences.slice(0, 3).join(' ').trim();
    }

    // 2. Fallback: primeiro paragrafo narrativo do arquivo.
    const paragraphs = [];
    let buf = [];
    const flush = () => {
      if (buf.length > 0) {
        paragraphs.push(buf.join(' ').trim());
        buf = [];
      }
    };
    for (const l of lines) {
      if (/^\s*$/.test(l) || /^#{1,6}\s+/.test(l) || /^\s*[-*]\s+/.test(l)) {
        flush();
        continue;
      }
      buf.push(l.trim());
    }
    flush();

    const narrative = paragraphs.find((p) => p.length > 40);
    if (narrative) {
      const sentences = narrative.match(/[^.!?]+[.!?]+/g) || [narrative];
      return sentences.slice(0, 3).join(' ').trim();
    }
  }
  return '';
}

// Extrai bullets sob headers "Aprendendo" ou "Foco" como corpo de foco_ativo.
function extractFocoBullets(docs) {
  const bullets = [];
  const seen = new Set();
  for (const d of docs) {
    const lines = d.body.split(/\r?\n/);
    let inFocoBlock = false;
    for (const line of lines) {
      if (/^#{1,6}\s+.*(aprendendo|foco)/i.test(line)) {
        inFocoBlock = true;
        continue;
      }
      if (inFocoBlock && /^#{1,6}\s+/.test(line)) {
        inFocoBlock = false;
      }
      if (inFocoBlock && /^\s*[-*]\s+/.test(line)) {
        const clean = line.replace(/^\s*[-*]\s+/, '').trim();
        const key = clean.toLowerCase();
        if (!seen.has(key) && clean) {
          seen.add(key);
          bullets.push(clean);
        }
      }
    }
  }
  return bullets;
}

function buildMockPerfilBody({ identidadeBody, focoBullets, evita, vaultName, sourceFiles }) {
  const lines = [];
  lines.push(`# Perfil — ${vaultName}`);
  lines.push('');
  lines.push('> Gerado em modo `--mock` (heuristica deterministica). Revisar antes de usar em producao.');
  lines.push('');
  lines.push('## Identidade');
  if (identidadeBody) {
    lines.push(identidadeBody);
  } else {
    lines.push('_(sem texto narrativo detectavel nos arquivos-fonte)_');
  }
  lines.push('');
  lines.push('## Foco ativo');
  if (focoBullets.length > 0) {
    for (const b of focoBullets) lines.push(`- ${b}`);
  } else {
    lines.push('_(nenhum bullet sob "Aprendendo" ou "Foco" detectado)_');
  }
  lines.push('');
  lines.push('## Evita');
  if (evita.length > 0) {
    for (const e of evita) lines.push(`- ${e}`);
  } else {
    lines.push('_(nenhum item "evita" detectado)_');
  }
  lines.push('');
  lines.push('## Fontes consideradas');
  for (const src of sourceFiles) {
    lines.push(`- \`${src}\``);
  }
  lines.push('');
  return lines.join('\n');
}

function buildPlaceholderPerfilBody({ vaultName, sourceFiles }) {
  const lines = [];
  lines.push(`# Perfil — ${vaultName}`);
  lines.push('');
  lines.push('> Placeholder. Invoque o agente `profile-extractor` no Claude Code para preencher.');
  lines.push('> O agente vai ler `config/prompts/extract-profile.md` e sintetizar este arquivo a partir das fontes abaixo.');
  lines.push('');
  lines.push('## Identidade');
  lines.push('_(a preencher)_');
  lines.push('');
  lines.push('## Foco ativo');
  lines.push('_(a preencher)_');
  lines.push('');
  lines.push('## Evita');
  lines.push('_(a preencher)_');
  lines.push('');
  lines.push('## Fontes consideradas');
  for (const src of sourceFiles) {
    lines.push(`- \`${src}\``);
  }
  lines.push('');
  return lines.join('\n');
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function hasAnyMarkdown(vault) {
  // Busca recursiva preguicosa: para no primeiro .md.
  async function rec(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '.obsidian') continue;
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase().endsWith('.md')) return true;
      if (e.isDirectory()) {
        if (await rec(full)) return true;
      }
    }
    return false;
  }
  return rec(vault);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  if (!args.vault) {
    process.stderr.write('erro: --vault e obrigatorio\n');
    printHelp();
    return 2;
  }

  const absVault = path.resolve(args.vault);
  let stat;
  try {
    stat = await fs.stat(absVault);
  } catch {
    process.stderr.write(`erro: vault nao encontrado em ${absVault}\n`);
    return 2;
  }
  if (!stat.isDirectory()) {
    process.stderr.write(`erro: ${absVault} nao e um diretorio\n`);
    return 2;
  }
  if (!(await hasAnyMarkdown(absVault))) {
    process.stderr.write(`erro: vault ${absVault} nao contem nenhum .md\n`);
    return 2;
  }

  // 1. Scan.
  const scan = await scanVault(absVault, { topN: args.top });
  const topFiles = scan.files;

  // 2. Imprime lista.
  process.stdout.write(`Top ${topFiles.length} arquivos em ${absVault}:\n`);
  for (const f of topFiles) {
    process.stdout.write(`  [${String(f.score).padStart(3)}] ${f.path}\n`);
  }

  // 3. Cria estrutura Tino/ (sempre).
  const tinoDir = path.join(absVault, 'Tino');
  const perfilPath = path.join(tinoDir, '_perfil.md');
  const configPath = path.join(tinoDir, '_config.md');
  const novidadesDir = path.join(tinoDir, 'novidades');
  const favoritosDir = path.join(tinoDir, 'favoritos');

  const perfilExists = await pathExists(perfilPath);
  await ensureDir(tinoDir);
  await ensureDir(novidadesDir);
  await ensureDir(favoritosDir);
  if (!(await pathExists(configPath))) {
    const cfgMeta = { versao: 1, criado: new Date().toISOString().slice(0, 10) };
    const cfgBody = '# Config do Tino\n\nEste arquivo guarda configuracoes do Tino neste vault.\n';
    await fs.writeFile(configPath, serialize(cfgMeta, cfgBody), 'utf8');
  }

  // 4. Decide modo e se escreve _perfil.md.
  let mode;
  let wrote = false;

  if (perfilExists && !args.force) {
    process.stdout.write(
      `\naviso: ${perfilPath} ja existe. Use --force para sobrescrever.\n`,
    );
    mode = args.mock ? 'mock-skipped' : 'placeholder-skipped';
  } else {
    // Le o conteudo raw dos top files (sem frontmatter) para heuristicas.
    const { parse: parseFm } = await import('../lib/frontmatter.mjs');
    const docs = [];
    for (const f of topFiles) {
      const abs = path.join(absVault, f.path);
      try {
        const raw = await fs.readFile(abs, 'utf8');
        const { body } = parseFm(raw);
        docs.push({ path: f.path, body });
      } catch {
        // ignora arquivo nao-lido
      }
    }

    const vaultName = path.basename(absVault);
    const sourceFiles = topFiles.map((f) => f.path);

    if (args.mock) {
      mode = 'mock';
      const pool = docs.map((d) => d.body).join('\n').toLowerCase();
      const identidadeChips = pickChips(pool, IDENTIDADE_CHIPS);
      const focoChips = pickChips(pool, FOCO_CHIPS);
      const identidadeBody = extractIdentidadeBody(docs);
      const focoBullets = extractFocoBullets(docs);
      const evita = extractEvita(docs.map((d) => d.body));

      const body = buildMockPerfilBody({
        identidadeBody,
        focoBullets,
        evita,
        vaultName,
        sourceFiles,
      });
      const today = new Date().toISOString().slice(0, 10);
      // Ordem das chaves casa com o esquema que o dashboard (hydrateProfile) le:
      // nome/atualizado primeiro, chips como arrays, contadores zerados, metadata
      // do gerador por ultimo.
      const meta = {
        nome: '(preencher)',
        atualizado: today,
        foco_ativo: focoChips,
        identidade: identidadeChips,
        evita,
        processadas: 0,
        favoritadas: 0,
        thumb_up: 0,
        thumb_down: 0,
        acerto: 0,
        tipo: 'perfil',
        modo: 'mock',
        gerado_em: today,
        fontes: sourceFiles.length,
      };
      await fs.writeFile(perfilPath, serialize(meta, body), 'utf8');
      wrote = true;
    } else {
      mode = 'placeholder';
      const body = buildPlaceholderPerfilBody({ vaultName, sourceFiles });
      const meta = {
        tipo: 'perfil',
        gerado_em: new Date().toISOString().slice(0, 10),
        modo: 'placeholder',
        fontes: sourceFiles.length,
      };
      await fs.writeFile(perfilPath, serialize(meta, body), 'utf8');
      wrote = true;
    }
  }

  // 5. JSON summary.
  const summary = {
    vault: absVault,
    tinoDir,
    perfilPath,
    topFiles: topFiles.map((f) => ({ path: f.path, score: f.score })),
    mode,
    wrote,
  };
  process.stdout.write('\n' + JSON.stringify(summary, null, 2) + '\n');
  return 0;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    process.stderr.write(`erro inesperado: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
