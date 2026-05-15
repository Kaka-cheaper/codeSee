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
| `推送 tick_advanced`         | 推送进度事件               |
| `构造 RECONNECT_BACKOFF_MS`  | 计算重连等待               |

**step.name 硬约束**：
- 必须中文动词短语
- 禁止英文代码标识符 / 函数调用形式 / 事件名照搬
- 不确定写"其他"也比写英文标识符强

## 异步 / 错误 / 条件 三类边的强制规则

改动如果引入或改动了下面任何一类，必须用对应的 flow.kind：

- **异步副作用**（`async`）：推送事件 / 入队 / WebSocket / 跨线程投递 / 后台 fire-and-forget / react-query mutation / Promise 链
- **条件分支**（`conditional`）：if/else 走不同动作（如 wasPaused=true 跳过 auto-resume），并填 `condition`
- **错误分支**（`error`）：参数校验失败 / 资源不存在 / 鉴权失败 / 依赖故障 / 业务规则失败 / 降级路径

漏掉这三类是 features.json 失真最严重的来源，自检时优先检查。

## cross_feature 关系不要全写 triggers

四类关系：
- `triggers`：A 主动调 B 的接口
- `depends_on`：A 不调 B 但 B 不在 A 跑不起来（lifespan / 全局中间件等，画 1-2 条代表性的即可）
- `publishes`：A 完成后发出事件 / 状态变更 ★ **WebSocket / 事件总线 / 消息队列 → 必须有**
- `subscribes`：B 监听 A 发出的事件作出反应

如果改动涉及发布订阅模型，必须画 publishes/subscribes，不要全写成 triggers。

## epic_flow 维护

如果本次改动**新增或删除了 Epic**，或者 Epic 之间的主线关系发生了变化：
- 更新 `epic_flow` 数组
- **优先用 `next`**（用户旅程下一步），它应占 ≥ 60%
- `depends_on` 罕用（基础设施依赖，全局 1-2 条），`enables` 极少用
- `note` 必须是中文语义短句（如"配置完成后运行"），不要写技术词
- 通常 3-8 条，只画用户能感知的主线
- 不要因为一次小改动就重写整个 epic_flow——只动受影响的条目

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
