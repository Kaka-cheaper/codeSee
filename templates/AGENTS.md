# AGENTS.md — CodeSee 集成

> 此文件是 AI 协作开发的入口规则。Cursor / Claude Code / Codex / Kiro 等主流 IDE 会自动读取。
> 如果你的 IDE 用别的文件名（如 `CLAUDE.md` / `.cursor/rules/codesee.md`），把本文件改名/复制即可。

---

## 关于本项目

先读项目根的 `README.md` 了解业务背景。

## 关于 CodeSee 集成

本项目接入了 [CodeSee](https://github.com/) — 一种把项目"功能逻辑"以**语义流程图**呈现给协作者的工具。
数据存储在 `.codesee/features.json`，画布是它的可视化前端。

你（AI）的责任：**保持 `.codesee/features.json` 与代码同步演进**。
画布渲染不归你管。

## 你必须遵守的工作流

### 触发 1：首次扫描

如果 `.codesee/features.json` 不存在、是空对象、或缺失 `version` 字段：
1. 完整执行 `.codesee/prompts/scan.md`（它会让你先做规模自检，再选 light/heavy 子 prompt）
2. 把结果写入 `.codesee/features.json`
3. **写入后立即跑校验**（见下方"自检"）

### 触发 2：每轮代码改动后（默认行为）

每完成一轮代码改动，在回复用户前**主动**做：
1. 完整执行 `.codesee/prompts/sync.md`
2. 增量更新 `.codesee/features.json` 并写回
3. **写入后立即跑校验**（见下方"自检"）

仅在以下情况跳过，并在回复中**明确说明跳过原因**：
- 本次改动只涉及样式 / 重构 / 重命名（无语义变化）
- 用户明确说"不要更新功能图"
- 改动还在调试中、不应记入功能图

### 触发 3：用户明确要求

用户说"刷新功能图""更新 codesee""扫一下"等，按上面两个触发的策略对应执行。

## 写入后必须自检（重要）

每次修改 `.codesee/features.json` 后，**强制**执行：

```bash
node .codesee/scripts/validate-features.mjs
```

退出码处理：

- `0` → 通过，继续后续工作
- `1` → 有结构错误，**必须按报错修复后再次跑校验**，直到通过；不要把没通过校验的 features.json 留给用户
- `2` → 文件路径或 JSON 解析问题，先排查这一类

修复后**再跑一次校验**，直到无错。完成后再向用户回复"扫描/同步完成 + 校验通过"。

## 永远不要做

- ❌ 修改 `.codesee/prompts/` 与 `.codesee/scripts/` 下任何文件（除非用户明确要求）
- ❌ 修改 `.codesee/features.json` 中 `locked: true` 的 feature（强制要改时先在回复里告知用户）
- ❌ 把 `features.json` 写到 `.codesee/` 之外的任何位置
- ❌ 重命名既有的 `feature.id` / `step.id`（会破坏画布上的人工标注；废弃就加 `tags: ['deprecated']`）
- ❌ 跳过校验直接告诉用户"完成了"

## "调用 → 语义"反例对照

step 必须是**动作语义**，不是代码层面的实现细节：

| 不要写                       | 要写                       |
| ---------------------------- | -------------------------- |
| `调用 bcrypt.compare`        | 比对密码                   |
| `执行 SQL select`            | 查询用户                   |
| `用 zod 解析 body`           | 校验输入                   |
| `await fetch(...)`           | 调用支付网关               |
| `setState(...)`              | 更新视图状态               |
| `调用 UserService.create`    | 创建用户                   |

## 严格枚举

```
trigger.kind:  http | cli | cron | event | ui | manual | startup | unknown
step.role:     input | validation | auth | data-read | data-write
               | compute | transform | side-effect | output | error | other
flow.kind:     next | async | conditional | loop | error    ⚠ 必填
cross.kind:    depends_on | publishes | subscribes | triggers
```

不要编造 `logic` / `init` / `cleanup` / `internal` / `lifecycle` / `websocket` 这种值。
不确定时用兜底值：role=`other`、trigger=`unknown`、flow=`next`。

## Feature vs Component 判定

写 feature 之前先反问："这是用户用一句话能说清楚的能力吗？"

- 是 → 立 feature
- 否（更像视觉子组件 / 内部辅助逻辑）→ 作为父 feature 的 step
- 多 tab UI 中每个独立 tab 通常各自是一个 feature

## 异步 / 错误 / 条件三类边的强制规则

- **异步副作用**（async）：推送事件 / 入队 / WebSocket / 跨线程投递 / fire-and-forget / mutation 链
- **条件分支**（conditional）：if/else 走不同动作，必须填 condition
- **错误分支**（error）：参数校验失败 / 资源不存在 / 鉴权失败 / 依赖故障 / 业务规则失败 / 降级路径

漏这三类是 features.json 失真最严重的来源。

## cross_feature 关系不要全写 triggers

- `triggers` / `depends_on` / `publishes` / `subscribes` 四类
- 项目有 WebSocket / 事件总线 / 消息队列 → publishes/subscribes 应占 ≥ 30%
- 全是 triggers 是漏掉异步链条的信号

## confidence 校准

- ≥ 0.9：单文件 / 简单 CRUD，覆盖到位
- 0.7-0.85：跨多文件但流程清晰
- 0.5-0.7：动态 / 反射 / 配置驱动 / 异步副作用 / 跨线程
- < 0.5：仅凭命名猜

不要全写一个值。

## 查看效果

用户在 CodeSee viewer 里加载 `.codesee/features.json` 即可看到可视化的功能图。
你只负责把 JSON 写准，渲染由 viewer 完成。

## 文件位置

- 规则入口：本文件 `AGENTS.md`
- 扫描 prompt：`.codesee/prompts/scan.md`（→ light/heavy 自动路由）
- 同步 prompt：`.codesee/prompts/sync.md`
- 校验脚本：`.codesee/scripts/validate-features.mjs`
- 数据：`.codesee/features.json`

---

> 如果你看到这段并要执行 scan/sync，**先告诉用户你要做什么**，再开始执行，避免静默操作。
