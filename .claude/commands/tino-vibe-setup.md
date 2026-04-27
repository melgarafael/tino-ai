---
description: Triagem inicial do vibecoder — faz perguntas e gera Tino/_perfil-vibecoder.md
argument-hint: <vault-path> [--re-run]
---

Você vai conduzir a triagem do user vibecoder júnior.

## Argumentos

- `$1` — vault-path (obrigatório). Caminho absoluto do vault Obsidian do user.
- `$2` — opcional. Se `--re-run`, sobrescreve perfil existente sem perguntar. Se omitido e perfil existe, mostra perfil atual + pergunta "atualizar?"

## Sequência

1. **Validar vault-path:** confirme que `$1` existe e é diretório. Se não, peça pro user fornecer.

2. **Detectar perfil existente:**
   - Cheque `$1/Tino/_perfil-vibecoder.md`.
   - Se existe E `$2 != --re-run`:
     - Mostre conteúdo atual em resumo (papel, plano, modo_autonomia)
     - Pergunte: "Atualizar?"
     - Se "não": pare aqui, mostre `[VIBECODER-RESULT] ok perfil_path={path} unchanged`
   - Se existe E `$2 == --re-run`: continue, sobrescreva (writer faz backup automático)

3. **Invoque o agent `vibecoder-interviewer`** passando o vault-path como contexto:

   ```
   [Use o Task tool com subagent_type=vibecoder-interviewer]
   Conduza a triagem do user vibecoder. Vault: $1
   ```

4. **Confirme resultado:** verifique que o agent escreveu o arquivo em `$1/Tino/_perfil-vibecoder.md`. Se não, sinalize erro.

5. **Output final:** `[VIBECODER-RESULT] ok perfil_path={vault}/Tino/_perfil-vibecoder.md` (linha literal pro wizard parsear).
