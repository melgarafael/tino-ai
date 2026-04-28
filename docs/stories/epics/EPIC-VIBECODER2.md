# EPIC-VIBECODER2: Hooks runtime do Tino vibecoder (Onda 2)

Onda 2 de 3 da expansão do Tino — última peça do vision vibecoder. Esta onda entrega 2 hooks `UserPromptSubmit` (anti-preguiçoso + anti-burro) que detectam padrões típicos de erro do vibe coder júnior em runtime, com output visual ANSI + comportamento derivado de `perfil.intervencao_hooks` (silenciosa/ativa/agressiva).

**Decisão de arquitetura central:** heurística pura no hot path (sub-500ms wall-clock). Sem Claude API call em runtime. Latência baixa é critério de sucesso — hooks rodam em CADA prompt do user, não podem atrasar.

## Critérios de sucesso (do user vibecoder júnior)

1. **Não atrapalha em modo silencioso.** Default suave. User pode ligar gradualmente (silenciosa → ativa → agressiva).
2. **Output chamativo quando flagged.** Box ANSI + emoji + cor — fura a "cegueira de chat" do júnior.
3. **Anti-preguiçoso pega o prompt curto/vago real.** Whitelist evita falsos positivos em "ok"/"sim"/"continue"/comandos `/...`.
4. **Anti-burro pega o loop "tenta de novo" + repetição literal.** State persistido em `.tino-cache/prompt-history.jsonl`.
5. **Latência hot path < 500ms.** Cada hook roda em < 500ms wall-clock.

## Critérios de sucesso (projeto clonável)

- Zero regressão (117 testes Onda 1 continuam green).
- Suite total < 12s.
- Suite focada `npm run test:hooks` < 5s.
- 30 testes novos (heurística pura unitária + integration tests E2E).
- Atomic commits por wave com prefixo `(vibecoder-onda2)`.
- Performance gate: `time node hooks/<x>.mjs < input.json` < 500ms wall-clock.

---

## Fases e Stories

### Fase 1: Onda 2 — Hooks Runtime

| Story | Título | Pontos | Prio | Deps | FR |
|---|---|---|---|---|---|
| F1-S01 | Libs core (hook-context + visual-output + prompt-history + prompt-analyzer) | 5 | P0 | — | FR-VBC2-001, FR-VBC2-002 |
| F1-S02 | Hook anti-preguiçoso end-to-end (entry + integration test) | 5 | P0 | F1-S01 | FR-VBC2-003 |
| F1-S03 | Hook anti-burro end-to-end (entry + integration test) | 5 | P0 | F1-S02 | FR-VBC2-004 |
| F1-S04 | tino-home + settings-patch update + doc humana + README + verificação final | 3 | P0 | F1-S03 | FR-VBC2-005, FR-VBC2-006 |

Total: 18 pontos em 4 waves.

---

## Requisitos funcionais (FR)

- **FR-VBC2-001** — `hooks/lib/hook-context.mjs` expõe `parseStdinJson(raw)`, `loadPerfil(vaultPath)`, `readStdinAll()`. Reusa `lib/frontmatter.mjs` (Onda 0). 3 testes.

- **FR-VBC2-002** — `hooks/lib/prompt-analyzer.mjs::analyzeLazy(prompt)` + `analyzeStuck(prompt, history)`, funções puras retornando `{flagged, reasons, severity, repetitions?}`. Whitelist (`ok`, `sim`, `continue`, comandos `/...`, perguntas claras). 10 testes. `hooks/lib/visual-output.mjs::renderBox({title, lines, color, emoji, mode, width})` com fallback `NO_COLOR`. 3 testes. `hooks/lib/prompt-history.mjs::{append, readLastN, rotate}` jsonl. 4 testes.

- **FR-VBC2-003** — `hooks/anti-preguicoso.mjs` lê stdin → carrega perfil → `analyzeLazy` → renderiza box em stderr conforme `intervencao_hooks` (silenciosa = log; ativa = exit 0 + box; agressiva = exit 2 + box). Fail-open em qualquer erro (nunca bloqueia por bug do hook). 3 integration tests E2E rodando entry script via `spawn`.

- **FR-VBC2-004** — `hooks/anti-burro.mjs` similar mas usa `analyzeStuck` + `prompt-history.jsonl`. Append no histórico em toda invocação + rotate probabilístico (5%) em 1000 entries. 3 integration tests.

- **FR-VBC2-005** — `lib/tino-home.mjs::resolveHomePath(opts?)` lê `~/.tino/config.sh` extraindo `TINO_HOME`, retorna `null` se ausente. Cache 1 min por `homeDir`. 2 testes.

- **FR-VBC2-006** — `lib/settings-patch.mjs::computePatch(perfil, opts?)` ganha bloco `hooks` registrando os 2 entries (anti-preguicoso + anti-burro) com paths absolutos via `opts.tinoHome` (default `'$TINO_HOME'` literal pra fallback). Remove `_tino_hooks_placeholder` reservado pela Onda 1. **Backward-compat: os 5 testes da Onda 1 continuam green** (chamam `computePatch(perfil)` sem opts — funciona). 2 testes novos. Doc humana em `docs/hooks-vibecoder.md`. README atualizado.

---

## Arquitetura

- **Tipo de wave:** mistura heurística pura (libs) + integration end-to-end (hooks rodando via `spawn`). Gate é `npm test` + performance check (`time` de cada hook < 500ms).
- **Linguagem/stack:** Node.js 20+, ESM puro `.mjs`, `node:test`, `node:assert/strict`. ANSI escape codes nativos. Reusa `lib/frontmatter.mjs` da Onda 0.
- **Boundary:**
  - `hooks/lib/*` = funções puras testáveis em isolamento
  - `hooks/*.mjs` = entry scripts (CLI, lê stdin, escreve stderr, exit code) — fina camada sobre as libs
  - `lib/settings-patch.mjs` = único modificado fora de `hooks/`, mantém os 5 testes da Onda 1
- **Spec:** `docs/superpowers/specs/2026-04-28-tino-vibecoder-hooks-design.md`
- **Plano executável:** `docs/superpowers/plans/2026-04-28-tino-vibecoder-hooks.md`

### Contracts expostos

- **Hooks invocáveis:** `node $TINO_HOME/hooks/anti-{preguicoso,burro}.mjs` lê stdin JSON, retorna exit 0 (allow) ou 2 (block).
- **Module:** `lib/tino-home.mjs::resolveHomePath(opts?)` reusável por outras features que precisem de `TINO_HOME`.
- **Module update:** `lib/settings-patch.mjs::computePatch(perfil, opts?)` ganha capacidade de registrar hooks reais.
- **Filesystem:** `.tino-cache/prompt-history.jsonl` (state) + `.tino-cache/hook-log.jsonl` (telemetria) populados pelos hooks em runtime.

### Decisões fixadas (não reabrir sem revisar spec)

- **Heurística pura no hot path** — zero Claude API call no UserPromptSubmit. Latência > qualidade.
- **Behavior derives from perfil** — settings-patch SEMPRE registra os 2 hooks (independente de `intervencao_hooks`); o hook lê perfil e decide o que fazer (log/sugest/block). Fonte única de verdade.
- **Fail-open em erro** — qualquer exception interna do hook → `process.exit(0)` silencioso. Nunca bloqueia o user por bug do hook.
- **TINO_HOME via `~/.tino/config.sh`** — convenção do MVP, herdada.
- **Cache jsonl rotaciona em 1000 entries** — probabilístico (5% chance por append).
- **NO_COLOR/TERM=dumb** desabilita ANSI — terminais legacy ficam OK.

---

## Wave-by-wave testable criteria

### F1-S01 (Wave 1) — Libs core

1. `node --test tests/hook-context.test.mjs` → 3 PASS, 0 FAIL.
2. `node --test tests/visual-output.test.mjs` → 3 PASS, 0 FAIL.
3. `node --test tests/prompt-history.test.mjs` → 4 PASS, 0 FAIL.
4. `node --test tests/prompt-analyzer.test.mjs` → 10 PASS, 0 FAIL.
5. `npm test` → 117 (Onda 1) + 20 = **137 PASS, 0 FAIL**.
6. ≥ 4 commits novos com `(vibecoder-onda2)`.

### F1-S02 (Wave 2) — anti-preguiçoso

1. `node --test tests/anti-preguicoso.integration.test.mjs` → 3 PASS, 0 FAIL.
2. `npm test` → 137 + 3 = **140 PASS, 0 FAIL**.
3. `hooks/anti-preguicoso.mjs` é executável (`-rwxr-xr-x`) e tem shebang `#!/usr/bin/env node`.
4. ≥ 1 commit novo `(vibecoder-onda2)`.

### F1-S03 (Wave 3) — anti-burro

1. `node --test tests/anti-burro.integration.test.mjs` → 3 PASS, 0 FAIL.
2. `npm test` → 140 + 3 = **143 PASS, 0 FAIL**.
3. `hooks/anti-burro.mjs` é executável e tem shebang Node.
4. ≥ 1 commit novo `(vibecoder-onda2)`.

### F1-S04 (Wave 4) — tino-home + settings-patch + doc + verificação

1. `node --test tests/tino-home.test.mjs` → 2 PASS.
2. `node --test tests/settings-patch-hooks.test.mjs` → 2 PASS.
3. `node --test tests/settings-patch.test.mjs` → 5 PASS (Onda 1 não regrediu).
4. `npm test` → **147 PASS, 0 FAIL**.
5. `time npm run test:hooks` → 30 PASS em < 5s real.
6. Performance gate: `echo '{"prompt":"isso"}' | time node hooks/anti-preguicoso.mjs` retorna em **< 500ms** wall-clock.
7. Idem para `anti-burro.mjs`.
8. `docs/hooks-vibecoder.md` existe e documenta uso/debug/desativar.
9. `README.md` ganha seção "Hooks runtime (Onda 2)" referenciando `docs/hooks-vibecoder.md`.
10. ≥ 3 commits novos.
