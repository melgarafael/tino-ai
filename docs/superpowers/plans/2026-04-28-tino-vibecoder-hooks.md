# Tino Vibecoder — Onda 2 (Hooks Runtime) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar 2 hooks `UserPromptSubmit` (anti-preguiçoso + anti-burro) que detectam padrões típicos de erro do vibecoder júnior em runtime, com output visual ANSI + comportamento derivado de `perfil.intervencao_hooks`.

**Architecture:** Heurística pura no hot path (sub-500ms wall-clock). 4 lib modules em `hooks/lib/` (analyzer + history + visual + context) + 2 entry scripts em `hooks/`. State management via `.tino-cache/prompt-history.jsonl` rotacionado. `lib/settings-patch.mjs` atualizado pra registrar hooks reais via `TINO_HOME`.

**Tech Stack:** Node.js 20+, ESM puro `.mjs`, `node:test`, `node:assert/strict`, ANSI escape codes (sem deps de UI). Reusa `lib/frontmatter.mjs` (Onda 0) pra parse do perfil.

**Spec de referência:** `docs/superpowers/specs/2026-04-28-tino-vibecoder-hooks-design.md`
**Onda 1 base (já entregue):** `lib/settings-patch.mjs` com placeholder `_tino_hooks_placeholder`, 4 comandos `/tino:vibe-*`, perfil schema validável.

---

## File Structure

| Caminho | Responsabilidade | Task |
|---|---|---|
| `hooks/lib/hook-context.mjs` | Parse stdin + load perfil + resolve TINO_HOME | T2 |
| `hooks/lib/visual-output.mjs` | ANSI box + emoji + NO_COLOR fallback | T3 |
| `hooks/lib/prompt-history.mjs` | jsonl append/readLastN/rotate | T4 |
| `hooks/lib/prompt-analyzer.mjs` | analyzeLazy + analyzeStuck (puras) | T5 |
| `hooks/anti-preguicoso.mjs` | Entry point hook anti-preguiçoso | T6 |
| `hooks/anti-burro.mjs` | Entry point hook anti-burro | T7 |
| `lib/tino-home.mjs` | Helper resolve TINO_HOME (cached) | T8 |
| `lib/settings-patch.mjs` | UPDATE — preenche hooks block real | T9 |
| `docs/hooks-vibecoder.md` | Doc humana (uso, debug, desativar) | T10 |
| `README.md` | UPDATE — seção "Hooks runtime" | T10 |
| `package.json` | Script `test:hooks` | T1 |
| `tests/hook-context.test.mjs` | 3 testes | T2 |
| `tests/visual-output.test.mjs` | 3 testes | T3 |
| `tests/prompt-history.test.mjs` | 4 testes | T4 |
| `tests/prompt-analyzer.test.mjs` | 10 testes | T5 |
| `tests/anti-preguicoso.integration.test.mjs` | 3 testes E2E | T6 |
| `tests/anti-burro.integration.test.mjs` | 3 testes E2E | T7 |
| `tests/tino-home.test.mjs` | 2 testes | T8 |
| `tests/settings-patch-hooks.test.mjs` | 2 testes (settings-patch update) | T9 |

11 tasks, 30 testes novos. **Gate final: 117 + 30 = 147 PASS, 0 FAIL.**

---

## Task 1: Setup — script `test:hooks`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Adicionar script `test:hooks`**

Editar `package.json`, adicionar entre `test:setup` e `test:e2e`:

```json
"test:hooks": "node --test tests/hook-context.test.mjs tests/visual-output.test.mjs tests/prompt-history.test.mjs tests/prompt-analyzer.test.mjs tests/anti-preguicoso.integration.test.mjs tests/anti-burro.integration.test.mjs tests/tino-home.test.mjs tests/settings-patch-hooks.test.mjs",
```

- [ ] **Step 2: Verificar baseline 117 PASS**

Run: `cd /Users/rafaelmelgaco/tino-ai && npm test`
Expected: 117 PASS, 0 FAIL.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(vibecoder-onda2): script test:hooks"
```

---

## Task 2: `hooks/lib/hook-context.mjs` (TDD, 3 testes)

**Files:**
- Create: `hooks/lib/hook-context.mjs`
- Create: `tests/hook-context.test.mjs`

- [ ] **Step 1: Criar diretório**

Run: `mkdir -p /Users/rafaelmelgaco/tino-ai/hooks/lib`

- [ ] **Step 2: Escrever 3 testes RED**

Criar `tests/hook-context.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseStdinJson, loadPerfil } from '../hooks/lib/hook-context.mjs';

test('parseStdinJson: parses JSON string', () => {
  const input = '{"prompt":"hello","cwd":"/tmp"}';
  const result = parseStdinJson(input);
  assert.equal(result.prompt, 'hello');
  assert.equal(result.cwd, '/tmp');
});

test('parseStdinJson: throws on invalid JSON', () => {
  assert.throws(() => parseStdinJson('not json {{'), /JSON/i);
});

test('loadPerfil: returns null when perfil file missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-hook-ctx-'));
  const result = await loadPerfil(tmp);
  assert.equal(result, null);
});
```

- [ ] **Step 3: Rodar — RED**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/hook-context.test.mjs`
Expected: FAIL — `Cannot find module '../hooks/lib/hook-context.mjs'`.

- [ ] **Step 4: Implementar `hooks/lib/hook-context.mjs`**

Criar `hooks/lib/hook-context.mjs`:

```javascript
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
```

- [ ] **Step 5: Rodar — GREEN**

Run: `cd /Users/rafaelmelgaco/tino-ai && node --test tests/hook-context.test.mjs`
Expected: 3 PASS, 0 FAIL.

- [ ] **Step 6: Verificar `npm test`**

Run: `npm test`
Expected: 117 + 3 = **120 PASS, 0 FAIL**.

- [ ] **Step 7: Commit**

```bash
git add hooks/lib/hook-context.mjs tests/hook-context.test.mjs
git commit -m "feat(vibecoder-onda2): hooks/lib/hook-context.mjs (parseStdin + loadPerfil) + 3 testes"
```

---

## Task 3: `hooks/lib/visual-output.mjs` (TDD, 3 testes)

**Files:**
- Create: `hooks/lib/visual-output.mjs`
- Create: `tests/visual-output.test.mjs`

- [ ] **Step 1: Escrever 3 testes RED**

Criar `tests/visual-output.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBox, stripAnsi } from '../hooks/lib/visual-output.mjs';

test('renderBox: produz output com bordas e titulo', () => {
  const out = renderBox({ title: 'Tino [test]', lines: ['linha 1', 'linha 2'], emoji: '💭', mode: 'ativa' });
  assert.ok(out.includes('Tino [test]'));
  assert.ok(out.includes('linha 1'));
  assert.ok(out.includes('linha 2'));
  assert.ok(out.includes('Modo: ativa'));
  assert.ok(out.includes('╭') && out.includes('╰'));
});

test('renderBox: NO_COLOR remove escape codes', () => {
  const oldNoColor = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  try {
    const out = renderBox({ title: 'X', lines: ['hello'], emoji: '✓' });
    assert.equal(stripAnsi(out), out, 'output ja deveria estar sem ANSI');
  } finally {
    if (oldNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = oldNoColor;
  }
});

test('renderBox: linhas longas sao quebradas (wrap)', () => {
  const longLine = 'a'.repeat(100);
  const out = renderBox({ title: 'X', lines: [longLine], emoji: '!' });
  // Deve haver mais de uma linha de body
  const bodyLines = out.split('\n').filter((l) => l.includes('a'.repeat(10)));
  assert.ok(bodyLines.length >= 2, 'esperava pelo menos 2 linhas de wrap');
});
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/visual-output.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `hooks/lib/visual-output.mjs`**

Criar `hooks/lib/visual-output.mjs`:

```javascript
// hooks/lib/visual-output.mjs
//
// Render de boxes ANSI pra output visual dos hooks.
// Suporta NO_COLOR + TERM=dumb fallback (texto plano).

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(s) {
  return s.replace(ANSI_RE, '');
}

function noColorMode() {
  return !!process.env.NO_COLOR || process.env.TERM === 'dumb';
}

function colorize(s, color) {
  if (noColorMode()) return s;
  const code = ANSI[color] || '';
  return `${code}${s}${ANSI.reset}`;
}

function dim(s) {
  if (noColorMode()) return s;
  return `${ANSI.dim}${s}${ANSI.reset}`;
}

function wrap(line, width) {
  if (line.length <= width) return [line];
  const out = [];
  let remaining = line;
  while (remaining.length > width) {
    let cutAt = width;
    const space = remaining.lastIndexOf(' ', width);
    if (space > width / 2) cutAt = space;
    out.push(remaining.slice(0, cutAt).trimEnd());
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining.length > 0) out.push(remaining);
  return out;
}

export function renderBox({ title, lines = [], color = 'yellow', emoji = '💭', mode = null, width = 60 }) {
  const innerW = width - 4; // 2 chars border + 2 padding
  const titleStr = `${emoji} ${title}`;
  const titlePadded = ` ${titleStr} `;
  const dashCount = Math.max(2, width - 2 - titlePadded.length);
  const top = colorize(`╭─${titlePadded}${'─'.repeat(dashCount)}╮`, color);
  const bot = colorize(`╰${'─'.repeat(width - 2)}╯`, color);
  const empty = `${colorize('│', color)} ${' '.repeat(innerW)} ${colorize('│', color)}`;

  const bodyLines = lines.flatMap((l) => wrap(l, innerW));
  const bodyRendered = bodyLines.map((l) => `${colorize('│', color)} ${l.padEnd(innerW)} ${colorize('│', color)}`);

  const modeRendered = mode
    ? [`${colorize('│', color)} ${dim(`Modo: ${mode}`).padEnd(innerW + dim('').length)} ${colorize('│', color)}`]
    : [];

  // Recompute padding for mode line because dim() adds chars when not NO_COLOR
  const modeFixed = mode
    ? (() => {
        const text = `Modo: ${mode}`;
        const padded = text.padEnd(innerW);
        return [`${colorize('│', color)} ${dim(padded)} ${colorize('│', color)}`];
      })()
    : [];

  return [top, empty, ...bodyRendered, ...modeFixed, empty, bot].join('\n');
}
```

- [ ] **Step 4: Rodar — GREEN**

Run: `node --test tests/visual-output.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 120 + 3 = **123 PASS, 0 FAIL**.

- [ ] **Step 6: Commit**

```bash
git add hooks/lib/visual-output.mjs tests/visual-output.test.mjs
git commit -m "feat(vibecoder-onda2): hooks/lib/visual-output.mjs (ANSI box + NO_COLOR) + 3 testes"
```

---

## Task 4: `hooks/lib/prompt-history.mjs` (TDD, 4 testes)

**Files:**
- Create: `hooks/lib/prompt-history.mjs`
- Create: `tests/prompt-history.test.mjs`

- [ ] **Step 1: Escrever 4 testes RED**

Criar `tests/prompt-history.test.mjs`:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { append, readLastN, rotate } from '../hooks/lib/prompt-history.mjs';

let dir;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-history-'));
});

test('append + readLastN: ordem mais-recente-primeiro', async () => {
  const file = path.join(dir, 'h.jsonl');
  await append(file, { ts: 1, prompt: 'a', session_id: 's1', cwd: '/x' });
  await append(file, { ts: 2, prompt: 'b', session_id: 's1', cwd: '/x' });
  await append(file, { ts: 3, prompt: 'c', session_id: 's1', cwd: '/x' });
  const last = await readLastN(file, 2);
  assert.equal(last.length, 2);
  assert.equal(last[0].prompt, 'c');
  assert.equal(last[1].prompt, 'b');
});

test('readLastN: arquivo ausente retorna []', async () => {
  const result = await readLastN(path.join(dir, 'nao-existe.jsonl'), 5);
  assert.deepEqual(result, []);
});

test('rotate: trunca pras ultimas N entries', async () => {
  const file = path.join(dir, 'h.jsonl');
  for (let i = 0; i < 10; i++) {
    await append(file, { ts: i, prompt: `p${i}`, session_id: 's', cwd: '/x' });
  }
  await rotate(file, 3);
  const all = await readLastN(file, 100);
  assert.equal(all.length, 3);
  assert.equal(all[0].prompt, 'p9');
  assert.equal(all[2].prompt, 'p7');
});

test('rotate: arquivo menor que limite nao muda', async () => {
  const file = path.join(dir, 'h.jsonl');
  await append(file, { ts: 1, prompt: 'a', session_id: 's', cwd: '/x' });
  await rotate(file, 10);
  const all = await readLastN(file, 5);
  assert.equal(all.length, 1);
});
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/prompt-history.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `hooks/lib/prompt-history.mjs`**

Criar `hooks/lib/prompt-history.mjs`:

```javascript
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
```

- [ ] **Step 4: Rodar — GREEN**

Run: `node --test tests/prompt-history.test.mjs`
Expected: 4 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 123 + 4 = **127 PASS, 0 FAIL**.

- [ ] **Step 6: Commit**

```bash
git add hooks/lib/prompt-history.mjs tests/prompt-history.test.mjs
git commit -m "feat(vibecoder-onda2): hooks/lib/prompt-history.mjs (jsonl) + 4 testes"
```

---

## Task 5: `hooks/lib/prompt-analyzer.mjs` (TDD, 10 testes)

**Files:**
- Create: `hooks/lib/prompt-analyzer.mjs`
- Create: `tests/prompt-analyzer.test.mjs`

- [ ] **Step 1: Escrever 10 testes RED**

Criar `tests/prompt-analyzer.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLazy, analyzeStuck } from '../hooks/lib/prompt-analyzer.mjs';

// ===== analyzeLazy =====

test('analyzeLazy: prompt curto sem contexto eh flagged', () => {
  const r = analyzeLazy('faz isso');
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /curto|contexto/i.test(x)));
});

test('analyzeLazy: pergunta clara curta NAO eh flagged', () => {
  const r = analyzeLazy('como rodo os testes?');
  assert.equal(r.flagged, false);
});

test('analyzeLazy: palavra vaga isolada eh flagged', () => {
  const r = analyzeLazy('isso');
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /vag/i.test(x)));
});

test('analyzeLazy: whitelist "ok" / "sim" / "continue" NAO flagged', () => {
  for (const p of ['ok', 'sim', 'prossiga', 'continue', 'cancela']) {
    const r = analyzeLazy(p);
    assert.equal(r.flagged, false, `"${p}" nao deveria ser flagged`);
  }
});

test('analyzeLazy: comando claude (^/) NAO flagged', () => {
  const r = analyzeLazy('/tino:refresh');
  assert.equal(r.flagged, false);
});

test('analyzeLazy: error paste sem pergunta eh flagged', () => {
  const errorText = `Error: cannot find module
    at Module._resolveFilename (internal/modules/cjs/loader.js:889:15)
    at Function.Module._load (internal/modules/cjs/loader.js:745:27)`;
  const r = analyzeLazy(errorText);
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /error|paste/i.test(x)));
});

test('analyzeLazy: prompt longo com contexto NAO flagged', () => {
  const r = analyzeLazy('Preciso adicionar autenticacao ao endpoint /api/users — pode usar JWT? O resto do projeto ja usa.');
  assert.equal(r.flagged, false);
});

// ===== analyzeStuck =====

test('analyzeStuck: "tenta de novo" curto eh flagged', () => {
  const r = analyzeStuck('tenta de novo', []);
  assert.equal(r.flagged, true);
  assert.ok(r.reasons.some((x) => /tenta|novo/i.test(x)));
});

test('analyzeStuck: prompt identico nas ultimas 3 eh flagged', () => {
  const history = [
    { prompt: 'arruma o bug do login', ts: 1 },
    { prompt: 'arruma o bug do login', ts: 2 },
  ];
  const r = analyzeStuck('arruma o bug do login', history);
  assert.equal(r.flagged, true);
  assert.ok(r.repetitions >= 1);
});

test('analyzeStuck: history vazio + prompt limpo NAO flagged', () => {
  const r = analyzeStuck('preciso refatorar a funcao login pra retornar Promise', []);
  assert.equal(r.flagged, false);
});
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/prompt-analyzer.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `hooks/lib/prompt-analyzer.mjs`**

Criar `hooks/lib/prompt-analyzer.mjs`:

```javascript
// hooks/lib/prompt-analyzer.mjs
//
// Heuristicas puras pra detectar prompt preguicoso ou loop "tenta de novo".
// Sem I/O, sem deps externas. Hot path do hook — manter rapido.

const VAGUE_ONLY = /^(isso|aquilo|esse(?:\s+troço)?|tipo\s+assim|aí|ne|né|você\s+sabe)\.?$/i;
const CLAUDE_COMMAND = /^\//;
const WHITELIST = /^(ok|sim|nao|não|prossiga|continue|skip|cancela|cancelar|abort|stop|para|pare)\.?$/i;
const QUESTION_STARTERS = /^(como|qual|quando|onde|por\s*que|porqu[eê]|quem|o\s*que|por\s*onde)\b/i;
const ERROR_LINE = /\b(at\s+\w+|Error:|Exception:|Traceback|stack:|TypeError|ReferenceError|SyntaxError)\b/;

const RETRY_PATTERN = /\b(tenta\s+(de\s+novo|outra\s+vez|novamente|aí)?|refaz|de\s+novo|tenta\s+outra\s+vez)\b/i;

export function analyzeLazy(prompt) {
  const reasons = [];
  const trimmed = (prompt || '').trim();

  // Whitelist primeiro (saida rapida)
  if (CLAUDE_COMMAND.test(trimmed)) return ok();
  if (WHITELIST.test(trimmed)) return ok();

  // Vague-only
  if (VAGUE_ONLY.test(trimmed)) {
    reasons.push('prompt vago sem referente — diga o que voce quer');
    return result(reasons);
  }

  // Curto sem ser pergunta clara
  if (trimmed.length < 30 && !isClearQuestion(trimmed)) {
    reasons.push('prompt muito curto e sem contexto — descreva o objetivo + o resultado esperado');
  }

  // Error paste sem pergunta
  if (looksLikeErrorPaste(trimmed)) {
    reasons.push('parece error paste sem pergunta — o que voce quer fazer com isso?');
  }

  return result(reasons);
}

export function analyzeStuck(prompt, recentHistory = []) {
  const reasons = [];
  const trimmed = (prompt || '').trim();
  const lower = trimmed.toLowerCase();

  // Padrao "tenta de novo" curto
  if (RETRY_PATTERN.test(trimmed) && trimmed.length < 80) {
    reasons.push('padrao "tenta de novo" sem novo contexto — explique o que mudou desde a ultima tentativa');
  }

  // Repeticao literal
  const recent = recentHistory.slice(0, 3);
  const repetitions = recent.filter((h) => (h.prompt || '').trim().toLowerCase() === lower).length;
  if (repetitions >= 1) {
    reasons.push(`prompt identico ja enviado ${repetitions}x recentemente — pause e reformule com nova info`);
  }

  // Repeticao de fragmento de erro
  if (containsRepeatedErrorFragment(trimmed, recentHistory.slice(0, 5))) {
    reasons.push('mesmo erro repetido em prompts anteriores — entrar em loop eh sinal de pausar');
  }

  return { ...result(reasons), repetitions };
}

// ===== helpers =====

function isClearQuestion(s) {
  return s.endsWith('?') || QUESTION_STARTERS.test(s);
}

function looksLikeErrorPaste(s) {
  const lines = s.split('\n').filter((l) => l.trim());
  if (lines.length < 3) return false;
  const errorLines = lines.filter((l) => ERROR_LINE.test(l)).length;
  const hasQuestion = s.includes('?');
  return errorLines >= 1 && !hasQuestion;
}

function containsRepeatedErrorFragment(prompt, history) {
  // Extrair 1 fragmento ≥ 10 chars do prompt; checar se aparece em history
  const lines = prompt.split('\n').filter((l) => l.trim().length >= 10);
  if (lines.length === 0) return false;
  const fragment = lines[0].trim().slice(0, 50);
  return history.some((h) => (h.prompt || '').includes(fragment));
}

function ok() {
  return { flagged: false, reasons: [], severity: 'none' };
}

function result(reasons) {
  if (reasons.length === 0) return ok();
  const severity = reasons.length >= 2 ? 'high' : 'med';
  return { flagged: true, reasons, severity };
}
```

- [ ] **Step 4: Rodar — GREEN**

Run: `node --test tests/prompt-analyzer.test.mjs`
Expected: 10 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 127 + 10 = **137 PASS, 0 FAIL**.

- [ ] **Step 6: Commit**

```bash
git add hooks/lib/prompt-analyzer.mjs tests/prompt-analyzer.test.mjs
git commit -m "feat(vibecoder-onda2): hooks/lib/prompt-analyzer.mjs (analyzeLazy + analyzeStuck) + 10 testes"
```

---

## Task 6: Hook entry `hooks/anti-preguicoso.mjs` + integration test (3 testes)

**Files:**
- Create: `hooks/anti-preguicoso.mjs`
- Create: `tests/anti-preguicoso.integration.test.mjs`

- [ ] **Step 1: Escrever 3 testes integration RED**

Criar `tests/anti-preguicoso.integration.test.mjs`:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks/anti-preguicoso.mjs');

let vault;

beforeEach(async () => {
  vault = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-hook-'));
  await fs.mkdir(path.join(vault, 'Tino'), { recursive: true });
});

function runHook(stdin, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK], { env: { ...process.env, ...env, TINO_VAULT_PATH: vault } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', reject);
    proc.stdin.write(JSON.stringify(stdin));
    proc.stdin.end();
  });
}

async function writePerfil(intervencao) {
  const md = `---
schema_version: 1
papel: junior
experiencia_dev: iniciante
plano_claude: pro
sistema: darwin
tipo_projeto: [webapp]
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ${intervencao}
---
body
`;
  await fs.writeFile(path.join(vault, 'Tino', '_perfil-vibecoder.md'), md, 'utf8');
}

test('anti-preguicoso: perfil ausente -> exit 0 silent', async () => {
  const { code, stdout, stderr } = await runHook({ prompt: 'isso aqui', cwd: '/tmp' });
  assert.equal(code, 0);
  assert.equal(stderr.trim(), '');
});

test('anti-preguicoso: ativa + prompt vago -> exit 0 + stderr tem box', async () => {
  await writePerfil('ativa');
  const { code, stderr } = await runHook({ prompt: 'isso', cwd: '/tmp' });
  assert.equal(code, 0);
  assert.ok(stderr.includes('Tino') && stderr.includes('preguic'));
});

test('anti-preguicoso: agressiva + prompt curto -> exit 2 + stderr tem box', async () => {
  await writePerfil('agressiva');
  const { code, stderr } = await runHook({ prompt: 'faz', cwd: '/tmp' });
  assert.equal(code, 2);
  assert.ok(stderr.includes('Tino'));
});
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/anti-preguicoso.integration.test.mjs`
Expected: FAIL — `Cannot find module .../hooks/anti-preguicoso.mjs`.

- [ ] **Step 3: Implementar `hooks/anti-preguicoso.mjs`**

Criar `hooks/anti-preguicoso.mjs`:

```javascript
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
```

- [ ] **Step 4: Tornar executavel**

Run: `chmod +x /Users/rafaelmelgaco/tino-ai/hooks/anti-preguicoso.mjs`

- [ ] **Step 5: Rodar — GREEN**

Run: `node --test tests/anti-preguicoso.integration.test.mjs`
Expected: 3 PASS.

- [ ] **Step 6: Verificar `npm test`**

Expected: 137 + 3 = **140 PASS, 0 FAIL**.

- [ ] **Step 7: Commit**

```bash
git add hooks/anti-preguicoso.mjs tests/anti-preguicoso.integration.test.mjs
git commit -m "feat(vibecoder-onda2): hooks/anti-preguicoso.mjs (entry + 3 integration tests)"
```

---

## Task 7: Hook entry `hooks/anti-burro.mjs` + integration test (3 testes)

**Files:**
- Create: `hooks/anti-burro.mjs`
- Create: `tests/anti-burro.integration.test.mjs`

- [ ] **Step 1: Escrever 3 testes integration RED**

Criar `tests/anti-burro.integration.test.mjs`:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks/anti-burro.mjs');

let vault;

beforeEach(async () => {
  vault = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-hook-'));
  await fs.mkdir(path.join(vault, 'Tino'), { recursive: true });
});

function runHook(stdin, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK], { env: { ...process.env, ...env, TINO_VAULT_PATH: vault } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', reject);
    proc.stdin.write(JSON.stringify(stdin));
    proc.stdin.end();
  });
}

async function writePerfil(intervencao) {
  const md = `---
schema_version: 1
papel: junior
experiencia_dev: iniciante
plano_claude: pro
sistema: darwin
tipo_projeto: [webapp]
modo_autonomia: balanceado
tolerancia_risco: media
intervencao_hooks: ${intervencao}
---
body
`;
  await fs.writeFile(path.join(vault, 'Tino', '_perfil-vibecoder.md'), md, 'utf8');
}

async function seedHistory(entries) {
  const histPath = path.join(vault, '.tino-cache', 'prompt-history.jsonl');
  await fs.mkdir(path.dirname(histPath), { recursive: true });
  const lines = entries.map((e) => JSON.stringify({ ts: e.ts || Date.now(), prompt: e.prompt, session_id: 's1', cwd: '/tmp' })).join('\n') + '\n';
  await fs.writeFile(histPath, lines, 'utf8');
}

test('anti-burro: perfil ausente -> exit 0 silent', async () => {
  const { code, stderr } = await runHook({ prompt: 'tenta de novo', cwd: '/tmp' });
  assert.equal(code, 0);
  assert.equal(stderr.trim(), '');
});

test('anti-burro: ativa + "tenta de novo" -> exit 0 + stderr tem box', async () => {
  await writePerfil('ativa');
  const { code, stderr } = await runHook({ prompt: 'tenta de novo aí', cwd: '/tmp' });
  assert.equal(code, 0);
  assert.ok(stderr.includes('Tino') && stderr.includes('burro'));
});

test('anti-burro: agressiva + prompt repetido -> exit 2', async () => {
  await writePerfil('agressiva');
  await seedHistory([
    { prompt: 'arruma o login', ts: 1 },
    { prompt: 'arruma o login', ts: 2 },
  ]);
  const { code, stderr } = await runHook({ prompt: 'arruma o login', cwd: '/tmp' });
  assert.equal(code, 2);
  assert.ok(stderr.includes('Tino'));
});
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/anti-burro.integration.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `hooks/anti-burro.mjs`**

Criar `hooks/anti-burro.mjs`:

```javascript
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
```

- [ ] **Step 4: Tornar executavel**

Run: `chmod +x /Users/rafaelmelgaco/tino-ai/hooks/anti-burro.mjs`

- [ ] **Step 5: Rodar — GREEN**

Run: `node --test tests/anti-burro.integration.test.mjs`
Expected: 3 PASS.

- [ ] **Step 6: Verificar `npm test`**

Expected: 140 + 3 = **143 PASS, 0 FAIL**.

- [ ] **Step 7: Commit**

```bash
git add hooks/anti-burro.mjs tests/anti-burro.integration.test.mjs
git commit -m "feat(vibecoder-onda2): hooks/anti-burro.mjs (entry + 3 integration tests)"
```

---

## Task 8: `lib/tino-home.mjs` (TDD, 2 testes)

**Files:**
- Create: `lib/tino-home.mjs`
- Create: `tests/tino-home.test.mjs`

- [ ] **Step 1: Escrever 2 testes RED**

Criar `tests/tino-home.test.mjs`:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveHomePath } from '../lib/tino-home.mjs';

let tmpHome;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'tino-home-test-'));
});

test('resolveHomePath: le TINO_HOME de config.sh', async () => {
  await fs.mkdir(path.join(tmpHome, '.tino'), { recursive: true });
  const cfg = `export TINO_HOME="/path/to/tino"\nexport TINO_VAULT_PATH="/path/to/vault"\n`;
  await fs.writeFile(path.join(tmpHome, '.tino', 'config.sh'), cfg);
  const result = await resolveHomePath({ homeDir: tmpHome });
  assert.equal(result, '/path/to/tino');
});

test('resolveHomePath: arquivo ausente retorna null', async () => {
  const result = await resolveHomePath({ homeDir: tmpHome });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/tino-home.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/tino-home.mjs`**

Criar `lib/tino-home.mjs`:

```javascript
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
```

- [ ] **Step 4: Rodar — GREEN**

Run: `node --test tests/tino-home.test.mjs`
Expected: 2 PASS.

- [ ] **Step 5: Verificar `npm test`**

Expected: 143 + 2 = **145 PASS, 0 FAIL**.

- [ ] **Step 6: Commit**

```bash
git add lib/tino-home.mjs tests/tino-home.test.mjs
git commit -m "feat(vibecoder-onda2): lib/tino-home.mjs (resolve TINO_HOME) + 2 testes"
```

---

## Task 9: UPDATE `lib/settings-patch.mjs` — preencher hooks block (2 testes novos)

**Files:**
- Modify: `lib/settings-patch.mjs`
- Create: `tests/settings-patch-hooks.test.mjs`

- [ ] **Step 1: Escrever 2 testes RED**

Criar `tests/settings-patch-hooks.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Rodar — RED**

Run: `node --test tests/settings-patch-hooks.test.mjs`
Expected: FAIL — hooks block ausente, ou _tino_hooks_placeholder não em remove.

- [ ] **Step 3: Atualizar `lib/settings-patch.mjs`**

Editar `lib/settings-patch.mjs`. Adicionar parâmetro `opts` ao `computePatch` e bloco hooks. Localizar o final da função `computePatch(perfil)` e modificar:

Localize a função `export function computePatch(perfil) {` e substitua sua assinatura + corpo final por:

```javascript
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
```

**Importante:** o teste `tests/settings-patch.test.mjs` da Onda 1 NÃO deve quebrar — mantém os 5 testes verdes. Conferir após edição.

- [ ] **Step 4: Rodar — GREEN (novos + existentes)**

Run: `node --test tests/settings-patch-hooks.test.mjs tests/settings-patch.test.mjs`
Expected: 2 + 5 = 7 PASS, 0 FAIL.

- [ ] **Step 5: Verificar `npm test` total**

Expected: 145 + 2 = **147 PASS, 0 FAIL**.

- [ ] **Step 6: Commit**

```bash
git add lib/settings-patch.mjs tests/settings-patch-hooks.test.mjs
git commit -m "feat(vibecoder-onda2): settings-patch preenche hooks block real (TINO_HOME) + 2 testes"
```

---

## Task 10: Doc humana + README + verificação final

**Files:**
- Create: `docs/hooks-vibecoder.md`
- Modify: `README.md` (adicionar seção "Hooks runtime (Onda 2)")

- [ ] **Step 1: Criar `docs/hooks-vibecoder.md`**

```markdown
# Hooks vibecoder — uso, debug, desativar

Os hooks rodam em `UserPromptSubmit` (toda vez que voce envia um prompt no Claude Code) e detectam padroes tipicos de erro do vibecoder iniciante. Comportamento eh derivado de `Tino/_perfil-vibecoder.md` no campo `intervencao_hooks`:

| Nivel | Comportamento |
|---|---|
| `silenciosa` | Apenas log em `.tino-cache/hook-log.jsonl`. Nao mostra nada. |
| `ativa` | Mostra box ANSI no stderr quando flagged. Nao bloqueia. |
| `agressiva` | Box no stderr + bloqueia o prompt (exit 2). Forca voce a reformular. |

## Os 2 hooks

### anti-preguicoso

Flagra prompts:
- Curtos (< 30 chars) sem ser pergunta clara
- Vagos isolados ("isso", "aquilo", "esse troço")
- Error paste sem pergunta

**Whitelist:** comandos `/...`, respostas curtas como "ok"/"sim"/"continue", perguntas claras com "como"/"qual"/"quando".

### anti-burro

Flagra:
- Padrao "tenta de novo", "refaz", "de novo" sem novo contexto
- Mesmo prompt repetido nas ultimas 3 entradas
- Repeticao de fragmento de erro de prompts anteriores

State em `.tino-cache/prompt-history.jsonl` (rotacionado em 1000 entries).

## Como instalar

Os hooks sao instalados automaticamente pelo `/tino:vibe-install` (Onda 1) — registra em `~/.claude/settings.json` apontando pra `$TINO_HOME/hooks/anti-{preguicoso,burro}.mjs`.

Se quiser instalar manualmente, edite `~/.claude/settings.json`:

\`\`\`json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "node /caminho/pra/tino-ai/hooks/anti-preguicoso.mjs" },
          { "type": "command", "command": "node /caminho/pra/tino-ai/hooks/anti-burro.mjs" }
        ]
      }
    ]
  }
}
\`\`\`

## Como debugar

Logs em `{vault}/.tino-cache/hook-log.jsonl`. Cada entry: `{ ts, hook, interv, prompt, cwd, vaultPath }`.

Pra rodar um hook isoladamente:

\`\`\`bash
echo '{"prompt":"isso","cwd":"/tmp"}' | TINO_VAULT_PATH=/seu/vault node hooks/anti-preguicoso.mjs
echo $?
\`\`\`

## Como desativar

Opcao 1: edite `Tino/_perfil-vibecoder.md` e mude `intervencao_hooks` pra `silenciosa`.

Opcao 2: remova o bloco `hooks` de `~/.claude/settings.json`. Backup automatico foi criado em `~/.claude/settings.json.tino-bak.<ISO>` quando o `/tino:vibe-install` rodou.

Opcao 3: variavel de ambiente — `unset TINO_VAULT_PATH` ou aponte pra um diretorio sem `Tino/_perfil-vibecoder.md`. Os hooks vao retornar exit 0 silent.

## Performance

Cada hook deve rodar em < 500ms (Node cold start ~100ms + load perfil + analyzer ~50ms + output render). Se sentir lentidao, cheque com:

\`\`\`bash
time bash -c "echo '{\"prompt\":\"test\"}' | TINO_VAULT_PATH=/vault node hooks/anti-preguicoso.mjs"
\`\`\`
```

- [ ] **Step 2: Editar `README.md` adicionando seção "Hooks runtime (Onda 2)"**

Localizar a seção "## Modo vibecoder (Onda 1)" no `README.md` (procure via grep). Adicionar APÓS o final dessa seção (use Edit pra inserir após a linha que fecha a Onda 1, ANTES da próxima seção). Conteúdo:

\`\`\`markdown

### Hooks runtime (Onda 2)

Depois do setup, dois hooks ficam ativos no seu Claude Code global e te avisam quando voce comete os erros tipicos de iniciante:

- **anti-preguicoso** — prompt curto demais, vago ("isso", "aquilo") ou error paste sem pergunta
- **anti-burro** — "tenta de novo" sem novo contexto, prompt identico repetido, mesmo erro citado de novo

Comportamento (ativa, agressiva ou silenciosa) eh controlado pelo campo `intervencao_hooks` do seu `Tino/_perfil-vibecoder.md`. Veja [docs/hooks-vibecoder.md](docs/hooks-vibecoder.md) pra detalhes de uso, debug e desativacao.

\`\`\`

- [ ] **Step 3: Verificar `npm test` final**

Run: `cd /Users/rafaelmelgaco/tino-ai && npm test`
Expected: **147 PASS, 0 FAIL** (117 da Onda 1 + 30 da Onda 2).

- [ ] **Step 4: Verificar suite focada `test:hooks`**

Run: `cd /Users/rafaelmelgaco/tino-ai && time npm run test:hooks`
Expected: 30 testes PASS, < 5s real time.

- [ ] **Step 5: Performance test cada hook**

Run:
```bash
echo '{"prompt":"isso","cwd":"/tmp"}' | time node /Users/rafaelmelgaco/tino-ai/hooks/anti-preguicoso.mjs 2>&1 | tail -5
echo '{"prompt":"tenta de novo","cwd":"/tmp"}' | time node /Users/rafaelmelgaco/tino-ai/hooks/anti-burro.mjs 2>&1 | tail -5
```
Expected: Cada um < 500ms wall-clock (visto via `time`).

- [ ] **Step 6: Commit final**

```bash
git add docs/hooks-vibecoder.md README.md
git commit -m "docs(vibecoder-onda2): doc humana + README hooks runtime + Onda 2 fechada"
```

---

## Task 11: Verificação final + commit-resumo opcional

- [ ] **Step 1: Conferir checklist do spec**

Abrir `docs/superpowers/specs/2026-04-28-tino-vibecoder-hooks-design.md` seção 10 (deliverables checklist). Marcar mentalmente:
- 2 hooks `.mjs` em `hooks/` ✓
- 4 lib modules em `hooks/lib/` ✓
- `lib/settings-patch.mjs` atualizado ✓
- `lib/tino-home.mjs` ✓
- `docs/hooks-vibecoder.md` ✓
- 147 testes total green ✓
- Performance gate cada hook < 500ms (verificar via Step 5 de Task 10)
- README atualizado ✓
- Smoke test manual (opcional — pode pular pra fechar epic limpo)

- [ ] **Step 2: Conferir métricas finais**

Run:
```bash
git log --oneline | grep -c "(vibecoder-onda2)"
npm test 2>&1 | tail -8
```
Expected: ≥ 10 commits da Onda 2; **147 PASS, 0 FAIL**.

- [ ] **Step 3: (OPCIONAL) Commit-resumo vazio**

```bash
git commit --allow-empty -m "milestone(vibecoder): Onda 2 fechada — hooks runtime green com 147 testes"
```

(Pular se preferir manter histórico só com commits substantivos.)

---

## Self-Review do Plano

**1. Spec coverage:** todas as seções do spec têm task correspondente. Sec 4 (hook flow) = T6/T7. Sec 5 (visual) = T3. Sec 6 (state) = T4. Sec 7 (settings-patch update) = T9. Sec 8 (waves) = mapeamento natural pras 11 tasks. Sec 9 (testes) = distribuição bate (3+3+4+10+3+3+2+2 = 30). Sec 10 (checklist) = T11.

**2. Placeholder scan:** zero "TBD/TODO/implement later". Cada step tem código completo ou comando exato.

**3. Type consistency:**
- `parseStdinJson(raw)` usado em T2 (def) e T6/T7 (uso) — assinatura idêntica
- `loadPerfil(vaultPath) → object|null` consistente
- `analyzeLazy(prompt)` retorna `{flagged, reasons, severity}` em T5 (def), usado em T6
- `analyzeStuck(prompt, history)` retorna `{flagged, reasons, severity, repetitions}` em T5, usado em T7
- `renderBox({title, lines, color, emoji, mode, width})` mesmas opts em T3 (def) e T6/T7 (uso)
- `append(filePath, entry)` / `readLastN(filePath, n)` / `rotate(filePath, max)` em T4, usados em T7
- `resolveHomePath(opts?)` em T8, usado em T9 (settings-patch via param `opts.tinoHome`)
- `computePatch(perfil, opts?)` em T9 (assinatura nova) — backward-compat: opts é opcional, se omitido usa `'$TINO_HOME'` literal — preserva os 5 testes da Onda 1 (todos chamam sem opts)

**4. Test count check:**
- T2: 3 hook-context
- T3: 3 visual-output
- T4: 4 prompt-history
- T5: 10 prompt-analyzer
- T6: 3 anti-preguicoso integration
- T7: 3 anti-burro integration
- T8: 2 tino-home
- T9: 2 settings-patch hooks
- Total novo: 30
- Baseline: 117 (Onda 1)
- Gate final: **147 PASS** ✓ bate em T10 step 3.

Plano validado.
