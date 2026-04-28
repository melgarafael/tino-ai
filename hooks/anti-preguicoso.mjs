#!/usr/bin/env node
// hooks/anti-preguicoso.mjs
//
// UserPromptSubmit hook do Tino vibecoder.
// Detecta prompts preguicosos (curtos, vagos, error paste sem pergunta)
// e responde conforme perfil.intervencao_hooks.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseStdinJson, loadPerfil, readStdinAll } from './lib/hook-context.mjs';
import { analyzeLazy } from './lib/prompt-analyzer.mjs';
import { renderBox } from './lib/visual-output.mjs';
import { append as appendHistory } from './lib/prompt-history.mjs';

async function main() {
  const raw = await readStdinAll();
  const input = parseStdinJson(raw);
  const prompt = input.prompt || '';
  const cwd = input.cwd || process.cwd();

  const vaultPath = process.env.TINO_VAULT_PATH;
  const perfil = vaultPath ? await loadPerfil(vaultPath) : null;

  // Mode off: sem perfil -> nao intervem
  if (!perfil) {
    process.exit(0);
  }

  const interv = perfil.intervencao_hooks || 'silenciosa';

  // Sempre loga
  await logEvent({ hook: 'anti-preguicoso', interv, prompt, cwd, vaultPath });

  // Silenciosa: so log
  if (interv === 'silenciosa') {
    process.exit(0);
  }

  // Analisa
  const analysis = analyzeLazy(prompt);
  if (!analysis.flagged) {
    process.exit(0);
  }

  // Render output visual
  const box = renderBox({
    title: 'Tino [anti-preguicoso]',
    emoji: interv === 'agressiva' ? '🛑' : '🤔',
    color: interv === 'agressiva' ? 'red' : 'yellow',
    lines: [
      'Detectei sinais de prompt preguicoso:',
      ...analysis.reasons.map((r) => `• ${r}`),
      '',
      'Sugestao: descreva objetivo + resultado esperado + o que ja tentou.',
    ],
    mode: interv,
  });

  process.stderr.write(box + '\n');

  if (interv === 'agressiva') {
    process.exit(2); // block
  }
  process.exit(0); // allow
}

async function logEvent(entry) {
  try {
    const logPath = path.join(process.env.TINO_VAULT_PATH || '/tmp', '.tino-cache', 'hook-log.jsonl');
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
  } catch {
    // log best-effort, nunca trava o hook
  }
}

main().catch((e) => {
  process.stderr.write(`anti-preguicoso error: ${e.message}\n`);
  process.exit(0); // fail-open: nunca bloca por erro do hook
});
