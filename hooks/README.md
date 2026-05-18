# CodeSee Hooks

让 AI IDE 在每轮对话结束时自动跑一次"功能图过期检查"，避免长任务后忘记同步 `features.json`。

跑 `install` 脚本后，下面这些文件会被拷到目标项目的 `.codesee/hooks/`，由你按平台**手动启用**——install 脚本不会主动写入 `.claude/`、`.kiro/hooks/` 这种用户运行时配置目录，避免破坏你已有的 IDE 配置。

```
.codesee/
  hooks/
    claude-code/settings.json    # Claude Code 的 hook 配置示例
    kiro/sync-on-stop.json       # Kiro 的 hook 文件
    README.md                    # 本文档
  scripts/
    check-staleness.mjs          # 共用检查脚本（hook 触发的就是这个）
```

## 设计原则

- **共享一个脚本**：`check-staleness.mjs` 是 zero-deps Node 单文件，三档 IDE 都跑同一个。
- **永不阻塞 agent**：脚本一律退出 0，只通过 stdout 打印提醒，agent 在下次消息读到自然生效。
- **每轮一次**：选 Stop / agentStop 这种"对话回合结束"事件，不挂 PostToolUse——一次任务可能写数十个文件，挂在 PostToolUse 会反复触发噪音大。
- **不动你的代码**：脚本只读 `git log` 和 `.codesee/features.json`，不写任何文件。

## 检查逻辑

1. 读 `.codesee/features.json` 拿 `manifest.updated_at`
2. 跑 `git log --since=<updated_at>` 列出之后修改的代码文件
3. 0 文件 → 静默退出
4. N 文件 → 打印提醒 + 推荐的 sync 命令
5. 不在 git 仓库或 features.json 不存在 → 静默退出（避免误报）

只关心代码扩展名（ts / py / go / rs / java...）；md / json / css 这种不算"语义变化"。

## 启用方式

> 一键自动写入：`./scripts/install.ps1 <目标项目> -AutoDetect`（或 `--auto-detect` for sh）。
> 检测到 `.claude/` 或 `.kiro/` 就自动接好对应平台的 hook，不动用户已有 entry。
> 手动启用读下面对应章节即可。

### 自动启用（推荐）

```pwsh
# Windows
.\scripts\install.ps1 D:\my-project -AutoDetect

# 显式选平台
.\scripts\install.ps1 D:\my-project -EnableClaudeCode -EnableKiro

# 用户手动改过我们的 entry 想强制刷新
.\scripts\install.ps1 D:\my-project -AutoDetect -ForceHooks

# 卸载（templates 与 validator 保留）
.\scripts\install.ps1 D:\my-project -UninstallHooks
```

```bash
# macOS / Linux
./scripts/install.sh ~/my-project --auto-detect
./scripts/install.sh ~/my-project --enable-claude-code --enable-kiro
./scripts/install.sh ~/my-project --auto-detect --force-hooks
./scripts/install.sh ~/my-project --uninstall-hooks
```

**幂等性保证**：

- 每次写入 Claude Code 的 entry 都带 `_codesee` 标记字段（CC 忽略，但我们用来识别）
- 重跑 install 不会重复 append——找到带标记的 entry 就替换，没找到才追加
- 用户手动改了我们的 entry → 默认跳过（保留用户改动）；`-ForceHooks` 才覆盖
- Uninstall 只删带标记的 entry 与 `.kiro/hooks/codesee-*.json`，用户其他 hook 一字不动

**安全边界**：

- 用户的 `.claude/settings.json` 是非法 JSON → merge 脚本退出 2，文件不被改
- Kiro hook 文件名前缀 `codesee-`，绝不与用户文件撞名

### 手动启用（备用）

### Claude Code

把 `claude-code/settings.json` 的 `hooks.Stop` 段合并到你项目的 `.claude/settings.json`（如果还没这文件，直接拷过去也行）。

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "node .codesee/scripts/check-staleness.mjs" }
        ]
      }
    ]
  }
}
```

启用后，每次 agent 回合结束 Claude Code 会跑一次脚本，输出会以 system message 形式注入下一回合，agent 自动看到提醒并按 sync.md 流程更新。

### Kiro

直接把 `kiro/sync-on-stop.json` 拷到 `.kiro/hooks/sync-on-stop.json` 即可。Kiro 会自动加载新 hook，不用重启。

事件类型 `agentStop` = Claude Code 的 Stop。

### Cursor / Codex（无原生 hook）

这两档没有事件级 hook 机制，但都吃 AGENTS.md / `.cursorrules`。`install` 脚本已经把"每轮结束跑 check-staleness"这条规则写进了 AGENTS-snippet 的 Checkpoint 协议里——AI 会按 prompt 自觉调用，效果同等只是少了强制性。

### Git hook（可选，平台无关）

如果你想在 commit 时也提醒一次，加个 `.git/hooks/post-commit`：

```sh
#!/bin/sh
node .codesee/scripts/check-staleness.mjs
```

记得 `chmod +x .git/hooks/post-commit`。

## 手动测试

```bash
node .codesee/scripts/check-staleness.mjs --verbose
```

`--verbose` 会把跳过原因（不在 git 仓库 / features.json 不存在 / 无变更）打到 stderr 方便排查。

## 关掉

删掉对应的 `.claude/settings.json` 中的 hook 段，或删掉 `.kiro/hooks/sync-on-stop.json` 即可。脚本本身保留无副作用。
