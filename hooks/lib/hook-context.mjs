// hooks/lib/hook-context.mjs
//
// Helpers compartilhados entre hooks: parse stdin, load perfil-vibecoder,
// resolve TINO_HOME. Funcoes puras com I/O minimal explicito.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseFrontmatter } from '../../lib/frontmatter.mjs';

export function parseStdinJson(raw) {
  if (!raw || raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`hook-context: invalid JSON input: ${e.message}`);
  }
}

/**
 * Carrega {vault}/Tino/_perfil-vibecoder.md. Retorna null se ausente.
 * Sem cache nesta versao (cold start cheap, parse YAML rapido).
 */
export async function loadPerfil(vaultPath) {
  if (!vaultPath) return null;
  const filePath = path.join(vaultPath, 'Tino', '_perfil-vibecoder.md');
  try {
    const md = await fs.readFile(filePath, 'utf8');
    const { meta } = parseFrontmatter(md);
    return meta;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

export async function readStdinAll() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
