#!/usr/bin/env node
// hooks/anti-burro.mjs
//
// UserPromptSubmit hook do Tino vibecoder.
// Detecta loops "tenta de novo" + repeticao de prompts/erros usando .tino-cache/prompt-history.jsonl.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseStdinJson, loadPerfil, readStdinAll } from './lib/hook-context.mjs';
import { analyzeStuck } from './lib/prompt-analyzer.mjs';
import { renderBox } from './lib/visual-output.mjs';
import { append as appendHistory, readLastN, rotate } from './lib/prompt-history.mjs';

async function main() {
  const raw = await readStdinAll();
  const input = parseStdinJson(raw);
  const prompt = input.prompt || '';
  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || 'unknown';

  const vaultPath = process.env.TINO_VAULT_PATH;
  const perfil = vaultPath ? await loadPerfil(vaultPath) : null;

  if (!perfil) process.exit(0);

  const interv = perfil.intervencao_hooks || 'silenciosa';
  const histPath = path.join(vaultPath, '.tino-cache', 'prompt-history.jsonl');

  // Le history ANTES de adicionar o prompt atual (pra detectar repeticao)
  const history = await readLastN(histPath, 5);

  // Sempre append no historico
  await appendHistory(histPath, { ts: Date.now(), prompt, session_id: sessionId, cwd });
  if (Math.random() < 0.05) await rotate(histPath, 1000);

  await logEvent({ hook: 'anti-burro', interv, prompt, cwd, vaultPath });

  if (interv === 'silenciosa') process.exit(0);

  const analysis = analyzeStuck(prompt, history);
  if (!analysis.flagged) process.exit(0);

  const box = renderBox({
    title: 'Tino [anti-burro]',
    emoji: interv === 'agressiva' ? '🛑' : '🔁',
    color: interv === 'agressiva' ? 'red' : 'yellow',
    lines: [
      'Detectei loop sem novo contexto:',
      ...analysis.reasons.map((r) => `• ${r}`),
      '',
      'Sugestao: pause. Diga o que mudou. Anexe o erro novo, se houver.',
    ],
    mode: interv,
  });

  process.stderr.write(box + '\n');

  if (interv === 'agressiva') process.exit(2);
  process.exit(0);
}

async function logEvent(entry) {
  try {
    const logPath = path.join(process.env.TINO_VAULT_PATH || '/tmp', '.tino-cache', 'hook-log.jsonl');
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
  } catch {}
}

main().catch((e) => {
  process.stderr.write(`anti-burro error: ${e.message}\n`);
  process.exit(0);
});
