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
   - **给每个 Epic 一个 `order` 数字**，表示用户旅程的"阶段"：
     - order 是**阶段编号**，不是 Epic 序号
     - **同阶段的 Epic 共享同一个 order**（比如"实时推送"和"仿真运行"都属于"执行阶段"，都写 order=2）
     - 不要把 N 个 Epic 编成 0,1,2,...,N-1 这种全递增——那会让画布变成一条横线
     - 阶段从用户视角划分：启动准备 → 配置 → 执行 → 监控/分析 → 工具/辅助
     - 不确定时宁可让多个 Epic 共享同一阶段，也不要全部错开

3. **抽 Feature（用户可感知的能力）**：
   - 一个 HTTP 端点 ≈ 一个 feature，CRUD 各拆开
   - 后台任务、定时器、事件订阅、CLI 子命令、UI 上独立的关键操作都算 feature
   - 项目里的功能数通常在 **5-30** 之间；超过 30 你可能误把实现细节当成功能了

   **Feature vs Component 判别**（防止把组件当功能）：
   - Feature 是"用户用一句话说清楚的能力"，例：用户登录、添加用户、发送通知
   - Component 是"feature 内部的视觉/逻辑子部分"，例：思考气泡、迷你仪表盘、工具栏
   - 子组件应作为它所在 feature 的 step 或在 note 里提，不要平级立为 feature

4. **为每个 Feature 写 steps + flow**：
   - step 数量 **3-10** 最佳；> 10 说明粒度过细，应该拆成多个 feature；< 3 说明可能漏了
   - **step.name 硬约束**：必须是中文动词短语，禁止：
     - 英文代码标识符（`save_user` / `tickAdvanced` / `RECONNECT_BACKOFF_MS`）
     - 函数调用形式（含括号、点号链）
     - 事件名 / 类型名 / 常量名照搬
     - "调用 X" / "推送 X" 后跟英文（应改成"调用支付网关" / "推送进度事件"这种纯中文）
   - flow.kind 必填，五种语义：
     - `next` 顺序
     - `async` 触发后不等待 ★ 异步副作用必须用，见下方"异步识别"
     - `conditional` 分支 ★ 看到 if/else 走不同动作时必须用，写 `condition`
     - `loop` 循环 ★ 看到对集合反复执行时必须用
     - `error` 错误分支 ★ 见下方"错误分支强制"

   **异步识别（最容易翻车）**：
   - 这一步发出事件 / 入队 / 投递到 channel / call_soon_threadsafe → 是 side-effect 且是 async
   - 这一步触发 webhook / 推 WebSocket / 发邮件 / 写日志 → 是 side-effect 且是 async
   - 这一步用 fire-and-forget / 不等 await → async
   - react-query mutation / fetch().then() / Promise 链 → mutation 主线就是 async
   - 同一个 feature 内既有"主流程返回结果"又有"附带通知"，通知边必须用 async
   - 如果遇到"sync 接口跨线程往 asyncio 队列推消息"这种发布订阅模式，画两条边：sync 完成是 next，broadcast 那条是 async

   **错误分支强制**：
   每个有外部输入 / 数据库 / 外部调用的 feature 必须至少思考一条 error 分支：
   - HTTP 4xx：参数校验失败 / 资源不存在 / 鉴权失败
   - HTTP 5xx：依赖故障 / 内部异常
   - 外部调用：超时 / 拒绝 / 限流
   - 业务规则：金额不足 / 状态非法 / 并发冲突
   如确实无错误分支（例如纯查询且参数已严格校验），在 feature.note 里说明"无显式 error 分支：原因…"

5. **挂 refs（推荐）**：每个 step 至少挂 1 条 file 引用，方便点开对照源码。
   `lines` 不强制，写不准就省略。

6. **cross_feature**：四种关系判别（避免全写成 triggers）：
   - `triggers`：A 主动调 B 的入口（前端组件挂着按钮调后端某接口）
   - `depends_on`：A 不依赖 B 调用，但 B 不在 A 跑不起来（如 lifespan 不启动 WebSocket 接口就不可用）
   - `publishes`：A 完成后**发出事件 / 状态变更**，谁监听都行 ★ 发布订阅模式必须用
   - `subscribes`：B **监听** A 发出的事件作出反应（前端 useEvents 监听后端推送）
   ⚠ 如果你的项目有 WebSocket / 事件总线 / 消息队列 / 状态推送，**publishes/subscribes 比例应该 ≥ 30%**，
   全是 triggers 说明你只看到了"A 调 B"的同步链条，漏了 "A 发事件 → B 反应"的异步链条。

   **用户主流程**：如果项目有清晰的用户导航链（A 页面 → B 页面 → C 页面），
   用 `triggers` 在对应 feature 之间画导航边。

7. **epic_flow（Epic 之间的主线）**：
   在所有 feature 写完后，站在**用户视角**分析 Epic 之间的旅程主线：
   - 用户使用这个系统的主线是什么？（如：登录 → 浏览 → 配置 → 运行 → 查看结果）
   - 把每条主线写成 epic_flow 的一条边

   写入 `epic_flow` 数组，三种 kind（**优先用 next**）：

   - `next`：用户旅程的下一步 ★ 优先用这个
     - 例：浏览画廊 → 选场景创建 → 看运行过程 → 查看分析
     - 问自己："用户做完 A 之后会立刻去做 B 吗？" 是 → next
   - `depends_on`：A 是 B 的运行时前置（B 需要 A 一直存在）
     - 罕用，**全局只画 1-2 条**代表性的（如基础设施 → 核心业务）
   - `enables`：A 解锁 B 的能力，但 A、B 在用户旅程上不是顺序关系
     - 例：登录 → 个人设置（登录了"才能"改设置，但用户不一定每次都改）
     - ⚠ **不要把"先决条件"全写成 enables**——技术依赖用 depends_on，用户顺序用 next

   硬约束：
   - 通常 3-8 条即可，不要把所有 Epic 都连起来。只画**用户能感知的主线**。
   - **`note` 必须填写，且必须是中文语义短句**（如"配置完成后才能运行"），不要写技术词。
   - `note` 是画布上显示的边标签——省略了用户看不懂这条线是什么意思。

8. **confidence 校准**（不要全写 0.85）：
   - `≥ 0.9`：CRUD / 单文件函数 / 路由+一两个 service，覆盖到位
   - `0.7-0.85`：跨多文件，但流程清晰可追
   - `0.5-0.7`：动态调用 / 反射 / 配置驱动 / 异步副作用 / 跨线程，把握不大
   - `< 0.5`：仅凭命名猜的，没读到核心实现
   把所有 feature 都写 0.85 是偷懒信号。

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

type Epic = { id: string; name: string; summary?: string; tags?: string[]; order?: number }

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

type EpicFlow = {
  from: string              // epic.id
  to: string                // epic.id
  kind: 'next' | 'depends_on' | 'enables'
  note?: string             // 一句话说明为什么有这个关系
}
```

## 输出前自检

- [ ] 没有任何 step 写成函数名 / 类名 / 文件名 / 事件名 / 常量名
- [ ] 没有 step.name 含 ASCII 标识符（如 "推送 tick_advanced" → 应改成 "推送进度事件"）
- [ ] 每个 feature 至少有一个入口 step（role=input）和一个出口 step（role=output 或 error）
- [ ] flow 没有自环、没有指向不存在的 step.id
- [ ] flow.kind 全部填写（不要 undefined）
- [ ] 项目存在异步 / 事件 / WebSocket / 消息队列时，至少有一条边是 `async`、cross_feature 至少有 1 条 `publishes`
- [ ] 有外部输入 / 数据库 / 外部调用的 feature 至少思考过 error 分支
- [ ] 有 if / else 走不同动作的位置用了 `conditional` 而不是 `next`
- [ ] confidence 不全是同一个值（不要全 0.85）
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
