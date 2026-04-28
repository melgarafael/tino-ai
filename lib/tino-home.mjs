// lib/tino-home.mjs
//
// Resolve TINO_HOME a partir de ~/.tino/config.sh (estabelecido pelo install.sh do MVP).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let cached = null;
let cachedAt = 0;
const TTL_MS = 60_000; // 1 min cache

export async function resolveHomePath(opts = {}) {
  const homeDir = opts.homeDir || os.homedir();
  const now = Date.now();

  // Cache por homeDir
  if (cached && cached.homeDir === homeDir && (now - cachedAt) < TTL_MS) {
    return cached.value;
  }

  const cfgPath = path.join(homeDir, '.tino', 'config.sh');
  let value = null;
  try {
    const raw = await fs.readFile(cfgPath, 'utf8');
    const m = raw.match(/^\s*export\s+TINO_HOME\s*=\s*"?([^"\n]+)"?/m);
    if (m) value = m[1].trim();
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  cached = { homeDir, value };
  cachedAt = now;
  return value;
}
