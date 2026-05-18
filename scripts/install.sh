#!/usr/bin/env bash
# Install CodeSee integration files into a target project.
#
# Usage:
#   ./scripts/install.sh <target-project> [--force]
#                                          [--enable-claude-code]
#                                          [--enable-kiro]
#                                          [--auto-detect]
#                                          [--force-hooks]
#                                          [--uninstall-hooks]

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-project> [--force] [--enable-claude-code] [--enable-kiro] [--auto-detect] [--force-hooks] [--uninstall-hooks]" >&2
  exit 1
fi

TARGET="$1"
shift || true

FORCE=""
ENABLE_CC=""
ENABLE_KIRO=""
AUTO_DETECT=""
FORCE_HOOKS=""
UNINSTALL_HOOKS=""
for arg in "$@"; do
  case "$arg" in
    --force)              FORCE="--force" ;;
    --enable-claude-code) ENABLE_CC=1 ;;
    --enable-kiro)        ENABLE_KIRO=1 ;;
    --auto-detect)        AUTO_DETECT=1 ;;
    --force-hooks)        FORCE_HOOKS=1 ;;
    --uninstall-hooks)    UNINSTALL_HOOKS=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

SELF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATES="$SELF_DIR/templates"
PROMPTS="$SELF_DIR/prompts"
BEGIN_MARKER='<!-- BEGIN: CodeSee integration -->'
END_MARKER='<!-- END: CodeSee integration -->'

if [[ ! -d "$TARGET" ]]; then
  echo "Target directory not found: $TARGET" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ "$TARGET" == "$SELF_DIR" ]]; then
  echo 'Cannot install CodeSee onto itself. Point to a different project.' >&2
  exit 1
fi

echo "==> Installing CodeSee into: $TARGET"

# 1. AGENTS.md
agents_dst="$TARGET/AGENTS.md"
snippet_src="$TEMPLATES/AGENTS-snippet.md"

if [[ -f "$agents_dst" ]]; then
  if grep -qF -- "$BEGIN_MARKER" "$agents_dst"; then
    if [[ "$FORCE" == "--force" ]]; then
      # Replace existing CodeSee block
      python3 - "$agents_dst" "$snippet_src" <<'PY'
import sys, pathlib
target = pathlib.Path(sys.argv[1])
snippet = pathlib.Path(sys.argv[2]).read_text(encoding='utf-8').rstrip() + '\n'
text = target.read_text(encoding='utf-8')
b = '<!-- BEGIN: CodeSee integration -->'
e = '<!-- END: CodeSee integration -->'
si = text.find(b); ei = text.find(e)
if si >= 0 and ei > si:
    text = text[:si] + snippet + text[ei + len(e):]
    target.write_text(text, encoding='utf-8')
PY
      echo "  - AGENTS.md: replaced existing CodeSee section"
    else
      echo "  - AGENTS.md: CodeSee section already present, skipped (use --force to refresh)"
    fi
  else
    # Append snippet
    [[ -n "$(tail -c 1 "$agents_dst")" ]] && printf '\n' >> "$agents_dst"
    printf '\n' >> "$agents_dst"
    cat "$snippet_src" >> "$agents_dst"
    echo "  - AGENTS.md: appended CodeSee section to existing file"
  fi
else
  cp -f "$TEMPLATES/AGENTS.md" "$agents_dst"
  echo "  - wrote AGENTS.md (new)"
fi

# 2. .codesee/prompts/*
mkdir -p "$TARGET/.codesee/prompts"
for name in scan.md scan-light.md scan-heavy.md scan-planning.md scan-sdd.md sync.md _schema.md _rules.md; do
  cp -f "$PROMPTS/$name" "$TARGET/.codesee/prompts/$name"
  echo "  - wrote .codesee/prompts/$name"
done

# 3. .codesee/scripts/* (validator + staleness checker)
mkdir -p "$TARGET/.codesee/scripts"
cp -f "$SELF_DIR/scripts/validate-features.mjs" "$TARGET/.codesee/scripts/validate-features.mjs"
echo "  - wrote .codesee/scripts/validate-features.mjs"

if [[ -f "$SELF_DIR/hooks/scripts/check-staleness.mjs" ]]; then
  cp -f "$SELF_DIR/hooks/scripts/check-staleness.mjs" "$TARGET/.codesee/scripts/check-staleness.mjs"
  echo "  - wrote .codesee/scripts/check-staleness.mjs"
fi

# 3a. .codesee/hooks/* (templates only; users enable manually)
if [[ -d "$SELF_DIR/hooks" ]]; then
  mkdir -p "$TARGET/.codesee/hooks"
  for subdir in claude-code kiro; do
    if [[ -d "$SELF_DIR/hooks/$subdir" ]]; then
      mkdir -p "$TARGET/.codesee/hooks/$subdir"
      cp -rf "$SELF_DIR/hooks/$subdir/." "$TARGET/.codesee/hooks/$subdir/"
      echo "  - wrote .codesee/hooks/$subdir/*"
    fi
  done
  if [[ -f "$SELF_DIR/hooks/README.md" ]]; then
    cp -f "$SELF_DIR/hooks/README.md" "$TARGET/.codesee/hooks/README.md"
    echo "  - wrote .codesee/hooks/README.md"
  fi
fi

# 3b. SDD framework detection
sdd_detected=()
for probe in '.specify:spec-kit (GitHub)' \
             '.trellis:Trellis (Mindfold)' \
             '.bmad-core:BMAD-METHOD' \
             'bmad:BMAD-METHOD' \
             '.agents/skills:Agent Skills (agentskills.io)' \
             '.agent-os:Agent OS (Builder Methods)'; do
  path="${probe%%:*}"
  name="${probe#*:}"
  if [[ -d "$TARGET/$path" ]]; then
    sdd_detected+=("$name")
  fi
done

# 3c. Install SKILL.md (cross-platform skill entry)
skill_src="$TEMPLATES/SKILL.md"
if [[ -f "$skill_src" ]]; then
  skill_dir="$TARGET/.agents/skills/codesee"
  skill_dst="$skill_dir/SKILL.md"
  if [[ -f "$skill_dst" && "$FORCE" != "--force" ]]; then
    echo "  - .agents/skills/codesee/SKILL.md already present, skipped (use --force to refresh)"
  else
    mkdir -p "$skill_dir"
    cp -f "$skill_src" "$skill_dst"
    echo "  - wrote .agents/skills/codesee/SKILL.md (cross-platform skill entry)"
  fi
fi

# 4. .codesee/.gitignore
gitignore="$TARGET/.codesee/.gitignore"
if [[ ! -f "$gitignore" ]]; then
  cat > "$gitignore" <<'EOF'
# CodeSee keeps features.json under version control (it is the core data).
# Only transient caches are ignored here.
cache/
*.tmp
EOF
  echo "  - wrote .codesee/.gitignore"
fi

# 5. Phase 2 - optional auto-wiring of platform hooks
want_cc=""
want_kiro=""
if [[ -n "$AUTO_DETECT" ]]; then
  [[ -d "$TARGET/.claude" ]] && want_cc=1
  [[ -d "$TARGET/.kiro"   ]] && want_kiro=1
fi
[[ -n "$ENABLE_CC"   ]] && want_cc=1
[[ -n "$ENABLE_KIRO" ]] && want_kiro=1

merge_script="$SELF_DIR/scripts/merge-claude-settings.mjs"
cc_template="$SELF_DIR/hooks/claude-code/settings.json"

if [[ -n "$UNINSTALL_HOOKS" ]]; then
  echo ''
  echo '==> Uninstalling CodeSee hooks (templates and validator stay).'
  if [[ -f "$merge_script" ]]; then
    node "$merge_script" --target "$TARGET" --template "$cc_template" --remove || true
  fi
  if [[ -d "$TARGET/.kiro/hooks" ]]; then
    for f in "$TARGET/.kiro/hooks"/codesee-*.json; do
      [[ -f "$f" ]] || continue
      rm -f "$f"
      echo "  - removed $f"
    done
  fi
elif [[ -n "$want_cc" || -n "$want_kiro" ]]; then
  echo ''
  echo '==> Wiring platform hooks.'
  if [[ -n "$want_cc" ]]; then
    if [[ ! -f "$merge_script" ]]; then
      echo '  - merge-claude-settings.mjs not found, skipping Claude Code wiring'
    else
      merge_args=(--target "$TARGET" --template "$cc_template")
      [[ -n "$FORCE_HOOKS" ]] && merge_args+=(--force)
      node "$merge_script" "${merge_args[@]}"
    fi
  fi
  if [[ -n "$want_kiro" ]]; then
    mkdir -p "$TARGET/.kiro/hooks"
    if [[ -f "$SELF_DIR/hooks/kiro/sync-on-stop.json" ]]; then
      cp -f "$SELF_DIR/hooks/kiro/sync-on-stop.json" "$TARGET/.kiro/hooks/codesee-sync-on-stop.json"
      echo "  - wrote $TARGET/.kiro/hooks/codesee-sync-on-stop.json"
    fi
  fi
fi

cat <<EOF

Done.
EOF

if [[ ${#sdd_detected[@]} -gt 0 ]]; then
  echo ''
  echo "SDD frameworks detected: $(IFS=', '; echo "${sdd_detected[*]}")"
  echo '  AI will use SDD mode (consume spec/PRD docs, no source code) for higher accuracy.'
fi

cat <<EOF

Next steps:
  1. Open the target project in your AI IDE; ask it to read AGENTS.md.
  2. Let the AI run the scan (first time) or sync (after each change).
  3. (Optional) Auto-wire hooks: rerun with --auto-detect (or
     --enable-claude-code / --enable-kiro). Manual setup: .codesee/hooks/README.md.
  4. View the graph in your browser: https://Kaka-cheaper.github.io/codeSee/
     -> click "+ Add project" and select this directory.

Run viewer locally (contributors):  cd "$SELF_DIR/viewer" && npm run dev
EOF
