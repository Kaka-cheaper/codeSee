# CodeSee · 扫描模式 · 轻型项目

> 由 `.codesee/prompts/scan.md` 路由进来。
> 适用：源码 < 100 文件、单仓库单服务、上下文一次能装下。

---

## 你的任务

通读项目，**一次性输出**完整的 `features.json` 到 `.codesee/features.json`。

## 工作步骤

1. **通读项目**（用 IDE 的代码探索工具，不用自己枚举）：
   - README、配置入口、路由表、CLI 入口、定时任务、UI 主要页面
   - 一遍读完，建立全局心智模型；不要边读边写

2. **划 Epic（业务大块）**：
   - 3-6 个最合适；不要为了凑数硬拆
   - Epic 是用户语言里的"模块"：用户 / 订单 / 内容 / 运维 / 集成 / 看板
   - 实在归不进任何 Epic 的，留空 `epicId` 或归到 'misc'

3. **抽 Feature（用户可感知的能力）**：
   - 一个 HTTP 端点 ≈ 一个 feature，CRUD 各拆开
   - 后台任务、定时器、事件订阅、CLI 子命令、UI 上独立的关键操作都算 feature
   - 项目里的功能数通常在 **5-30** 之间；超过 30 你可能误把实现细节当成功能了

4. **为每个 Feature 写 steps + flow**：
   - step 数量 **3-10** 最佳；> 10 说明粒度过细，应该拆成多个 feature；< 3 说明可能漏了
   - step.name 用动词短语：`接收请求`、`校验输入`、`查询用户`、`返回响应`
   - flow.kind：
     - `next` 顺序
     - `async` 触发后不等待（消息、邮件、webhook）
     - `conditional` 分支（必须写 condition 描述）
     - `loop` 循环（必须写 condition 描述）
     - `error` 错误分支

5. **挂 refs（推荐）**：每个 step 至少挂 1 条 file 引用，方便点开对照源码。
   `lines` 不强制，写不准就省略。

6. **cross_feature**：A 完成后触发 B、A 依赖 B 存在等关系。

## 完整 Schema

```ts
type FeaturesFile = {
  version: '0'
  manifest: {
    repo?: string
    commit?: string         // 当前 commit 短 hash
    generated_at: string    // ISO 时间
    generator?: string      // 例 'ai@claude-3.5-sonnet'
  }
  epics: Epic[]
  features: Feature[]
  cross_feature?: CrossFeatureLink[]
}

type Epic = { id: string; name: string; summary?: string; tags?: string[] }

type Feature = {
  id: string                          // 'f-xxx'
  name: string                        // 中文，2-10 字
  summary?: string                    // <=30 字
  epicId?: string
  triggers?: Trigger[]
  steps: Step[]
  flow: Flow[]
  confidence: number                  // 你的把握，0-1
  provenance: 'ai'                    // 永远 'ai'
  locked?: boolean                    // 不要主动设 true
  tags?: string[]
  updated_at: string
}

type Trigger = {
  kind: 'http'|'cli'|'cron'|'event'|'ui'|'manual'|'startup'|'unknown'
  detail: string                      // 'POST /api/users' / '每日凌晨 2 点'
  // ⚠ 不要编造其他 kind。常见误区：
  //   - WebSocket / SSE → 用 'http'，detail 写 'WS /ws/foo' 或 'SSE /events/x'
  //   - 应用启动 / 模块加载 → 用 'startup'
  //   - 内部模块互相调用产生的入口 → 用 'event' 或 'manual'
  //   - 不确定 → 用 'unknown'
}

type Step = {
  id: string                          // feature 内唯一
  name: string                        // 中文动词短语
  role:
    | 'input' | 'validation' | 'auth'
    | 'data-read' | 'data-write'
    | 'compute' | 'transform'
    | 'side-effect' | 'output' | 'error' | 'other'
  // ⚠ 严格只用上述 11 种。常见误区：
  //   - 业务计算 / 算法 → 'compute'（不是 'logic'）
  //   - 初始化 / 清理 / 加载资源 → 'other'（不是 'init' / 'cleanup'）
  //   - 网络调用、写日志、发消息、改外部状态 → 'side-effect'
  //   - 解析/格式化/序列化 → 'transform'
  note?: string
  refs?: { file: string; lines?: [number, number] }[]
}

type Flow = {
  from: string
  to: string
  kind: 'next' | 'async' | 'conditional' | 'loop' | 'error'  // ⚠ 必填，不能省略
  condition?: string
}

type CrossFeatureLink = {
  from: string
  to: string
  kind: 'depends_on' | 'publishes' | 'subscribes' | 'triggers'
  note?: string
}
```

## 输出前自检

- [ ] 没有任何 step 写成函数名 / 类名 / 文件名
- [ ] 每个 feature 至少有一个入口 step（role=input）和一个出口 step（role=output 或 error）
- [ ] flow 没有自环、没有指向不存在的 step.id
- [ ] confidence 真实反映把握：跨多文件且约定模糊→0.5-0.7；明确→0.9+
- [ ] manifest.generated_at 用真实 ISO 时间
- [ ] 输出是单个 JSON 对象，不是数组

## 完成后

写入 `.codesee/features.json`，然后**立即跑校验**：

```bash
node .codesee/scripts/validate-features.mjs
```

读取退出码：
- 0 → 通过
- 1 → 有结构错误，按报错修复后再跑，**直到通过**
- 2 → 文件/JSON 异常

通过校验后，再用人话**简短**总结：

```
- 发现 N 个 epic、M 个 feature
- 最复杂的功能是哪个（步骤最多 / 涉及最多副作用）
- 把握不大的地方（confidence 最低的几个 feature 与原因）
- 漏了什么：是否有动态路由、配置驱动、反射调用等没有覆盖的部分
```
