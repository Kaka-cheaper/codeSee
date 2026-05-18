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
