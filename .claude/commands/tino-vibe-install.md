---
description: Aplica configuração — CLAUDE.md, settings.json, install.sh — conforme perfil vibecoder
argument-hint: <vault-path> [--project-root <dir>]
---

Você aplica a configuração final do vibecoder no Claude Code do user.

## Argumentos

- `$1` — vault-path (obrigatório)
- `--project-root <dir>` — opcional, default `pwd`. Onde escrever CLAUDE.md.

## Sequência

1. **Pré-requisitos:**
   - `$1/Tino/_perfil-vibecoder.md` deve existir. Se não → "Rode `/tino:vibe-setup $1` primeiro."
   - `$1/Tino/_recomendacao.md` deve existir. Se não → "Rode `/tino:vibe-stack $1` primeiro."

2. **Project-root:** parse `--project-root`. Default `pwd`.

3. **Invoque o agent `vibecoder-installer`:**
   ```
   [Use o Task tool com subagent_type=vibecoder-installer]
   Aplica a config do vibecoder. Vault: $1. Project-root: $PROJECT_ROOT.
   ```

4. **Output final:**
   ```
   [VIBECODER-RESULT] ok claude_md={path} install_sh={path} settings_patched={bool}
   ```
