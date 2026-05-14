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

## 阶段 1：建索引

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
- 写出"如果出错怎么办"：超时、外部调用失败、并发冲突等关键错误分支用 `flow.kind=error`
- 异步副作用必须用 `flow.kind=async`，不要假装是同步

### 2.4 边界情况协议

- **路由是动态生成的**（配置驱动、装饰器扫描）：在 feature.note 标"动态注册，未必完整"，confidence ≤ 0.6
- **同一段代码被多个 feature 共享**（中间件、auth、log）：不要为它单独建 feature，让它在每个 feature 里以同名 step 出现，role 标 `auth` / `validation` 等
- **生成代码 / 编译产物**：忽略（dist/build/generated）
- **测试代码**：默认忽略；除非用户明确说要

### 2.5 阶段 2 阶段性报告

每完成一个 epic 简短报告："epic X 完成 N/N 个 feature，难点：..."。
便于我中途叫停或调整。

---

## 阶段 3：交叉关系

只在所有 feature 都填了 steps 之后做。

读所有 features.json 的 feature，找：

- A 完成后会发出消息/事件 → 写 `cross_feature.kind = publishes`
- A 是 B 的前置依赖 → `depends_on`
- A 主动调用 B 的入口 → `triggers`

每条 cross_feature 必须有可指明的代码线索。**模糊就不要写。**

---

## 阶段 4：自检与漏洞回补

跑这个 checklist，命中任一条都要修：

- [ ] 是否有路由没被任何 feature 覆盖？（用工具列全路由再对照）
- [ ] 是否有定时任务、消息消费者、CLI 子命令、startup hook 没被覆盖？
- [ ] 任何 feature 的 steps 数 > 12？拆成 2 个
- [ ] 任何 feature 的 steps 数 < 2？合并或丢弃
- [ ] flow 是否有死路（某 step 没出边，但又不是 output/error）？
- [ ] 任何 step.name 含代码标识符？改成动词短语

写完后用人话简短总结：

```
- N 个 epic / M 个 feature / 平均 K 个 step
- 难点 / 不确定的 feature（按 confidence 升序列前 5 个）
- 已知漏洞：哪些动态路由 / 配置驱动没法准确捕获
- 建议人工复核：哪些 feature 应该锁定（locked: true）
```

---

## Token 与节奏建议

- 每读一组文件就停下来想"这一段属于哪个 feature 的哪一步"，避免读了一堆但写不出来
- 累计已生成文本超过 8KB 时主动落盘到 features.json，避免上下文丢失
- 不确定的细节优先**问我**，再不行写 confidence ≤ 0.6 + tags 含 `unverified`

## 完整 Schema

参见 `.codesee/prompts/scan-light.md` 末尾的 Schema 块（与本 prompt 共用）。
