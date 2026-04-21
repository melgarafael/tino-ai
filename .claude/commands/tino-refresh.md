---
description: Roda um ciclo completo de refresh do Tino — coleta fontes, rankeia novidades e atualiza Tino/novidades/ no vault Obsidian do usuario.
---

# /tino:refresh — Ciclo de refresh do Tino

Voce vai rodar um ciclo completo de refresh do curador Tino em um vault Obsidian. Execute os passos abaixo **nesta ordem**.

## Passo 1 — Obter o caminho do vault

Se o usuario passou um caminho absoluto como argumento, use-o. Caso contrario, **pergunte**: `Qual o caminho absoluto do seu vault Obsidian?`.

Fallback de demo: `tino-vault-sample/perfil-raw` (relativo ao repo Tino).

## Passo 2 — Rodar o orquestrador

Execute via Bash:

```bash
node scripts/refresh.mjs --vault "$VAULT" --mock
```

Isso vai:
- Validar que `{vault}/Tino/_perfil.md` existe (se nao: orienta rodar `/tino:setup` primeiro)
- Mesclar `config/sources.default.yaml` com overrides em `{vault}/Tino/_config.md` (secao `## Fontes`)
- Coletar as fontes via `fetch-all` em `.tino-cache/raw/<YYYY-MM-DD>/`
- Rankear os items em `{vault}/Tino/novidades/` (preservando `favorito: true`)
- Incrementar o counter `refreshes_desde_ultimo_profile_sync` em `_config.md`
- Atualizar `processadas`/`favoritadas` no `_perfil.md`
- Imprimir um summary JSON no stdout

Em modo real (sem `--mock`): a wave atual so suporta `--mock`. Mantenha o flag.

## Passo 3 — Interpretar o summary

O summary JSON inclui:
- `novidades_criadas`: total rankeado
- `fetch.items_total`, `fetch.erros`: diagnostico de coleta
- `rank.foca`, `rank.considera`, `rank.acompanha`, `rank.ignore`: distribuicao de veredito
- `refreshes_desde_ultimo_profile_sync`: counter atual
- `sync_recommended` + `sync_warning`: se `true`, alerte o usuario sobre rodar `/tino:profile-sync`

Mostre ao usuario:
1. Quantas novidades foram ranqueadas e a distribuicao Foca/Considera/Acompanha/Ignore
2. Caminho da pasta `novidades/` pra ele abrir no Obsidian
3. Se houver erros no fetch, liste-os (id + reason)
4. Se `sync_recommended` for `true`, sugira explicitamente: `Ja foram N refreshes desde o ultimo profile-sync — considere rodar /tino:profile-sync pra recalibrar o _perfil.md.`

## Passo 4 — Encerrar

Pergunte: `Quer abrir a pasta novidades/ no Obsidian ou marcar algum como favorito? Se marcar favorito, depois voce pode rodar /tino:deep-dive <id> pra enriquecer.`

## Observacoes

- O Tino **nunca** escreve fora de `{vault}/Tino/`.
- Items ja marcados como `favorito: true` em refreshes anteriores sao preservados automaticamente.
- Para forcar re-coleta ignorando cache do dia: `--force`.
- Para testes offline: `--fixture-dir tests/fixtures/rss`.
