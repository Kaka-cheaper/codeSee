# CodeSee · 协作模式 Prompt（增量同步）

> 用途：你和 AI 在 IDE 里完成一轮改动后，让 AI **基于本次改动**更新 `features.json`。
> 用法：把整段拷给 AI；它会读 git diff + 现有 features.json，输出最小补丁后写回。

---

## 你的任务

我刚完成了一轮代码改动。请你：

1. 读项目根的 `.codesee/features.json`（现有功能图）
2. 读本次改动的 git diff（命令：`git diff HEAD~1`，如果不可用就读 `git status` + `git diff`）
3. 推断这一轮改动**新增 / 修改 / 删除**了哪些 feature 或 step
4. 输出**最小变更**，重写 features.json

## 必须遵守的约束

- **只动受影响的 feature**。其他 feature 一字不改，连 updated_at 都不要动。
- **永远不修改 `locked: true` 的 feature**。如果改动影响了它，在输出末尾用一句话提醒我"功能 X 被锁定但已受影响，建议手动复核"。
- **不要重命名既有 feature.id / step.id**。改名会破坏画布上的人工标注。如需改名，新建并标记旧的为 `deprecated` 标签。
- 新增的 feature 标 `provenance: 'ai'`，受影响但你只是更新内容的也保持原 provenance。
- 视情况调整 confidence；改动越涉及非显式约定（异步、事件、配置驱动），confidence 越低。

## 写步骤的"语义级"原则

step 必须是**动作语义**，不是代码层面的实现细节：

| 不要写                       | 要写                       |
| ---------------------------- | -------------------------- |
| `调用 bcrypt.compare`        | 比对密码                   |
| `执行 SQL select`            | 查询用户                   |
| `用 zod 解析 body`           | 校验输入                   |
| `await fetch(...)`           | 调用支付网关               |
| `setState(...)`              | 更新视图状态               |

## 输出协议

只输出一个完整 JSON，结构完全等同 `features.json`，不要 markdown 包裹。
然后把它**覆盖写入** `.codesee/features.json`。

写入后**立即跑校验**：

```bash
node .codesee/scripts/validate-features.mjs
```

- 退出码 0 → 通过，进入下方"变更摘要"
- 退出码 1 → 必须按报错修复并再跑校验，**直到通过**才能告诉用户"完成"
- 退出码 2 → 排查文件/JSON 问题

写完后用人话简短总结这一轮：

```
变更摘要：
- 新增 feature: f-xxx（XX 功能）
- 修改 feature: f-yyy（添加了 N 步：…）
- 删除 feature: 无
- 锁定但受影响：无
- 不确定的地方：…
```

## 边界情况处理

- **改动只涉及样式 / 重构 / 重命名**：不改 features.json，仅在总结里说明"本次为非语义改动，未更新功能图"。
- **改动跨多个 feature**：分别更新，保持原有 feature 边界。
- **新文件但还没接入到任何 feature**：暂不追加 feature，只在总结里提示。
- **删除了某个功能的代码**：把对应 feature 标 `tags: ['deprecated']`，不要直接删除（保留历史，方便对照）。

## schema 速查

```ts
type Feature = {
  id: string; name: string; summary?: string; epicId?: string
  triggers?: { kind: 'http'|'cli'|'cron'|'event'|'ui'|'manual'|'startup'|'unknown'; detail: string }[]
  steps: { id: string; name: string; role: 'input'|'validation'|'auth'|'data-read'|'data-write'|'compute'|'transform'|'side-effect'|'output'|'error'|'other'; note?: string; refs?: { file: string; lines?: [number, number] }[] }[]
  flow: { from: string; to: string; kind: 'next'|'async'|'conditional'|'loop'|'error'; condition?: string }[]
  confidence: number
  provenance: 'ai' | 'user'
  locked?: boolean
  tags?: string[]
  updated_at: string
}
```

完整 schema 见 `.codesee/prompts/scan-light.md`。
