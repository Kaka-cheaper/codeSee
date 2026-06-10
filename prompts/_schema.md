# FCG Schema 参考

> 本文件是 features.json 的唯一 schema 真值源。其他 prompt 引用本文件，不重复定义。

## 顶层结构

```ts
type FeaturesFile = {
  version: '0'
  manifest: { repo?: string; commit?: string; generated_at: string; generator?: string; lang?: string }
  epics: Epic[]
  features: Feature[]
  cross_feature?: CrossFeatureLink[]
  epic_flow?: EpicFlow[]
  tours?: Tour[]
}
```

> `manifest.lang`：语义文本的输出语言（如 `"zh-CN"`、`"en"`、`"ja"`）。默认 `"zh-CN"`。
> 所有面向人类阅读的字段（name、summary、note、condition、epic_flow.note）都使用该语言。

## Epic

```ts
type Epic = {
  id: string              // slug: 'user', 'order', 'infra'
  name: string            // manifest.lang 语言
  summary?: string
  tags?: string[]
  order?: number          // 阶段编号（同阶段共享）
  importance?: 'core' | 'normal' | 'auxiliary'
}
```

## Feature

```ts
type Feature = {
  id: string              // 'f-xxx' 前缀
  name: string            // manifest.lang 语言，2-10 字/词
  summary?: string        // ≤30 字/词
  epicId?: string
  triggers?: Trigger[]
  steps: Step[]
  flow: Flow[]
  confidence: number      // 0-1
  provenance: 'ai' | 'user'
  locked?: boolean
  tags?: string[]
  updated_at: string      // ISO
}
```

## 子类型

```ts
type Trigger = {
  kind: 'http' | 'cli' | 'cron' | 'event' | 'ui' | 'manual' | 'startup' | 'unknown'
  detail: string
}

type Step = {
  id: string
  name: string            // manifest.lang 语言的动词短语，2-8 字/词
  role: 'input' | 'validation' | 'auth' | 'data-read' | 'data-write'
      | 'compute' | 'transform' | 'side-effect' | 'output' | 'error' | 'other'
  note?: string
  refs?: { file: string; lines?: [number, number] }[]
}

type Flow = {
  from: string            // step.id
  to: string              // step.id
  kind: 'next' | 'async' | 'conditional' | 'loop' | 'error'  // MUST 填
  condition?: string      // conditional/loop 时 SHOULD 填
}

type CrossFeatureLink = {
  from: string; to: string
  kind: 'triggers' | 'flow' | 'depends_on'
  /** flow 关系的同步/异步性，可选（不写默认按同步渲染） */
  mode?: 'sync' | 'async'
  note?: string
}

type EpicFlow = {
  from: string; to: string
  kind: 'next' | 'depends_on'
  note: string            // MUST 填，manifest.lang 语言的语义短句
}
```

## Tour（引导式导览，可选）

> 设计依据：人不通过"看全图"理解系统，而是通过"按顺序走一条路"。
> Tour 把画布变成逐步点亮的舞台：每步先开一个好奇心缺口（gap），
> 再揭晓答案叙事（reveal），关键处让用户预测（quiz）。

```ts
type Tour = {
  id: string               // slug: 'onboarding'
  title: string            // manifest.lang 语言："新人入门：这个系统怎么转起来"
  goal: string             // 走完后用户应能回答什么："能说出从安装到画布渲染的完整链路"
  steps: TourStep[]        // 6-10 步；第一步必须是骨架步（见下）
}

type TourStep = {
  focus: string[]          // 本步点亮的节点：epic id 或 feature id，1-3 个
  gap: string              // 开缺口的问题。MUST 是问句，不是陈述句
  reveal: string           // 答案叙事，≤60 字/词，有因果方向
  quiz?: {                 // 预测点，可选；整条 tour 出现 1-2 次
    options: string[]      // 2-3 个选项
    answer: number         // 正确选项下标（0-based）
    wrong_note?: string    // 答错时的一句话纠偏（指出"你以为 X，实际 Y"）
  }
}
```

**Tour 硬约束**：

1. **6-10 步**。超过 10 步工作记忆撑不住，少于 6 步讲不完骨架+主线。
2. **第一步是骨架步**：focus 指向 2-3 个核心 epic，reveal 用"三段论"给出系统主线
   （"先 A，然后 B，最后 C"），不是并列罗列。后续细节都挂在这个架子上。
3. **gap 必须是问题**：先制造信息缺口再给答案。"接下来是支付模块" ✗；
   "订单创建后钱还没扣——系统怎么保证用户跑不掉？" ✓
4. **focus 引用 MUST 存在**：epic id 必须在 epics[]，feature id 必须在 features[]。
   不支持 step 级 focus（v1 限制）。
   播放时视图档位自动跟随：focus 全是 epic 的步在概览视图（骨架步天然如此），
   含 feature 的步在功能视图——所以骨架步只写 epic id，别混入 feature。
5. **顺序有因果**：每步的 reveal 应该自然引出下一步的 gap，像剧集结尾的钩子。
6. **quiz 放在岔路口**：条件分支、容错路径、异步行为——用户凭直觉容易答错的地方。
   不出"纯背诵"题。

## 枚举速查

```
trigger.kind:   http | cli | cron | event | ui | manual | startup | unknown
step.role:      input | validation | auth | data-read | data-write | compute | transform | side-effect | output | error | other
flow.kind:      next | async | conditional | loop | error
cross.kind:     triggers | flow | depends_on
cross.mode:     sync | async   (可选，仅用于 flow)
epic_flow.kind: next | depends_on
tour.steps:     6-10 步；step.focus 引用 epic id 或 feature id
importance:     core | normal | auxiliary
provenance:     ai | user
```

## 常见误区映射

```
| 你想表达              | 正确归类                |
| --------------------- | ----------------------- |
| 业务计算 / 算法       | role = 'compute'        |
| 初始化 / 清理         | role = 'other'          |
| WebSocket / SSE       | trigger = 'http'        |
| 应用启动              | trigger = 'startup'     |
| 内部触发              | trigger = 'event'       |
| 不确定                | trigger = 'unknown'     |
| 发布事件 / 订阅事件   | cross.kind = 'flow'     |
| WebSocket 推送数据    | cross.kind = 'flow' + mode = 'async' |
| 解锁 / 让 X 成为可能  | epic_flow A enables B → 改写为 B depends_on A |
```

## cross_feature 关系判别（v0.2 三类）

```
| 关系       | 何时用                                              | 例子                          |
| ---------- | --------------------------------------------------- | ----------------------------- |
| triggers   | 用户/外部动作主动触发另一个功能                     | 登录后跳转主页 / 点保存触发同步 |
| flow       | A 产出数据/事件 → B 消费（同步异步皆可）            | 上架成功 → 列表更新 / 支付回调 → 通知发货 |
| depends_on | 静态依赖：B 必须先存在/可用，A 才能工作（不一定运行时调用） | 业务功能依赖底座的鉴权 / 缓存中间件 |
```

**关键规则**：
- `flow` 用 `from→to` 表达"谁是源谁是消费者"——不再写 publishes / subscribes 两条对称边
- 异步副作用（消息队列、WebSocket 推送、fire-and-forget）一定要 `kind: 'flow'` + `mode: 'async'`
- `triggers` 优先用于**用户旅程主线**；其余通通归 `flow` 或 `depends_on`
- 不再使用 `publishes` / `subscribes` / `enables`（v0.1 历史枚举，loader 自动迁移但请用新值）

## 完整示例（3 features）

```json
{
  "version": "0",
  "manifest": { "repo": "example", "generated_at": "2026-05-15T00:00:00Z", "generator": "ai@claude", "lang": "zh-CN" },
  "epics": [
    { "id": "auth", "name": "用户认证", "order": 0, "importance": "normal" },
    { "id": "order", "name": "订单", "order": 1, "importance": "core" }
  ],
  "features": [
    {
      "id": "f-login", "name": "用户登录", "epicId": "auth",
      "triggers": [{ "kind": "http", "detail": "POST /api/login" }],
      "steps": [
        { "id": "input", "name": "接收请求", "role": "input" },
        { "id": "find", "name": "查询用户", "role": "data-read" },
        { "id": "verify", "name": "比对密码", "role": "auth" },
        { "id": "token", "name": "签发令牌", "role": "compute" },
        { "id": "ok", "name": "返回令牌", "role": "output" },
        { "id": "fail", "name": "返回认证失败", "role": "error" }
      ],
      "flow": [
        { "from": "input", "to": "find", "kind": "next" },
        { "from": "find", "to": "verify", "kind": "next" },
        { "from": "verify", "to": "token", "kind": "conditional", "condition": "密码正确" },
        { "from": "verify", "to": "fail", "kind": "conditional", "condition": "密码错误" },
        { "from": "token", "to": "ok", "kind": "next" }
      ],
      "confidence": 0.95, "provenance": "ai", "updated_at": "2026-05-15T00:00:00Z"
    },
    {
      "id": "f-checkout", "name": "下单结算", "epicId": "order",
      "triggers": [{ "kind": "http", "detail": "POST /api/orders" }],
      "steps": [
        { "id": "input", "name": "接收订单", "role": "input" },
        { "id": "calc", "name": "计算总价", "role": "compute" },
        { "id": "save", "name": "创建订单", "role": "data-write" },
        { "id": "pay", "name": "调用支付", "role": "side-effect" },
        { "id": "ok", "name": "返回订单号", "role": "output" }
      ],
      "flow": [
        { "from": "input", "to": "calc", "kind": "next" },
        { "from": "calc", "to": "save", "kind": "next" },
        { "from": "save", "to": "pay", "kind": "next" },
        { "from": "pay", "to": "ok", "kind": "async" }
      ],
      "confidence": 0.85, "provenance": "ai", "updated_at": "2026-05-15T00:00:00Z"
    }
  ],
  "cross_feature": [
    { "from": "f-login", "to": "f-checkout", "kind": "triggers", "note": "登录后才能下单" }
  ],
  "epic_flow": [
    { "from": "auth", "to": "order", "kind": "next", "note": "登录后进入订单流程" }
  ]
}
```
