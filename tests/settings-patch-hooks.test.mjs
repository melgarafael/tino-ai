import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePatch } from '../lib/settings-patch.mjs';

test('computePatch: adiciona hooks block com TINO_HOME quando intervencao_hooks presente', () => {
  const perfil = {
    tolerancia_risco: 'media',
    modo_autonomia: 'balanceado',
    intervencao_hooks: 'ativa',
  };
  const patch = computePatch(perfil, { tinoHome: '/Users/me/tino-ai' });
  assert.ok(patch.add.hooks, 'patch.add.hooks deveria existir');
  assert.ok(patch.add.hooks.UserPromptSubmit);
  const cmds = patch.add.hooks.UserPromptSubmit[0].hooks.map((h) => h.command);
  assert.ok(cmds.some((c) => c.includes('anti-preguicoso.mjs')));
  assert.ok(cmds.some((c) => c.includes('anti-burro.mjs')));
  assert.ok(cmds.every((c) => c.includes('/Users/me/tino-ai')));
});

test('computePatch: remove _tino_hooks_placeholder via patch.remove', () => {
  const perfil = {
    tolerancia_risco: 'media',
    modo_autonomia: 'balanceado',
    intervencao_hooks: 'ativa',
  };
  const patch = computePatch(perfil, { tinoHome: '/x/y' });
  assert.ok(Array.isArray(patch.remove));
  assert.ok(patch.remove.includes('_tino_hooks_placeholder'));
});
