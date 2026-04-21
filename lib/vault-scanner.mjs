// lib/vault-scanner.mjs
// Scanner recursivo de vault Obsidian com score heuristico de relevancia.
// Zero deps externas — usa fs/promises e path do Node.
//
// API:
//   scanVault(vaultPath, options?) → { vaultPath, files: [...] }
//   options.topN    → limita ao top N arquivos por score
//   options.ignore  → array de substrings de pasta a ignorar (alem dos defaults)
//
// Cada entrada em `files`:
//   { path, score, signals, mtime, size }
// onde `path` e relativo ao vault e `signals` e um objeto com a contribuicao
// de cada um dos 6 sinais (nameMatch, depth, recency, backlinks, tags, size).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseFrontmatter } from './frontmatter.mjs';

const DEFAULT_IGNORE = ['.obsidian', 'Tino', '.git', 'node_modules'];

// Sinal 1: nomes "magneticos" (case-insensitive, sem extensao).
const NAME_HINTS = [
  'readme',
  'sobre',
  'about',
  'perfil',
  'foco',
  'claude',
  '_index',
  'overview',
  'dashboard',
];

// Sinal 5: tags que indicam relevancia de perfil.
const TAG_HINTS = new Set(['perfil', 'sobre', 'foco', 'projeto', 'cliente', 'estudo']);

const DAY_MS = 24 * 60 * 60 * 1000;

function shouldIgnoreSegment(segment, ignore) {
  if (DEFAULT_IGNORE.includes(segment)) return true;
  for (const pat of ignore) {
    if (!pat) continue;
    if (segment === pat) return true;
    if (!pat.includes('/') && segment.includes(pat)) return true;
  }
  return false;
}

function pathHasIgnoredSegment(relPath, ignore) {
  const segs = relPath.split(path.sep).filter(Boolean);
  for (const s of segs) {
    if (shouldIgnoreSegment(s, ignore)) return true;
  }
  const canon = segs.join('/');
  for (const pat of ignore) {
    if (pat && pat.includes('/') && canon.includes(pat)) return true;
  }
  return false;
}

async function walk(root, ignore) {
  const out = [];
  async function rec(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (shouldIgnoreSegment(e.name, ignore)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await rec(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push(full);
      }
    }
  }
  await rec(root);
  return out;
}

function nameMatchSignal(relPath) {
  const base = path.basename(relPath, path.extname(relPath)).toLowerCase();
  for (const hint of NAME_HINTS) {
    if (base === hint || base.includes(hint)) return 1;
  }
  return 0;
}

function depthSignal(relPath) {
  const segs = relPath.split(path.sep).filter(Boolean);
  if (segs.length <= 1) return 3;
  if (segs.length === 2) return 2;
  return 1;
}

function recencySignal(mtimeMs, nowMs) {
  const ageDays = (nowMs - mtimeMs) / DAY_MS;
  if (ageDays < 30) return 2;
  if (ageDays < 90) return 1;
  return 0;
}

function wordCount(body) {
  return (body.match(/\S+/g) || []).length;
}

function sizeSignal(body) {
  const n = wordCount(body);
  return n >= 500 && n <= 5000 ? 1 : 0;
}

function tagsSignal(meta) {
  const tags = meta?.tags;
  if (!tags) return 0;
  const list = Array.isArray(tags) ? tags : [tags];
  for (const t of list) {
    const tag = String(t).toLowerCase();
    if (TAG_HINTS.has(tag)) return 1;
  }
  return 0;
}

function countBacklinks(targetBase, allDocs, selfPath) {
  const needle = targetBase.toLowerCase();
  let n = 0;
  const re = /\[\[([^\]]+)\]\]/g;
  for (const doc of allDocs) {
    if (doc.path === selfPath) continue;
    const text = doc.text;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const inside = m[1].split('|')[0].trim().toLowerCase();
      const clean = inside.replace(/\.md$/i, '');
      const basename = clean.split('/').pop();
      if (basename === needle) {
        n += 1;
      }
    }
  }
  return n;
}

function backlinkSignal(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  return 2;
}

export async function scanVault(vaultPath, options = {}) {
  const ignore = Array.isArray(options.ignore) ? options.ignore.slice() : [];
  const topN = typeof options.topN === 'number' && options.topN > 0 ? options.topN : null;

  const absVault = path.resolve(vaultPath);
  let stat;
  try {
    stat = await fs.stat(absVault);
  } catch {
    return { vaultPath: absVault, files: [] };
  }
  if (!stat.isDirectory()) return { vaultPath: absVault, files: [] };

  const abs = await walk(absVault, ignore);

  const docs = [];
  for (const a of abs) {
    const rel = path.relative(absVault, a);
    if (pathHasIgnoredSegment(rel, ignore)) continue;
    let text = '';
    let st;
    try {
      [text, st] = await Promise.all([fs.readFile(a, 'utf8'), fs.stat(a)]);
    } catch {
      continue;
    }
    const { meta, body } = parseFrontmatter(text);
    docs.push({
      path: rel,
      abs: a,
      text,
      meta,
      body,
      mtime: st.mtimeMs,
      size: st.size,
    });
  }

  const nowMs = Date.now();
  const files = docs.map((d) => {
    const nameMatch = nameMatchSignal(d.path);
    const depth = depthSignal(d.path);
    const recency = recencySignal(d.mtime, nowMs);
    const backlinksCount = countBacklinks(
      path.basename(d.path, path.extname(d.path)),
      docs,
      d.path,
    );
    const backlinks = backlinkSignal(backlinksCount);
    const tags = tagsSignal(d.meta);
    const sizeSig = sizeSignal(d.body);

    const signals = {
      nameMatch,
      depth,
      recency,
      backlinks,
      tags,
      size: sizeSig,
    };

    const score =
      nameMatch * 3 +
      depth * 2 +
      recency * 2 +
      backlinks * 2 +
      tags * 2 +
      sizeSig * 1;

    return {
      path: d.path,
      score,
      signals,
      mtime: new Date(d.mtime).toISOString(),
      size: d.size,
    };
  });

  files.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const sliced = topN ? files.slice(0, topN) : files;

  return { vaultPath: absVault, files: sliced };
}
