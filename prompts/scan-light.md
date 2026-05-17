# CodeSee · 扫描 · 轻型项目

> 前置：已读 `scan.md` 并判断为轻型。
> 参考：`_schema.md`（schema + 示例）、`_rules.md`（约束分级）

---

## 执行步骤

### 1. 通读项目

用 IDE 工具读 README、路由表、CLI 入口、定时任务、UI 主页面。
一遍读完建立心智模型，不要边读边写。

### 2. 划 Epic

- 3-6 个，用户语言的"模块"
- 给 `order`（阶段编号，同阶段共享，不要全递增）
- 可选给 `importance`（core/auxiliary）

### 3. 抽 Feature

- 一个端点 ≈ 一个 feature，CRUD 各拆开
- 后台任务、定时器、事件订阅、CLI、UI 关键操作都算
- 反问："用户一句话能说清吗？" 说不清 → 是组件不是 feature

### 4. 写 steps + flow

- 3-10 个 step，中文动词短语
- flow.kind 必填（见 `_rules.md` MUST #2）
- 异步副作用 → async；条件分支 → conditional + condition；错误 → error
- 每个有外部输入的 feature 至少思考一条 error 分支

### 5. 挂 refs

每个 step 至少 1 条 file 引用（SHOULD）。

### 6. cross_feature

- 三种 kind：`triggers` / `flow` / `depends_on`（v0.2，原 publishes/subscribes 已合并到 flow）
- 用户导航链用 `triggers` 串起来
- 数据流转 / 事件通知 / 异步副作用 → `kind="flow"`，异步加 `mode="async"`
- 静态依赖（必须先存在才能用，但不一定运行时调用）→ `depends_on`
- 见 `_schema.md` 的 cross_feature 关系判别表

### 7. epic_flow

- 站在用户视角画 Epic 之间的主线（3-8 条）
- 优先用 `next`（用户旅程下一步）
- note 必填，中文语义短句

### 8. confidence

- ≥ 0.9：简单 CRUD
- 0.7-0.85：跨多文件但清晰
- 0.5-0.7：动态/异步/跨线程
- < 0.5：仅凭命名猜

## 自检

- [ ] step.name 全是中文动词短语
- [ ] flow.kind 全部填写
- [ ] 有 async 边（如果项目有异步）
- [ ] 有 error 分支（如果有外部输入）
- [ ] confidence 不全是同一个值
- [ ] epic_flow.note 全部填写

## 完成

1. 写入 `.codesee/features.json`
2. 跑 `node .codesee/scripts/validate-features.mjs`，退出码 1 必须修
3. 简短总结：N epic / M feature / 难点 / 不确定的地方
