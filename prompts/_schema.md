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
  kind: 'depends_on' | 'publishes' | 'subscribes' | 'triggers'
  note?: string
}

type EpicFlow = {
  from: string; to: string
  kind: 'next' | 'depends_on' | 'enables'
  note: string            // MUST 填，manifest.lang 语言的语义短句
}
```

## 枚举速查

```
trigger.kind:   http | cli | cron | event | ui | manual | startup | unknown
step.role:      input | validation | auth | data-read | data-write | compute | transform | side-effect | output | error | other
flow.kind:      next | async | conditional | loop | error
cross.kind:     depends_on | publishes | subscribes | triggers
epic_flow.kind: next | depends_on | enables
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
```

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
