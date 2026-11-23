#!/usr/bin/env bash
# Symlink this repo's skills into the skills directory of Claude Code and/or codex.
# Symlink instead of copy: takes effect immediately after git pull.
#
#   ./scripts/install.sh              install all skills, to every detected agent
#   ./scripts/install.sh novel-characters
#   ./scripts/install.sh --claude     install to Claude Code only
#   ./scripts/install.sh --codex      install to codex only
#   ./scripts/install.sh --uninstall  remove the symlinks
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO/skills"

targets=()
wanted=()
uninstall=0

for arg in "$@"; do
  case "$arg" in
    --claude)    targets+=("$HOME/.claude/skills") ;;
    --codex)     targets+=("$HOME/.codex/skills") ;;
    --uninstall) uninstall=1 ;;
    -h|--help)   sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)          echo "Unknown option $arg" >&2; exit 1 ;;
    *)           wanted+=("$arg") ;;
  esac
done

# No target given: auto-detect, install to whichever agent is present
if [ ${#targets[@]} -eq 0 ]; then
  [ -d "$HOME/.claude" ] && targets+=("$HOME/.claude/skills")
  [ -d "$HOME/.codex" ] && targets+=("$HOME/.codex/skills")
fi
if [ ${#targets[@]} -eq 0 ]; then
  echo "Neither ~/.claude nor ~/.codex found; try --claude or --codex" >&2
  exit 1
fi

# No skill named: install all
if [ ${#wanted[@]} -eq 0 ]; then
  for d in "$SKILLS_DIR"/*/; do
    [ -f "$d/SKILL.md" ] && wanted+=("$(basename "$d")")
  done
fi

for target in "${targets[@]}"; do
  mkdir -p "$target"
  for name in "${wanted[@]}"; do
    src="$SKILLS_DIR/$name"
    dst="$target/$name"
    if [ ! -f "$src/SKILL.md" ]; then
      echo "✗ $name — not a skill (SKILL.md missing)" >&2
      exit 1
    fi
    if [ "$uninstall" -eq 1 ]; then
      if [ -L "$dst" ]; then rm "$dst"; echo "− $dst"; fi
      continue
    fi
    # Only overwrite symlinks; a real directory was placed by the user, leave it alone
    if [ -e "$dst" ] && [ ! -L "$dst" ]; then
      echo "✗ $dst already exists and is not a symlink, skipping" >&2
      continue
    fi
    ln -sfn "$src" "$dst"
    echo "✓ $dst → $src"
  done
done
