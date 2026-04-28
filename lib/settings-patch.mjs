// lib/settings-patch.mjs
//
// Compute + apply patches em ~/.claude/settings.json baseado no perfil vibecoder.
// Funções puras (computePatch, applyPatch). I/O isolado em backup().

import { promises as fs } from 'node:fs';

export function computePatch(perfil, opts = {}) {
  const patch = { add: { permissions: {} }, remove: [] };

  const allow = [];
  const deny = [];

  if (perfil.tolerancia_risco === 'baixa') {
    deny.push('Bash(rm:*)', 'Bash(curl:*)', 'Bash(sudo:*)');
  } else if (perfil.tolerancia_risco === 'media') {
    deny.push('Bash(rm -rf:*)');
  }

  if (perfil.tolerancia_risco === 'alta' && perfil.modo_autonomia === 'autonomo') {
    allow.push('Bash(npm install:*)', 'Bash(npm run:*)', 'Bash(git:*)', 'Read', 'Edit', 'Write');
  } else if (perfil.modo_autonomia === 'autonomo') {
    allow.push('Bash(npm:*)', 'Read', 'Edit');
  }

  if (allow.length > 0) patch.add.permissions.allow = allow;
  if (deny.length > 0) patch.add.permissions.deny = deny;

  // Hooks block — Onda 2: registra hooks reais usando TINO_HOME (ou placeholder $TINO_HOME)
  if (perfil.intervencao_hooks) {
    const tinoHome = opts.tinoHome || '$TINO_HOME';
    patch.add.hooks = {
      UserPromptSubmit: [
        {
          matcher: '*',
          hooks: [
            { type: 'command', command: `node ${tinoHome}/hooks/anti-preguicoso.mjs` },
            { type: 'command', command: `node ${tinoHome}/hooks/anti-burro.mjs` },
          ],
        },
      ],
    };
    // Limpa placeholder reservado pela Onda 1
    patch.remove.push('_tino_hooks_placeholder');
  }

  return patch;
}

export function applyPatch(currentSettings, patch) {
  const next = { ...currentSettings };
  if (patch.add) {
    for (const [key, value] of Object.entries(patch.add)) {
      next[key] = mergeValue(next[key], value);
    }
  }
  if (Array.isArray(patch.remove)) {
    for (const key of patch.remove) delete next[key];
  }
  return next;
}

function mergeValue(curr, incoming) {
  if (Array.isArray(curr) && Array.isArray(incoming)) {
    const set = new Set(curr);
    for (const v of incoming) set.add(v);
    return [...set];
  }
  if (
    curr && typeof curr === 'object' && !Array.isArray(curr) &&
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
  ) {
    const out = { ...curr };
    for (const [k, v] of Object.entries(incoming)) {
      out[k] = mergeValue(out[k], v);
    }
    return out;
  }
  return incoming !== undefined ? incoming : curr;
}

export async function backup(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${filePath}.tino-bak.${stamp}`;
  await fs.copyFile(filePath, bak);
  return bak;
}
