#!/usr/bin/env bash
# install.sh — Instala o Tino globalmente no Claude Code do usuário
#
# O que faz:
#   1. Resolve TINO_HOME (este diretório) e salva em ~/.tino/config.sh
#   2. Symlinka .claude/commands/tino-*.md    → ~/.claude/commands/
#   3. Symlinka .claude/agents/profile-extractor.md, ranker.md, deep-diver.md → ~/.claude/agents/
#   4. Symlinka bin/tino → ~/.local/bin/tino (entra no PATH)
#   5. Instala deps do Node (npm install) se node_modules não existir
#
# Reversível via uninstall.sh.

set -euo pipefail

TINO_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
BIN_DIR="$HOME/.local/bin"
CFG_DIR="$HOME/.tino"

echo "=== Tino global install ==="
echo "TINO_HOME: $TINO_HOME"
echo ""

# 1. npm install (se precisar)
if [ ! -d "$TINO_HOME/node_modules" ]; then
  echo "→ npm install (primeira vez)..."
  (cd "$TINO_HOME" && npm install --silent)
else
  echo "→ node_modules já existe · skip"
fi

# 2. Config file
mkdir -p "$CFG_DIR"
cat > "$CFG_DIR/config.sh" <<EOF
# gerado por install.sh em $(date -u +"%Y-%m-%dT%H:%M:%SZ")
export TINO_HOME="$TINO_HOME"
EOF
echo "→ escrito $CFG_DIR/config.sh"

# 3. Symlinks de commands
mkdir -p "$CLAUDE_DIR/commands"
count_cmd=0
for f in "$TINO_HOME"/.claude/commands/tino-*.md; do
  [ -e "$f" ] || continue
  target="$CLAUDE_DIR/commands/$(basename "$f")"
  ln -sf "$f" "$target"
  count_cmd=$((count_cmd + 1))
done
echo "→ $count_cmd slash commands linkados em ~/.claude/commands/"

# 4. Symlinks de agents (profile-extractor, ranker, deep-diver)
mkdir -p "$CLAUDE_DIR/agents"
count_agent=0
for f in "$TINO_HOME"/.claude/agents/*.md; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  # só os agents do Tino (não symlinkar outros que caiam na pasta)
  case "$base" in
    profile-extractor.md|ranker.md|deep-diver.md)
      ln -sf "$f" "$CLAUDE_DIR/agents/$base"
      count_agent=$((count_agent + 1))
      ;;
  esac
done
echo "→ $count_agent agents linkados em ~/.claude/agents/"

# 5. bin/tino → ~/.local/bin/tino
chmod +x "$TINO_HOME/bin/tino"
mkdir -p "$BIN_DIR"
ln -sf "$TINO_HOME/bin/tino" "$BIN_DIR/tino"
echo "→ tino linkado em $BIN_DIR/tino"

# 6. Aviso PATH
echo ""
case ":$PATH:" in
  *":$BIN_DIR:"*)
    echo "✓ $BIN_DIR já está no PATH"
    ;;
  *)
    echo "⚠ $BIN_DIR não está no PATH. Adicione ao seu shell rc:"
    echo ""
    echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    ;;
esac

echo ""
echo "=== Instalado ✓ ==="
echo ""
echo "Disponível no Claude Code (de qualquer projeto):"
echo "  /tino:setup <vault>          · primeira vez"
echo "  /tino:refresh                · coleta + rankeia + escreve"
echo "  /tino:profile-sync           · regenera perfil"
echo "  /tino:deep-dive <id>         · enriquece favoritado"
echo ""
echo "CLI direto do terminal:"
echo "  tino setup --vault ~/Obsidian/MeuVault"
echo "  tino refresh --vault ~/Obsidian/MeuVault --mock --force"
echo "  tino dashboard:open --vault ~/Obsidian/MeuVault"
echo ""
echo "Desinstalar: bash $TINO_HOME/uninstall.sh"
