// lib/settings-patch.mjs
//
// Compute + apply patches em ~/.claude/settings.json baseado no perfil vibecoder.
// Funções puras (computePatch, applyPatch). I/O isolado em backup().

import { promises as fs } from 'node:fs';

export function computePatch(perfil) {
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

  // Reservar slot pra hooks da Onda 2 — sem mexer ainda
  if (perfil.intervencao_hooks && perfil.intervencao_hooks !== 'silenciosa') {
    patch.add._tino_hooks_placeholder = `reserved by Tino Onda 1 — Onda 2 vai preencher hooks com nivel ${perfil.intervencao_hooks}`;
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
