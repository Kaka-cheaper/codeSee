#!/usr/bin/env bash
# 把 CodeSee 集成文件安装到目标项目。
# 用法: ./scripts/install.sh <目标项目路径> [--force]

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: $0 <目标项目路径> [--force]" >&2
  exit 1
fi

TARGET="$1"
FORCE="${2:-}"

SELF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATES="$SELF_DIR/templates"
PROMPTS="$SELF_DIR/prompts"

if [[ ! -d "$TARGET" ]]; then
  echo "目标目录不存在: $TARGET" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ "$TARGET" == "$SELF_DIR" ]]; then
  echo "不能把 CodeSee 安装到自己。请指向另一个项目。" >&2
  exit 1
fi

echo "→ 安装 CodeSee 到: $TARGET"

# 1. AGENTS.md
if [[ -f "$TARGET/AGENTS.md" && "$FORCE" != "--force" ]]; then
  echo "  · AGENTS.md 已存在，跳过（加 --force 覆盖）"
else
  cp -f "$TEMPLATES/AGENTS.md" "$TARGET/AGENTS.md"
  echo "  · 写入 AGENTS.md"
fi

# 2. .codesee/prompts/*
mkdir -p "$TARGET/.codesee/prompts"
for name in scan.md scan-light.md scan-heavy.md sync.md; do
  cp -f "$PROMPTS/$name" "$TARGET/.codesee/prompts/$name"
  echo "  · 写入 .codesee/prompts/$name"
done

# 3. .codesee/.gitignore
if [[ ! -f "$TARGET/.codesee/.gitignore" ]]; then
  cat > "$TARGET/.codesee/.gitignore" <<'EOF'
# CodeSee 默认让 features.json 入库（核心数据，需要 review）
# 这里只忽略后续可能产生的临时/缓存文件。
cache/
*.tmp
EOF
  echo "  · 写入 .codesee/.gitignore"
fi

cat <<EOF

✓ 安装完成。

下一步：
  1. 在目标项目里打开 AI IDE，提示 AI 读 AGENTS.md
  2. 让它执行扫描（首次 → scan，之后每轮改动 → sync）
  3. 在 CodeSee viewer 里打开 .codesee/features.json 即可看到画布

viewer 启动: cd "$SELF_DIR/mvp-web" && npm run dev
EOF
