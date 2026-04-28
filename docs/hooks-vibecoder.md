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

```json
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
```

## Como debugar

Logs em `{vault}/.tino-cache/hook-log.jsonl`. Cada entry: `{ ts, hook, interv, prompt, cwd, vaultPath }`.

Pra rodar um hook isoladamente:

```bash
echo '{"prompt":"isso","cwd":"/tmp"}' | TINO_VAULT_PATH=/seu/vault node hooks/anti-preguicoso.mjs
echo $?
```

## Como desativar

Opcao 1: edite `Tino/_perfil-vibecoder.md` e mude `intervencao_hooks` pra `silenciosa`.

Opcao 2: remova o bloco `hooks` de `~/.claude/settings.json`. Backup automatico foi criado em `~/.claude/settings.json.tino-bak.<ISO>` quando o `/tino:vibe-install` rodou.

Opcao 3: variavel de ambiente — `unset TINO_VAULT_PATH` ou aponte pra um diretorio sem `Tino/_perfil-vibecoder.md`. Os hooks vao retornar exit 0 silent.

## Performance

Cada hook deve rodar em < 500ms (Node cold start ~100ms + load perfil + analyzer ~50ms + output render). Se sentir lentidao, cheque com:

```bash
time bash -c "echo '{\"prompt\":\"test\"}' | TINO_VAULT_PATH=/vault node hooks/anti-preguicoso.mjs"
```
