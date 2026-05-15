#!/usr/bin/env bash
# Install CodeSee integration files into a target project.
# Usage: ./scripts/install.sh <target-project> [--force]

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-project> [--force]" >&2
  exit 1
fi

TARGET="$1"
FORCE="${2:-}"

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
for name in scan.md scan-light.md scan-heavy.md sync.md; do
  cp -f "$PROMPTS/$name" "$TARGET/.codesee/prompts/$name"
  echo "  - wrote .codesee/prompts/$name"
done

# 3. .codesee/scripts/* (validator)
mkdir -p "$TARGET/.codesee/scripts"
cp -f "$SELF_DIR/scripts/validate-features.mjs" "$TARGET/.codesee/scripts/validate-features.mjs"
echo "  - wrote .codesee/scripts/validate-features.mjs"

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

cat <<EOF

Done.

Next steps:
  1. Open the target project in your AI IDE; ask it to read AGENTS.md.
  2. Let the AI run the scan (first time) or sync (after each change).
  3. In the CodeSee viewer, drop or open .codesee/features.json to render.

Viewer:  cd "$SELF_DIR/viewer" && npm run dev
EOF
