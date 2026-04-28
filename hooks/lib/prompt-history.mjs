// hooks/lib/prompt-history.mjs
//
// Append-only jsonl com rotacao probabilistica.
// Cada linha = { ts, prompt, session_id, cwd }.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function append(filePath, entry) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readLastN(filePath, n) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const lines = raw.trim().split('\n').filter(Boolean);
  return lines.slice(-n).reverse().map((l) => JSON.parse(l));
}

export async function rotate(filePath, maxEntries) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length <= maxEntries) return;
  const trimmed = lines.slice(-maxEntries).join('\n') + '\n';
  await fs.writeFile(filePath, trimmed, 'utf8');
}
