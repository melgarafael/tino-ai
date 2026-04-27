---
description: Gera Tino/_recomendacao.md combinando curated-stack + aitmpl conforme perfil
argument-hint: <vault-path>
---

Você gera a recomendação de stack pro user vibecoder.

## Argumentos
- `$1` — vault-path (obrigatório)

## Sequência

1. **Pré-requisito:** verifique que `$1/Tino/_perfil-vibecoder.md` existe. Se não, retorne:
   ```
   ✗ Perfil ausente. Rode `/tino:vibe-setup $1` primeiro.
   [VIBECODER-RESULT] error reason=perfil_ausente
   ```

2. **Invoque o agent `vibecoder-recommender`:**
   ```
   [Use o Task tool com subagent_type=vibecoder-recommender]
   Gere recomendação pro vault em $1.
   ```

3. **Verifique resultado:** confirme que `$1/Tino/_recomendacao.md` foi escrito. Se não, sinalize erro.

4. **Output final** (literal):
   ```
   [VIBECODER-RESULT] ok recomendacao_path={vault}/Tino/_recomendacao.md count={N}
   ```
   (`{N}` extraído do arquivo via `cat ... | grep total`.)
