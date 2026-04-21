---
description: Inicializa o Tino em um vault Obsidian — escaneia, sintetiza perfil e cria a pasta Tino/
---

# /tino:setup — Inicializacao do Tino

Voce vai conduzir o usuario pela configuracao inicial do Tino (curador local de IA) em um vault Obsidian. Execute os passos abaixo **nesta ordem**, sem pular.

## Passo 1 — Obter o caminho do vault

Se o usuario passou um caminho absoluto como argumento, use-o. Caso contrario, **pergunte**: `Qual o caminho absoluto do seu vault Obsidian?`.

Se o usuario nao souber ou quiser so testar, use o fallback de demo: `tino-vault-sample/perfil-raw` (caminho relativo ao repo Tino).

## Passo 2 — Rodar o scanner deterministico

Execute via Bash:

```bash
node scripts/setup.mjs --vault "$VAULT"
```

Isso vai:
- Validar que o vault existe e tem `.md`
- Listar os top 30 arquivos com maior score
- Criar `{vault}/Tino/` com `_config.md`, `novidades/`, `favoritos/`
- Escrever um `_perfil.md` **placeholder** (que voce vai substituir no passo 4)
- Imprimir um JSON summary no stdout

Mostre ao usuario a lista de arquivos retornada e o caminho do `_perfil.md` criado.

## Passo 3 — Confirmar com o usuario

Pergunte: `Confirma que esses sao os arquivos certos pra extrair seu perfil? (sim/nao, ou me diga quais tirar/adicionar)`. Se o usuario quiser ajustar, rode de novo com `--top N` ou converse sobre quais arquivos ler explicitamente.

## Passo 4 — Sintetizar o perfil

Invoque o subagent `profile-extractor` (definido em `.claude/agents/profile-extractor.md`). Ele vai:
1. Ler o prompt em `config/prompts/extract-profile.md`
2. Ler (com `Read`) cada arquivo listado no `_perfil.md` placeholder
3. Preencher as 3 secoes (Identidade, Foco ativo, Evita) respeitando a regra de conservadorismo (nao chutar)
4. Reescrever `{vault}/Tino/_perfil.md` com o frontmatter YAML + as 3 secoes

Se o `_perfil.md` ja existir com conteudo real (nao-placeholder), avise o usuario e pergunte se quer sobrescrever antes de chamar o agente.

## Passo 5 — Revisao humana

Abra (ou imprima) o `_perfil.md` gerado e diga: `Revise, ajuste manualmente se quiser. Proximo passo eh rodar /tino:fetch para popular novidades/.`

## Observacoes

- O Tino **nunca** escreve fora da pasta `{vault}/Tino/`. O vault do usuario sai intacto.
- Modo `--mock` do script eh pra tests internos; nao use em sessao real.
- Modo `--force` sobrescreve `_perfil.md` existente. Use com aviso explicito ao usuario.
