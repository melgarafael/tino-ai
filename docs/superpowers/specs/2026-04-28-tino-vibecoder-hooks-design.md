# Tino Vibecoder — Onda 2: Hooks Runtime

**Data:** 2026-04-28
**Status:** Draft (aguardando review do user)
**Escopo:** Onda 2 de 3 (Fundação → Setup assistido → **Hooks runtime**) — última onda do plano vibecoder
**Próximo passo após aprovação:** invocar skill `writing-plans` pra gerar plano executável

---

## 1. Contexto

Esta é a peça final do vision do Tino vibecoder. As Ondas 0 (87 testes) e 1 (117 testes total) entregaram a infraestrutura + experiência de setup. A Onda 2 entrega a parte que **acompanha o user em runtime**: hooks que detectam padrões típicos de erro do vibecoder júnior (prompts vagos, loops "tenta de novo") antes que virem bola-de-neve de tokens gastos com erro composto.

**A insight chave** (do prompt original do user): *"quando comete 1 erro e cria 1 bug, os usuários costumam falar tenta de novo, tenta de novo, tenta de novo... a tendência é que ela crie bola de neve de erros"*. Os hooks interceptam exatamente esse padrão — não pra serem chatos, mas pra **forçar uma pausa antes do retry**, exigindo que o user dê novo contexto ao invés de sentar no mesmo loop.

Onda 1 já reservou `_tino_hooks_placeholder` em `~/.claude/settings.json`. Onda 2 substitui pelo bloco real.

---

## 2. Goals e Non-Goals

### Goals

- Entregar 2 hooks `UserPromptSubmit` que respeitam `perfil.intervencao_hooks` (silenciosa/ativa/agressiva)
- Anti-preguiçoso detecta prompts curtos/vagos com heurísticas puras
- Anti-burro detecta padrão "tenta de novo" + repetição literal via histórico em `.tino-cache/prompt-history.jsonl`
- Output visual chamativo (ANSI box + emoji + cor) com fallback `NO_COLOR`
- **Latência hot path < 200ms ideal, < 500ms hard limit** — sem Claude API call
- `lib/settings-patch.mjs` atualizado pra registrar hooks reais via `TINO_HOME`
- Zero regressão (117 testes Onda 1 continuam green)

### Non-Goals

- LLM-augmented analysis (Claude API call por prompt) — quebra latência. Onda futura se precisar.
- Hooks de outros eventos (`PreToolUse`, `PostToolUse`, `Stop`) — só `UserPromptSubmit` nesta onda
- Vault search semântico — só `grep -r` simples, max 5 results
- Editar settings.json automaticamente sem o `/tino:vibe-install` da Onda 1 (mantém boundary)
- Hooks em escopo project-only (`{project}/.claude/settings.json`) — só global, consistente com Onda 1

---

## 3. Arquitetura e layout de arquivos

```
tino-ai/
├── hooks/
│   ├── anti-preguicoso.mjs              NEW (entry point Node, lê stdin)
│   ├── anti-burro.mjs                   NEW (entry point Node)
│   └── lib/
│       ├── hook-context.mjs             NEW (parse stdin, load perfil cached, resolve TINO_HOME)
│       ├── prompt-analyzer.mjs          NEW (heurísticas puras)
│       ├── prompt-history.mjs           NEW (jsonl read/write/rotate, query last N)
│       └── visual-output.mjs            NEW (ANSI box, emoji, color)
├── lib/
│   └── settings-patch.mjs               UPDATE — preenche bloco hooks real, dropa placeholder
├── tests/
│   ├── prompt-analyzer.test.mjs         NEW (~10 testes)
│   ├── prompt-history.test.mjs          NEW (~4 testes)
│   ├── visual-output.test.mjs           NEW (~3 testes)
│   ├── hook-context.test.mjs            NEW (~3 testes)
│   ├── hook-integration.test.mjs        NEW (~3 testes E2E rodando entry script)
│   └── settings-patch-hooks.test.mjs    NEW (~2 testes do update)
└── docs/
    └── hooks-vibecoder.md               NEW (doc humana — uso, debug, desativar)
```

13 arquivos novos + 1 modificado (`lib/settings-patch.mjs`).

### Boundary explícito

- Hooks em `hooks/` (novo top-level dir) — separa da `lib/` (libs gerais reusáveis pelo resto do Tino)
- Hooks `.mjs` são entry points executáveis via `node`
- Toda lógica de detecção fica em `hooks/lib/*.mjs` (testável isolado)
- `lib/settings-patch.mjs` é a única coisa fora de `hooks/` que muda — tem que continuar passando os 5 testes da Onda 1
- Zero modificação em outras coisas das Ondas 0 ou 1

---

## 4. Hook flow detalhado

### Input contract (Claude Code envia via stdin)

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.json",
  "cwd": "/Users/.../current-dir",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "the user's prompt text"
}
```

### Output contract (Claude Code lê)

- Exit 0 + stdout vazio → allow silent
- Exit 0 + stdout/stderr não-vazio → allow + mostra texto
- Exit 2 + stderr não-vazio → block, mostra stderr ao user

### Sequência por hook

1. Parse stdin → JSON
2. Carregar perfil:
   - `TINO_VAULT_PATH` via `source ~/.tino/config.sh` (ou env vars já setadas)
   - `{vault}/Tino/_perfil-vibecoder.md` parse via `lib/frontmatter.mjs` (Onda 0)
   - Se ausente → exit 0 silent (vibecoder mode off)
3. Cheque `intervencao_hooks`:
   - `silenciosa` → log em `.tino-cache/hook-log.jsonl`, exit 0
4. Roda analyzer específico do hook
5. Se prompt OK → exit 0 silent
6. Se flagged:
   - `ativa` → renderiza visual em stderr, exit 0
   - `agressiva` → renderiza visual + pergunta clara em stderr, exit 2

### Anti-preguiçoso heurísticas (`hooks/lib/prompt-analyzer.mjs::analyzeLazy(prompt)`)

```javascript
// Returns { flagged: bool, reasons: [string], severity: 'low'|'med'|'high' }

function analyzeLazy(prompt) {
  const reasons = [];
  const trimmed = prompt.trim();
  
  // 1. Length < 30 chars (a menos que pergunta clara)
  if (trimmed.length < 30 && !isClearQuestion(trimmed)) {
    reasons.push('prompt muito curto sem contexto');
  }
  
  // 2. Vague-only words
  const vagueWords = /^(isso|aquilo|esse(?:\s+troço)?|tipo\s+assim|aí|né|você\s+sabe|continue?)\.?$/i;
  if (vagueWords.test(trimmed)) {
    reasons.push('prompt vago sem referente');
  }
  
  // 3. Error paste pattern
  if (looksLikeErrorPaste(trimmed)) {
    reasons.push('parece error paste sem pergunta — o que você quer fazer com isso?');
  }
  
  return { flagged: reasons.length > 0, reasons, severity: severity(reasons) };
}
```

### Anti-burro heurísticas (`analyzeStuck(prompt, history)`)

```javascript
// Returns { flagged: bool, reasons: [string], severity, repetitions: int }

function analyzeStuck(prompt, recentHistory) {
  const reasons = [];
  const trimmed = prompt.trim().toLowerCase();
  
  // 1. "tenta de novo" patterns
  const retryPatterns = /\b(tenta(\s+de\s+novo|\s+outra\s+vez|\s+novamente)?|refaz|de\s+novo|tenta\s+aí)\b/i;
  if (retryPatterns.test(trimmed) && trimmed.length < 80) {
    reasons.push('padrão "tenta de novo" sem novo contexto detectado');
  }
  
  // 2. Repetição literal nas últimas 3 entradas
  const recent = recentHistory.slice(0, 3);
  const repetitions = recent.filter(h => h.prompt.trim().toLowerCase() === trimmed).length;
  if (repetitions >= 1) {
    reasons.push(`prompt idêntico já enviado ${repetitions}x recentemente`);
  }
  
  // 3. Repetição de fragmento de erro
  if (containsRepeatedErrorFragment(trimmed, recentHistory.slice(0, 5))) {
    reasons.push('mesmo erro citado em prompt anterior — entrar em loop é sinal de pausar');
  }
  
  return { flagged: reasons.length > 0, reasons, severity: severity(reasons), repetitions };
}
```

---

## 5. Visual output

### Estrutura ANSI

```
╭─ 🤔 Tino [anti-preguiçoso] ──────────────────────────────╮
│                                                          │
│  Seu prompt parece curto e sem contexto:                │
│  • prompt muito curto sem contexto                       │
│                                                          │
│  Sugestão: descreva o que você quer fazer + qual o      │
│  resultado esperado + o que você já tentou.             │
│                                                          │
│  Modo: ativa (não vou bloquear, mas leia isso 👆)       │
╰──────────────────────────────────────────────────────────╯
```

### Implementação (`hooks/lib/visual-output.mjs`)

```javascript
export function renderBox({ title, lines, color = 'yellow', emoji = '💭', mode }) {
  const noColor = process.env.NO_COLOR || process.env.TERM === 'dumb';
  const w = 60;
  const colors = noColor ? { yellow: '', red: '', green: '', reset: '', dim: '' }
                          : { yellow: '\x1b[33m', red: '\x1b[31m', green: '\x1b[32m',
                              reset: '\x1b[0m', dim: '\x1b[2m' };
  const c = colors[color] || colors.yellow;
  const top = `${c}╭─ ${emoji} ${title} ${'─'.repeat(Math.max(0, w - title.length - emoji.length - 6))}╮${colors.reset}`;
  const bot = `${c}╰${'─'.repeat(w - 2)}╯${colors.reset}`;
  const empty = `${c}│${colors.reset}${' '.repeat(w - 2)}${c}│${colors.reset}`;
  const body = lines.flatMap(l => wrap(l, w - 4).map(s => `${c}│${colors.reset}  ${s.padEnd(w - 4)}${c}│${colors.reset}`));
  const modeLine = mode ? [`${c}│${colors.reset}  ${colors.dim}Modo: ${mode}${colors.reset}${' '.repeat(w - 4 - 8 - mode.length)}${c}│${colors.reset}`] : [];
  return [top, empty, ...body, ...modeLine, empty, bot].join('\n');
}
```

Helper `wrap(line, width)` quebra em múltiplas linhas se passar do width.

---

## 6. State management — `prompt-history.jsonl`

Localização: `.tino-cache/prompt-history.jsonl` (relativo a `process.cwd()` ou `TINO_HOME`).

Cada linha = JSON: `{ ts: epoch_ms, session_id, prompt, cwd }`.

```javascript
// hooks/lib/prompt-history.mjs

const MAX_ENTRIES = 1000;

export async function append(entry) {
  await fs.mkdir(path.dirname(historyPath()), { recursive: true });
  await fs.appendFile(historyPath(), JSON.stringify(entry) + '\n');
  // Periodic rotate (cheap probabilistic)
  if (Math.random() < 0.05) await rotate();
}

export async function readLastN(n) {
  try {
    const raw = await fs.readFile(historyPath(), 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-n).reverse().map(l => JSON.parse(l)); // most-recent-first
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function rotate() {
  const raw = await fs.readFile(historyPath(), 'utf8').catch(() => '');
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length > MAX_ENTRIES) {
    const trimmed = lines.slice(-MAX_ENTRIES).join('\n') + '\n';
    await fs.writeFile(historyPath(), trimmed);
  }
}
```

---

## 7. Update no `lib/settings-patch.mjs`

Substitui o placeholder por bloco real, mantendo backward-compat:

```javascript
// Adicionar import:
import { resolveHomePath } from './tino-home.mjs'; // novo helper, lê ~/.tino/config.sh

// computePatch() ganha bloco — REGISTRA SEMPRE OS 2 HOOKS,
// independente de intervencao_hooks. Comportamento (log/sugest/block) eh decidido
// dentro do hook lendo o perfil. Mantem principio "behavior derives from perfil,
// not from registration" — fonte unica de verdade.
const tinoHome = await resolveHomePath() || '$TINO_HOME';
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
```

**Mudança quebra contrato dos 5 testes da Onda 1?** Não — os testes da Onda 1 testam `computePatch` checando `permissions.allow/deny`, não `hooks`. Os 5 testes continuam green. Mas a Onda 2 adiciona 2 testes novos cobrindo o bloco `hooks`.

`resolveHomePath()` é função nova em `lib/tino-home.mjs` que lê `~/.tino/config.sh` extraindo `TINO_HOME=...`. Cached por sessão.

---

## 8. Wave decomposition (4 waves)

| # | Story | Pts | Deps | Entrega |
|---|-------|-----|------|---------|
| W1 | Libs core (analyzer + history + visual + context) | 5 | — | 4 lib modules em `hooks/lib/` + ~20 testes |
| W2 | Hook anti-preguiçoso end-to-end | 5 | W1 | `hooks/anti-preguicoso.mjs` entry + integration test (stdin mock) |
| W3 | Hook anti-burro end-to-end | 5 | W2 | `hooks/anti-burro.mjs` entry + integration test |
| W4 | settings-patch update + tino-home helper + doc humana + README + smoke | 3 | W3 | UPDATE `lib/settings-patch.mjs` + NEW `lib/tino-home.mjs` + 2 testes + `docs/hooks-vibecoder.md` + README |

Total: 18 pontos. Menor que Onda 1 (26) — escopo focado.

---

## 9. Test strategy

### Por wave

- **W1:** Heurísticas puras = 100% cobertura unitária. ~20 testes.
- **W2/W3:** Integration tests rodando entry script via `node` com stdin mock — verifica exit code + stderr/stdout output.
- **W4:** 2 testes pra settings-patch novo bloco + smoke manual com 3 prompts (1 OK, 1 lazy, 1 burro).

### Final gate

- `npm test` → **117 + 25 = ~142 PASS, 0 FAIL**
- Suite total < 12s
- Smoke manual (opcional): instalar hooks + mandar prompts + ver output visual

### Performance gate

- `time node hooks/anti-preguicoso.mjs < /tmp/prompt-input.json` deve retornar em **< 500ms**
- Idem `anti-burro.mjs`

---

## 10. Deliverables checklist

- [ ] 2 hooks `.mjs` em `hooks/` + 4 lib modules em `hooks/lib/`
- [ ] `lib/settings-patch.mjs` atualizado pra preencher bloco hooks real
- [ ] `lib/tino-home.mjs` (helper resolve TINO_HOME)
- [ ] `docs/hooks-vibecoder.md` (uso + debug + como desativar)
- [ ] Todos os testes passam (~142 total)
- [ ] Suite total < 12s
- [ ] Performance gate: cada hook < 500ms wall-clock
- [ ] README atualizado com seção "Hooks runtime"
- [ ] Smoke test manual passou (opcional mas recomendado — flagrar isso afeta SUA sessão)

---

## 11. Riscos e questões abertas

### Risco 1: Hooks afetam SUA sessão atual

Após `/tino:vibe-install` rodar com a Onda 2 disponível, os hooks ficam ativos no `~/.claude/settings.json` global — significa que TODA sessão Claude Code (incluindo a que está rodando o build) vai ter os hooks no critical path.

**Mitigação tripla:**
- Default da Onda 1 deixa `_tino_hooks_placeholder` apenas (não ativa hooks reais sozinha) — usuário precisa rodar `/tino:vibe-install` consciente
- Comando `/tino:vibe-hooks-off` (opcional, não obrigatório nesta Onda) pra desligar rápido — pode ficar pra Onda 3 ou nunca
- Doc humana `docs/hooks-vibecoder.md` ensina remover via Edit do settings.json (com backup automático preservado pelo Onda 1 install)

### Risco 2: Falsos positivos chatos

Anti-preguiçoso pode flagrar prompts curtos legítimos ("ok", "sim, prossiga", "/tino:refresh"). Mitigação:
- Detecta `^/` (comando claude) → exit 0 silent
- Whitelist `^(ok|sim|nao|prossiga|continue|skip|cancela|abort|stop)$`
- Default sugerido na Onda 1 é `ativa` (não `agressiva`) — só sugere, não bloca

### Risco 3: Latência

`node` cold start ~40-100ms. Carregar 4 libs + parse YAML + leitura jsonl pode somar mais 100-200ms. Total esperado: 200-400ms. **Hard limit 500ms.** Se passar, refator pra: (a) cache compilado de heurísticas, (b) jsonl tail mais eficiente.

### Risco 4: jsonl pode crescer infinitamente em sessão longa

Mitigação: rotate probabilístico (5% chance por append) trunca pras últimas 1000 entries.

### Questão aberta 1: Hook bloca = exit 2

Confirmar contrato do Claude Code: exit 2 + stderr realmente bloqueia? Documentação varia. Spike no início da implementação se houver dúvida.

### Questão aberta 2: Como desativar facilmente

Decisão: doc humana ensina; comando dedicado fica pra futuro se demanda surgir.

---

## 12. Próximo passo

Após aprovação deste spec, transição pra `writing-plans` que vai produzir plano executável (~13-15 tasks em 4 waves). Execução via `epic-executor` no padrão validado nas Ondas 0 e 1.
