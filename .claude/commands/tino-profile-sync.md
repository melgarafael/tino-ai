---
description: Regenera _perfil.md a partir do vault preservando contadores e resetando o counter de refresh. Cria backup do antigo.
---

# /tino:profile-sync — Ressincronizar o perfil

Voce vai regenerar o `_perfil.md` do usuario a partir do vault atual, preservando historico de uso (processadas, favoritadas, thumbs) e criando backup do antigo. Use este comando quando o perfil ficou desatualizado (novos interesses, mudanca de foco, feedback acumulado).

## Passo 1 — Caminho do vault

Argumento posicional ou pergunte: `Qual o caminho absoluto do seu vault Obsidian?`. Fallback demo: `tino-vault-sample/perfil-raw`.

## Passo 2 — Avisar sobre backup

Diga ao usuario: `Eu vou regenerar o _perfil.md re-escaneando seu vault e criar um backup do atual em _perfil.backup-<timestamp>.md. Seus contadores (processadas, favoritadas, thumbs) serao preservados. Counter de refresh sera resetado para 0. OK?`.

Espere confirmacao antes de prosseguir.

## Passo 3 — Rodar dry-run primeiro

Execute via Bash:

```bash
tino profile-sync --vault "$VAULT" --mock --dry-run
```

Isso imprime o diff (chips adicionados/removidos em identidade, foco_ativo, evita) sem escrever.

Mostre o diff ao usuario e pergunte: `Aplicar este diff?`.

## Passo 4 — Aplicar

Se o usuario confirmou:

```bash
tino profile-sync --vault "$VAULT" --mock
```

Interprete o summary JSON:
- `backup`: caminho do backup criado
- `counter_reset: true`: counter voltou a 0
- `diff`: chips efetivamente alterados
- `preserved`: contadores mantidos do perfil antigo

## Passo 5 — Fechar

Confirme: `Perfil ressincronizado. Backup em {backup_path}. Counter de refresh zerado. Abra {vault}/Tino/_perfil.md pra revisar.`

## Observacoes

- Em modo real (sem `--mock`): wave atual so suporta mock. O agente `profile-extractor` via `/tino:setup --force` pode ser usado como alternativa LLM.
- Nunca escreve fora de `{vault}/Tino/`.
