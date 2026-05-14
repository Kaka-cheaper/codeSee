# CodeSee · 扫描模式 Prompt

> 用途：第一次接入一个项目，让 AI 通读代码后产出一份语义化的 `features.json`。
> 适用：任何 AI IDE（Cursor / Claude Code / Kiro / Copilot Chat / ChatGPT 等）。
> 用法：把整段拷给 AI，按需替换 `<项目根>` 等占位符。

---

## 你的任务

阅读项目代码，从**用户/业务可感知的功能**视角，生成 `features.json`，
让另一个不看代码的人能在画布上理解"这个项目都有哪些功能、每个功能怎么发生的"。

**核心要求：你描述的是语义流程，不是调用关系。**
不要写 import / call / 函数名拼接的链路；要写"先做什么、然后做什么"的人类语言步骤。

> 类比：如果功能是"西红柿炒鸡蛋"，你要写的是"备菜 → 打蛋 → 热油 → 下锅 → 调味 → 出锅"，
> 不是"`prepare()` 调用 `slice()`，再调用 `whisk()`"。

## 输出要求

只输出一个完整的 JSON，不要 markdown 代码块包裹，不要解释。
JSON 结构严格遵守下方 schema。

```ts
type FeaturesFile = {
  version: '0'
  manifest: {
    repo?: string         // 项目名/路径
    commit?: string       // 当前 commit 短 hash（可选）
    generated_at: string  // ISO 时间
    generator?: string    // 例 'ai@claude-3.5-sonnet'
  }
  epics: Epic[]                       // 业务大块（"用户管理"、"订单"）
  features: Feature[]                 // 用户可感知的功能（"添加用户"、"下单"）
  cross_feature?: CrossFeatureLink[]  // 功能之间的关系
}

type Epic = {
  id: string                // 短 slug，如 'user'
  name: string              // 中文名
  summary?: string          // 一句话
  tags?: string[]
}

type Feature = {
  id: string                // 短 slug，如 'f-add-user'
  name: string              // 中文名，2-10 字
  summary?: string          // <=30 字描述
  epicId?: string           // 归属的 epic id
  triggers?: Trigger[]      // 触发方式
  steps: Step[]             // 步骤数组
  flow: Flow[]              // 步骤之间的"然后"关系
  confidence: number        // 你的把握；不确定写 0.6
  provenance: 'ai'          // 永远写 'ai'，除非用户已经手改过
  locked?: boolean          // 永远不要把现有的 locked=true 改回 false
  tags?: string[]
  updated_at: string        // ISO 时间
}

type Trigger = {
  kind: 'http' | 'cli' | 'cron' | 'event' | 'ui' | 'manual' | 'startup' | 'unknown'
  detail: string            // 'POST /api/users' / '每日凌晨 2 点' / '用户点击保存'
}

type Step = {
  id: string                // feature 内唯一，短 slug
  name: string              // 动作短语，2-8 字：'校验邮箱'、'查询用户'
  role:
    | 'input' | 'validation' | 'auth'
    | 'data-read' | 'data-write'
    | 'compute' | 'transform'
    | 'side-effect' | 'output' | 'error' | 'other'
  note?: string             // 一句话补充
  refs?: { file: string; lines?: [number, number] }[]  // 指回源码
}

type Flow = {
  from: string              // step.id
  to: string                // step.id
  kind: 'next' | 'async' | 'conditional' | 'loop' | 'error'
  condition?: string        // conditional / loop 的条件描述
}

type CrossFeatureLink = {
  from: string              // feature.id
  to: string                // feature.id
  kind: 'depends_on' | 'publishes' | 'subscribes' | 'triggers'
  note?: string
}
```

## 工作步骤

1. **快速通读项目**：路由表、入口、定时任务、事件订阅、CLI、UI 主要操作。
2. **划 Epic**：按业务领域分 3-8 个，比如"用户、订单、支付、内容、运维"。
3. **抽 Feature**：每个用户/业务能用一句话说清楚的能力都是一个 feature。粒度建议：
   - 一个 HTTP 端点通常 = 一个 feature
   - 一组 CRUD 端点可以共享 epic 但分别写 feature
   - 后台任务、定时器、事件订阅都算 feature
4. **为每个 Feature 写 steps + flow**：
   - step 数量建议 3-10 个，太多说明粒度太细，应该拆成多个 feature
   - 用动作短语命名（动词起头）：'接收请求'、'校验输入'、'查询用户'、'返回响应'
   - 别把语法层细节当 step（比如"调用 bcrypt.compare"应该写成"比对密码"）
   - flow 用 next 表示顺序，async 表示触发后不等待，conditional 表示分支，error 表示错误分支
5. **挂 refs**（可选但推荐）：每个 step 至少挂一条 file 引用，方便后续点开看代码。
6. **cross_feature**：如果功能 A 完成后会触发功能 B，写一条 triggers/publishes 关系。

## 命名约束

- feature.id 用 `f-xxx` 前缀，slug 全小写连字符
- epic.id 用单词或短词组，如 `user`、`order`、`content`
- step.id 在 feature 内唯一，短 slug：`input`、`validate`、`save`、`ok`、`fail`
- step.name 必须中文动词短语，禁止用代码标识符做名字

## 质量自检（输出前自查一遍）

- [ ] 没有任何 step 写成函数名 / 类名 / 文件名
- [ ] 每个 feature 有清晰的入口 step 和至少一个出口 step
- [ ] flow 没有自环，没有指向不存在的 step.id
- [ ] confidence 真实反映把握：跨多个文件且约定模糊的写 0.5-0.7，明确的写 0.9+
- [ ] manifest.generated_at 是真实 ISO 时间
- [ ] 输出是单个 JSON 对象，不是数组，不带 markdown

## 写入位置

把生成的 JSON **覆盖写入**：
```
mvp-web/public/features.json
```

完成后简短总结：发现 N 个 epic、M 个 feature，最复杂的功能是哪个，还有哪些没把握的地方。
