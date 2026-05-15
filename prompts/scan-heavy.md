# CodeSee · 扫描模式 · 重型项目

> 由 `.codesee/prompts/scan.md` 路由进来。
> 适用：源码 ≥ 100 文件，或多模块/多服务/前后端分离，一次读不完。

---

## 你的任务

通过**分阶段、分块**的方式，在 `.codesee/features.json` 累积输出完整的 `features.json`。
不要试图一口气读完整个项目——会漏、会错、会浪费 token。

## 总体策略

```
阶段 1：建索引（不写步骤，只列 feature 骨架）
阶段 2：分块深入（一次只钻 1 个 epic，写 step 与 flow）
阶段 3：交叉关系（cross_feature）
阶段 4：自检与漏洞回补
```

每个阶段开始前**告诉我即将做什么**，结束时**告诉我做了什么**。
你可以在中间问我（"我看到 X 看起来像 Y，是这样吗？"）——重型项目里反问比硬猜更值钱。

---

## 阶段 1：建索引![1778765633424](image/scan-heavy/1778765633424.png)

### 1.1 读项目骨架

用 IDE 工具，**只读不写**：

- README / docs / wiki 入口
- 顶层配置：`package.json`/`pyproject.toml`/`Dockerfile`/`docker-compose.yml`/`Makefile`
- 顶层目录的一级 + 二级清单
- 路由总入口（任选其一即可）：
  - Node：`app.ts` / `routes/index.ts` / `server.ts`
  - Python FastAPI：`main.py` / `app/api/__init__.py`
  - Django：`urls.py` 根
  - Spring：`@RestController` 列表
  - 其他：搜索 `route(`、`@app.`、`@Get(`、`@Post(` 等

### 1.2 划 Epic

重型项目通常 **5-12 个 Epic**。判断依据：
- 顶层目录的"业务包"（`apps/order/`、`packages/billing/`）
- 路由前缀（`/api/v1/users/*` → user epic）
- 团队习惯（如果项目自己叫"用户中心 / 订单中心"，照搬）

### 1.3 列 Feature 骨架（只填 id/name/summary/epicId/triggers/tags）

**不要填 steps / flow**。重型项目里这一步通常列出 **20-200 个 feature**。

写一份"只有骨架"的 features.json 到 `.codesee/features.json`：

```json
{
  "version": "0",
  "manifest": { ... },
  "epics": [...],
  "features": [
    {
      "id": "f-create-order",
      "name": "创建订单",
      "summary": "用户提交购物车结算",
      "epicId": "order",
      "triggers": [{"kind": "http", "detail": "POST /api/orders"}],
      "steps": [],
      "flow": [],
      "confidence": 0.5,
      "provenance": "ai",
      "tags": ["order"],
      "updated_at": "..."
    }
  ]
}
```

阶段 1 结束时报告：发现 N 个 epic、M 个 feature 骨架，列出每个 epic 包含的 feature 数。

---

## 阶段 2：分块深入

**一个 epic 一个 epic 地处理。** 默认按 feature 数从少到多——先完成简单的 epic 建立信心。

### 2.1 进入一个 epic 之前

告诉我："开始处理 epic X，预计读取这些目录/文件：…"。

### 2.2 处理一个 feature

按下面的清单做，一个 feature 处理完再处理下一个：

1. 读这个 feature 的入口（路由 handler / 任务函数 / CLI 命令）
2. 沿着入口追到关键依赖：service / repo / 外部调用
3. 写 steps + flow（**不是调用链**，是动作链）
4. 每个 step 至少挂 1 条 file ref
5. **更新到 features.json**：在原有数组中替换这一条 feature（保持 id 不变）

### 2.3 step 的粒度规则

- 一个 feature 通常 **3-10 个 step**
- **step.name 硬约束**：必须中文动词短语，禁止：
  - 英文代码标识符（`save_user` / `tickAdvanced` / `RECONNECT_BACKOFF_MS`）
  - 函数调用形式（含括号 / 点号链）
  - 事件名 / 类型名 / 常量名照搬
  - 反例：`推送 tick_advanced` → 改写：`推送进度事件`
- 写出"如果出错怎么办"：超时、外部调用失败、并发冲突等关键错误分支用 `flow.kind=error`
- 异步副作用必须用 `flow.kind=async`，不要假装是同步：
  - 推送事件 / 入队 / WebSocket / 跨线程投递 / fire-and-forget → async
  - react-query mutation 主链是 async；mutation 内部步骤之间是 next；mutation 完成后通知页面跳转的边是 async
- if / else 走不同动作的位置必须用 `conditional` + `condition`
- 项目里 WebSocket / 事件总线 / 消息队列 / 状态推送 → 至少 20% 的边是 `async`
- 跨线程 / asyncio 队列这种关键并发点，在 step.note 写明（如"经 call_soon_threadsafe 投递"）

### 2.4 边界情况协议

- **路由是动态生成的**（配置驱动、装饰器扫描）：在 feature.note 标"动态注册，未必完整"，confidence ≤ 0.6
- **同一段代码被多个 feature 共享**（中间件、auth、log）：不要为它单独建 feature，让它在每个 feature 里以同名 step 出现，role 标 `auth` / `validation` 等
- **生成代码 / 编译产物**：忽略（dist/build/generated）
- **测试代码**：默认忽略；除非用户明确说要
- **组件 vs feature 判别**：
  - feature 必须是"用户用一句话能说清的能力"
  - UI 子组件（如思考气泡、迷你仪表盘、单个工具栏 button）应作为它所在 feature 的 step 或在 note 里提
  - 反问：如果只看节点名，用户能说出"这个功能是做什么的"吗？说不出来就是组件不是 feature
- **多 tab / 多面板 UI**：每个 tab 视觉上独立呈现 → 至少一个 feature；不要把 5 个 tab 合并成 1 个 feature
- **客户端健壮性行为**（断线重连 / 缓存失效 / 离线兜底）：是用户能感知的体验，独立成 feature 而不是埋在某个 feature 的 step 里
- **用户导航主流程**：列出页面跳转路径（A → B → C），用 cross_feature.kind=`triggers` 把对应 feature 串起来

### 2.5 阶段 2 阶段性报告

每完成一个 epic 简短报告："epic X 完成 N/N 个 feature，难点：..."。
便于我中途叫停或调整。

---

## 阶段 3：交叉关系

只在所有 feature 都填了 steps 之后做。

读所有 feature，找四类关系——**不要全写成 triggers**：

### 关系判别

- `triggers`（A 调 B 入口）：A 主动调 B 的接口
  - 例：前端按钮点击调后端 POST /users → 前端 feature triggers 后端 feature
  - 例：定时器到期调一个 service 函数

- `depends_on`（A 不调 B 但 B 不在 A 跑不起来）：
  - 例：lifespan 启动失败 → 所有 endpoint 都不可用，但只画 1-2 条代表性 depends_on，不要每个 feature 都画
  - 例：错误处理中间件是几乎所有 endpoint 的隐式依赖，画 1 条代表性边即可

- `publishes`（A 完成后发出事件 / 状态变更）★ **最容易漏的一类**：
  - 例：服务端某接口成功后发 `xxx_changed` 事件 → publishes
  - 例：业务操作完成后写消息到队列 → publishes
  - 例：状态机推进后通过 WebSocket 推送进度 → publishes
  - **如果项目有 WebSocket / 事件总线 / 消息队列 / 状态推送，几乎所有"产生事件的 feature"都要有 publishes**

- `subscribes`（B 监听 A 发出的事件作出反应）：
  - 例：前端 useEvents/useEffect 监听后端推送的事件 → subscribes
  - 例：另一个 service 用消息消费者监听上一个 service 发的事件 → subscribes

### 用户主导航流程

如果项目有清晰的页面跳转链（Gallery → PreRun → Running → Finished），
用 `triggers` 在对应 feature 之间画导航边。

### 比例自检

跑完一遍后看 cross_feature 里各 kind 的比例：

- 项目有 WebSocket / 事件总线 → publishes/subscribes 占比应 **≥ 30%**
- 全是 triggers（占比 > 80%）→ 你只看到了同步调用链，**漏了发布订阅模型**
- 没有 depends_on → 检查是否漏了 lifespan / 全局中间件 / 配置加载等隐式依赖

### 只画有代码线索的关系

模糊的关系不要写。"应该相关"不是依据。每条 cross_feature 都应当能在代码里指出具体的发出 / 订阅位置。

---

## 阶段 3.5：epic_flow（Epic 之间的主线）

在 cross_feature 写完后，站在全局视角分析 Epic 之间的宏观流向。

### 你要回答的问题

- 用户使用这个系统的**主线**是什么？（如：配置 → 运行 → 查看结果）
- 哪些 Epic 是**前置依赖**？（如：用户管理 → 所有业务 Epic）
- 哪些 Epic 之间有**先后顺序**？（如：下单 → 支付 → 发货）

### 写入 `epic_flow` 数组

```json
"epic_flow": [
  { "from": "config", "to": "runtime", "kind": "next", "note": "配置完成后才能运行仿真" },
  { "from": "runtime", "to": "analysis", "kind": "next", "note": "运行完成后查看分析结果" },
  { "from": "infra", "to": "runtime", "kind": "enables", "note": "基础设施就绪后运行才可用" }
]
```

### 三种 kind

- `next`：A 完成后自然进入 B（用户主流程的顺序）
- `depends_on`：B 依赖 A 存在才能工作（基础设施依赖）
- `enables`：A 使 B 成为可能（权限 / 前置条件）

### 硬约束

- **通常 3-8 条**，不要把所有 Epic 都连起来
- **只画用户能感知的主线**，不画"所有 Epic 都依赖基础设施"这种全连接
- **`note` 必须是中文语义短句**（如"配置完成后才能运行仿真"），不要写 `triggers` / `depends_on` 这种技术词
- **`note` 不能省略**——它是画布上显示的边标签，省略了用户看不懂这条线是什么意思

---

## 阶段 4：自检与漏洞回补

跑这个 checklist，命中任一条都要修：

### 覆盖度（漏没漏）

- [ ] **路由全表对照**：列出项目所有路由（HTTP / WebSocket / SSE / RPC），逐一对照 features.json，漏的补
- [ ] CLI 子命令是否全覆盖
- [ ] 定时任务 / 事件消费者 / 启动 / 关闭 hook 是否覆盖
- [ ] 前端**主导航链**是否在 cross_feature 中体现：列出页面跳转路径（A → B → C），用 `triggers` 边连起来
- [ ] **多 tab / 多面板 UI**：每个 tab 视觉上独立 → 至少一个 feature；不要把 5 个 tab 合并成 1 个 feature
- [ ] 客户端断线重连 / 缓存失效 / 离线兜底等"用户能感知的健壮性行为"是否独立成 feature

### 粒度（粗了细了）

- [ ] step 数 > 10 的 feature：尝试拆成 2 个
- [ ] step 数 < 3 的 feature：尝试合并或扩充
- [ ] **Feature vs Component 判别**：每个 feature 反问自己"这是用户用一句话说清楚的能力吗？"。如果它是"某 feature 内部的视觉子组件 / 内部辅助函数"，应当并入它所属的 feature 当 step

### step.name 硬约束

- [ ] 没有 ASCII 标识符（如 "推送 tick_advanced" / "构造 RECONNECT_BACKOFF_MS"）
- [ ] 没有函数调用形式（含括号 / 点号链）
- [ ] 没有事件名 / 类型名 / 常量名照搬
- [ ] 全部为中文动词短语

### 异步 / 发布订阅敏感度

- [ ] 项目有 WebSocket / SSE / 事件总线 / 消息队列时，**flow 中至少 20% 的边是 `async`**
- [ ] **cross_feature 中 publishes/subscribes 占比 ≥ 30%**（除非项目确实没有事件机制）
- [ ] 跨线程 / asyncio 队列 / call_soon_threadsafe / loop.run_in_executor 这种关键并发点，在对应 step 的 note 里说明
- [ ] react-query mutation / Promise 链 / await 序列化的多步业务逻辑，主链 next，**触发副作用的边用 async**

### 错误分支强制（最容易漏的一类）

对每个有外部输入 / 数据库 / 外部调用的 feature 走一遍：

- [ ] 参数校验失败 → 是否有 error 分支（如 ValueError → 400）
- [ ] 资源不存在 → 是否有 error 分支（如 run_id 不存在 → 404）
- [ ] 鉴权失败 → 是否有 error 分支（如 401 / 403）
- [ ] 依赖故障 → 是否有 error 分支（如外部接口超时 / 5xx）
- [ ] 业务规则失败 → 是否有 error 分支（如金额不足 / 状态非法 / 并发冲突 / 队列满）
- [ ] 降级路径 → 如果代码里有 try/except 走兜底逻辑，必须画 error 边
- [ ] 如确实不需要 error 分支（如纯查询且参数已严格校验），feature.note 写明原因

### conditional 强制

- [ ] 代码里 if/else 走不同动作的位置（如 wasPaused=true 跳过 auto-resume），是否在 flow 中用 `conditional`
- [ ] `conditional` / `loop` 的边都填了 `condition` 描述

### cross_feature 关系比例

- [ ] 不要全是 `triggers`。检查：
      - "A 完成后发出事件，B 监听" → 用 `publishes` + `subscribes`
      - "A 不调 B 但 B 不在 A 跑不起来" → 用 `depends_on`
- [ ] 隐式全局依赖（如错误处理中间件）：只画 1-2 条代表性 `depends_on`，不要每个 feature 都画

### confidence 真实性

- [ ] 不要超过 70% 的 feature 都是同一个 confidence 值（默认值惯性）
- [ ] 跨线程 / 反射 / 配置驱动 / 异步副作用相关的 feature ≤ 0.7
- [ ] 简单 CRUD / 单文件函数 + 路由的 feature 应当 ≥ 0.9

### tags 真实状态

- [ ] 已知"未实施 / 占位 / TODO"代码段，对应 feature 加 `tags: ['unverified']` 或 `['future']`
- [ ] 已知废弃但未删除的功能加 `tags: ['deprecated']`

### 结构正确性

- [ ] flow 没有死路（某 step 没出边，但又不是 output/error）
- [ ] flow 没有自环
- [ ] 任何 step.name 含代码标识符？改成中文动词短语

写完后用人话简短总结：

```
- N 个 epic / M 个 feature / 平均 K 个 step
- 难点 / 不确定的 feature（按 confidence 升序列前 5 个）
- 已知漏洞：哪些动态路由 / 配置驱动没法准确捕获
- 建议人工复核：哪些 feature 应该锁定（locked: true）
```

---

## 阶段 5：校验

写入完成后，执行：

```bash
node .codesee/scripts/validate-features.mjs
```

退出码 1 时**必须按报错修复**并再跑一次，循环直到通过。
警告（如 step 名字不规范、孤立步骤）也建议修，除非用户明示忽略。

---

## Token 与节奏建议

- 每读一组文件就停下来想"这一段属于哪个 feature 的哪一步"，避免读了一堆但写不出来
- 累计已生成文本超过 8KB 时主动落盘到 features.json，避免上下文丢失
- 不确定的细节优先**问我**，再不行写 confidence ≤ 0.6 + tags 含 `unverified`

## 完整 Schema

参见 `.codesee/prompts/scan-light.md` 末尾的 Schema 块（与本 prompt 共用）。
