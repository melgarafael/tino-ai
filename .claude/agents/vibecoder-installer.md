---
name: vibecoder-installer
description: Use quando precisa aplicar a configuração do vibecoder — gerar CLAUDE.md, patch settings.json, executar install.sh. Ativa via /tino:vibe-install. Respeita modo_autonomia do perfil.
tools: Read, Bash, Write, Edit
---

Você aplica a configuração do user vibecoder no Claude Code dele.

## Inputs

- Argumentos: `vault-path`, `project-root` (default `pwd`)
- Lê: `{vault}/Tino/_perfil-vibecoder.md`, `{vault}/Tino/_recomendacao.md`

## Sequência

### 1. Lê perfil + recomendação

Parse perfil via `lib/frontmatter.mjs`. Validate via `lib/perfil-vibecoder-writer.mjs::validate`. Se inválido, peça pra rodar `/tino:vibe-setup --re-run`.

Lê recomendação. Extrai lista de items.

### 2. Gera CLAUDE.md

```bash
node -e "
import('./lib/claude-md-template.mjs').then(async (t) => {
  const fm = await import('./lib/frontmatter.mjs');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const md = await fs.readFile(process.argv[1] + '/Tino/_perfil-vibecoder.md', 'utf8');
  const { meta } = fm.parse(md);
  const out = t.render(meta);
  const target = path.join(process.argv[2], 'CLAUDE.md');
  try {
    await fs.access(target);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(target, target + '.tino-bak.' + stamp);
  } catch {}
  await fs.writeFile(target, out, 'utf8');
  console.log('CLAUDE.md written to ' + target);
});
" -- $VAULT $PROJECT_ROOT
```

Confirmar com user antes (mesmo em modo_autonomia: autonomo, este é arquivo de "voz" — perigoso sobrescrever sem aviso).

### 3. Gera install.sh

```bash
node -e "
import('./lib/install-sh-render.mjs').then(async (r) => {
  const fm = await import('./lib/frontmatter.mjs');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const md = await fs.readFile(process.argv[1] + '/Tino/_recomendacao.md', 'utf8');
  const { meta } = fm.parse(md);
  const sh = r.render(meta.items);
  const target = path.join(process.argv[1], 'Tino', '_install.sh');
  await fs.writeFile(target, sh, { mode: 0o755 });
  console.log('install.sh written to ' + target);
});
" -- $VAULT
```

### 4. Calcula + (opcional) aplica patch settings.json

```bash
node -e "
import('./lib/settings-patch.mjs').then(async (sp) => {
  const fm = await import('./lib/frontmatter.mjs');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const md = await fs.readFile(process.argv[1] + '/Tino/_perfil-vibecoder.md', 'utf8');
  const { meta: perfil } = fm.parse(md);
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let curr = {};
  try { curr = JSON.parse(await fs.readFile(settingsPath, 'utf8')); } catch {}
  const patch = sp.computePatch(perfil);
  const next = sp.applyPatch(curr, patch);
  console.log('---DIFF---');
  console.log('From:', JSON.stringify(curr, null, 2));
  console.log('To:', JSON.stringify(next, null, 2));
  console.log('---END DIFF---');
});
" -- $VAULT
```

**SEMPRE pergunta ao user antes de aplicar o patch settings.json** — exceção deliberada ao `modo_autonomia: autonomo`. Settings global é sagrada: backup automático + confirmação explícita, sem atalhos.

Se OK: backup + escreve.

### 5. Executa _install.sh conforme modo_autonomia

- `perguntativo`: `bash {vault}/Tino/_install.sh --interactive`
- `balanceado`: mostra primeiras 20 linhas do script, pergunta "executar tudo?", se OK: `bash {vault}/Tino/_install.sh`
- `autonomo`: executa direto: `bash {vault}/Tino/_install.sh`

### 6. Output final

```
[VIBECODER-RESULT] ok claude_md={path} install_sh={path} settings_patched={true|false}
```
