#!/usr/bin/env bash
# uninstall.sh — Remove symlinks globais do Tino. Não mexe no repo nem em vaults.
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
BIN_DIR="$HOME/.local/bin"
CFG_DIR="$HOME/.tino"

echo "=== Tino uninstall ==="

removed=0
for f in "$CLAUDE_DIR/commands/"tino-*.md; do
  [ -L "$f" ] || continue
  rm -f "$f"; removed=$((removed + 1))
done
echo "→ $removed commands removidos"

for agent in profile-extractor.md ranker.md deep-diver.md; do
  target="$CLAUDE_DIR/agents/$agent"
  [ -L "$target" ] && rm -f "$target" && echo "→ agent $agent removido" || true
done

[ -L "$BIN_DIR/tino" ] && rm -f "$BIN_DIR/tino" && echo "→ tino binary removido"
[ -f "$CFG_DIR/config.sh" ] && rm -f "$CFG_DIR/config.sh" && echo "→ $CFG_DIR/config.sh removido"
[ -d "$CFG_DIR" ] && rmdir "$CFG_DIR" 2>/dev/null || true

echo ""
echo "=== Desinstalado ✓ ==="
echo "Repo intacto em: $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
