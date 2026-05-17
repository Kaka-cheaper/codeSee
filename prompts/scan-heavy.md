# CodeSee · 扫描 · 重型项目

> 前置：已读 `scan.md` 并判断为重型。
> 参考：`_schema.md`（schema + 示例）、`_rules.md`（约束分级）

---

## 总体策略

```
阶段 1：建索引（只列骨架）
阶段 2：分块深入（一次一个 epic）
阶段 3：交叉关系 + epic_flow
阶段 4：自检
阶段 5：校验
```

每阶段开始前告诉我即将做什么，结束时告诉我做了什么。
不确定的地方**问我**——重型项目里反问比硬猜更值钱。

---

## 阶段 1：建索引

**只读不写 step/flow。**

1. 读 README、顶层配置、目录结构、路由入口
2. 划 Epic（5-12 个）：
   - 给 `order`（阶段编号，同阶段共享）
   - 可选给 `importance`
3. 列 Feature 骨架（只填 id/name/summary/epicId/triggers/tags，steps=[], flow=[]）
4. 写入 `.codesee/features.json`

报告：N epic、M feature 骨架。

---

## 阶段 2：分块深入

一个 epic 一个 epic 处理。按 feature 数从少到多。

**本阶段需要的规则**（见 `_rules.md`）：
- MUST #4：step.name 中文动词短语
- MUST #2：flow.kind 必填
- SHOULD #1-3：error 分支 / async / conditional

每个 feature：
1. 读入口 → 追依赖 → 写 steps + flow（动作链，不是调用链）
2. 3-10 个 step
3. 挂 refs（每 step 至少 1 条）
4. 更新到 features.json

**边界情况**：
- 组件 vs feature：反问"用户一句话能说清吗？"
- 多 tab UI：每 tab 至少一个 feature
- 共享中间件：不单独建 feature，在各 feature 里以同名 step 出现
- 客户端健壮性（断线重连等）：独立成 feature

每完成一个 epic 报告："epic X 完成 N/N，难点：..."

---

## 阶段 3：交叉关系 + epic_flow

**本阶段需要的规则**：
- SHOULD #4：cross_feature 不要全是 triggers
- 有事件机制 / 数据流转 → 必须有 `flow` 关系（异步加 `mode="async"`）

### cross_feature

三种 kind：`triggers` / `flow` / `depends_on`（v0.2 简化）
- 用户导航链 / 主动调用 → `triggers`
- 数据/事件流转（A 产出 → B 消费）→ `flow`，异步用 `mode="async"`
- 基础设施依赖（必须先存在，不一定运行时调用）→ `depends_on`（1-2 条代表性的）
- 见 `_schema.md` 的 cross_feature 关系判别表
- ❌ 不要写 `publishes` / `subscribes`——已合并为 `flow`，方向由 `from→to` 表达

### epic_flow

- 站在用户视角画主线（3-8 条）
- 两种 kind：`next`（用户旅程下一步）/ `depends_on`（A 依赖 B 先存在）
- note 必填，中文语义短句
- ❌ 不要写 `enables`——若想表达"A 让 B 成为可能"，改写为 `B depends_on A`

---

## 阶段 4：自检

- [ ] 路由全表对照（漏的补）
- [ ] CLI / 定时任务 / 事件消费者覆盖
- [ ] step.name 全是中文动词短语
- [ ] flow.kind 全部填写
- [ ] 有 async 边
- [ ] 有 error 分支
- [ ] confidence 不全是同一个值
- [ ] cross_feature 不全是 triggers
- [ ] epic_flow.note 全部填写

---

## 阶段 5：校验

```bash
node .codesee/scripts/validate-features.mjs
```

退出码 1 → 修复后重跑，直到通过。

总结：N epic / M feature / 平均 K step / 难点 / 不确定的地方。

---

## Token 节奏

- 累计 8KB 时主动落盘
- 不确定优先问我
- 每阶段结束时确认再继续
