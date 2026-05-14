<!-- BEGIN: CodeSee integration -->
## CodeSee 功能图维护

本项目接入了 CodeSee — 把功能逻辑以语义流程图呈现的工具。
数据存储在 `.codesee/features.json`，由你（AI）维护。

### 你必须遵守的工作流

**触发 1：首次扫描**
若 `.codesee/features.json` 不存在、是空对象、或缺少 `version` 字段：
1. 完整执行 `.codesee/prompts/scan.md`（自检规模 → light/heavy 子 prompt）
2. 把结果写入 `.codesee/features.json`
3. **写入后立即跑校验**（见下方"自检"）

**触发 2：每轮代码改动后（默认行为）**
完成一轮代码改动后，在回复用户前**主动**：
1. 完整执行 `.codesee/prompts/sync.md`
2. 增量更新 `.codesee/features.json`
3. **写入后立即跑校验**（见下方"自检"）

仅当本次改动只涉及样式/重构/重命名（无语义变化），或用户明确要求跳过时不做，并在回复中说明。

**触发 3：用户显式要求**
用户说"刷新功能图""更新 codesee""扫一下"等，按上述策略对应执行。

### 写入后必须自检（重要）

每次修改 `.codesee/features.json` 后，**强制**执行：

```bash
node .codesee/scripts/validate-features.mjs
```

读取它的退出码与输出：

- **退出码 0** → 通过，继续后续工作
- **退出码 1** → 有结构错误，**必须按报错修复后再次跑校验**，直到通过为止；不要把没通过校验的 features.json 留给用户
- **退出码 2** → 文件路径或 JSON 解析问题，先排查这一类

修复策略：
- 报错指向的 path 形如 `$.features[3].steps[1].id`，按这个路径定位字段
- 警告（如 step 名字写成"调用 X"）也应当修，除非用户明示忽略

修复后**再跑一次校验**，直到无错（警告可保留但要在回复中提一句）。
完成后再向用户回复"扫描/同步完成 + 校验通过"。

### 永远不要做

- ❌ 修改 `.codesee/prompts/` 与 `.codesee/scripts/` 下任何文件（除非用户明确要求）
- ❌ 修改 `.codesee/features.json` 中 `locked: true` 的 feature
- ❌ 把 `features.json` 写到 `.codesee/` 之外的任何位置
- ❌ 重命名既有的 `feature.id` / `step.id`（会破坏画布上的人工标注；废弃就加 `tags: ['deprecated']`）
- ❌ 跳过校验直接告诉用户"完成了"

### "调用 → 语义"反例对照

`step` 必须是**动作语义**，不是代码层面的实现细节：

| 不要写                       | 要写                       |
| ---------------------------- | -------------------------- |
| `调用 bcrypt.compare`        | 比对密码                   |
| `执行 SQL select`            | 查询用户                   |
| `用 zod 解析 body`           | 校验输入                   |
| `await fetch(...)`           | 调用支付网关               |
| `setState(...)`              | 更新视图状态               |
| `调用 UserService.create`    | 创建用户                   |
| `推送 tick_advanced`         | 推送进度事件               |
| `构造 RECONNECT_BACKOFF_MS`  | 计算重连等待               |

校验脚本会自动识别"调用..."、含括号、英文标识符、中文里嵌 ASCII 标识符等反例，请直接按它的提示改。

### Feature vs Component 判定

写 feature 之前先反问：**"这是用户用一句话能说清楚的能力吗？"**

- 是 → 立 feature（如"添加用户"、"下单结算"）
- 否 → 它可能是某 feature 内部的视觉子组件 / 内部辅助逻辑，应当作为 step 或在 note 里提
- 例：思考气泡、迷你仪表盘、单个工具栏 button → 不是 feature，是父 feature 的 step
- 例：多 tab 详情页里的每个 tab 通常视觉独立 → 每个 tab 至少一个 feature

### 异步 / 错误 / 条件三类边的强制规则

- **异步副作用**（`flow.kind = async`）：推送事件 / 入队 / WebSocket / 跨线程投递 / fire-and-forget / mutation 链
- **条件分支**（`flow.kind = conditional`）：if/else 走不同动作，必须填 `condition`
- **错误分支**（`flow.kind = error`）：参数校验失败 / 资源不存在 / 鉴权失败 / 依赖故障 / 业务规则失败 / 降级路径
- 漏这三类是 features.json 失真最严重的来源，每次 sync 都要主动检查

### cross_feature 关系不要全写 triggers

四类关系比例参考：
- `triggers`：A 主动调 B 接口
- `depends_on`：A 不调 B 但 B 不在 A 跑不起来（lifespan / 全局中间件，画 1-2 条代表性的）
- `publishes`：A 完成后发出事件 / 状态变更 ★ **WebSocket / 事件总线 / 消息队列必须有**
- `subscribes`：B 监听 A 发出的事件

如果项目有发布订阅模型，publishes/subscribes 应占 ≥ 30%；全是 triggers 是漏掉异步链条的信号。

### 严格枚举（最容易翻车的地方）

```
trigger.kind:  http | cli | cron | event | ui | manual | startup | unknown
step.role:     input | validation | auth | data-read | data-write
               | compute | transform | side-effect | output | error | other
flow.kind:     next | async | conditional | loop | error    ⚠ 必填
cross.kind:    depends_on | publishes | subscribes | triggers
```

不要编造 `logic` / `init` / `cleanup` / `internal` / `lifecycle` / `websocket` 这种值——画布会拒绝渲染。
不确定时用兜底值：role=`other`、trigger=`unknown`、flow=`next`。

### confidence 校准

不要给所有 feature 都写同一个值（如全 0.85）。

- `≥ 0.9`：单文件 / 简单 CRUD / 路由+一两个 service，覆盖到位
- `0.7-0.85`：跨多文件，但流程清晰可追
- `0.5-0.7`：动态调用 / 反射 / 配置驱动 / 异步副作用 / 跨线程
- `< 0.5`：仅凭命名猜的

### 文件位置

- 扫描 prompt：`.codesee/prompts/scan.md`（→ light/heavy 自动路由）
- 同步 prompt：`.codesee/prompts/sync.md`
- 校验脚本：`.codesee/scripts/validate-features.mjs`
- 数据：`.codesee/features.json`

> 如果你看到这段并要执行 scan/sync，**先告诉用户你要做什么**，再开始执行。
<!-- END: CodeSee integration -->
