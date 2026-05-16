# CodeSee · 增量同步

> 每轮代码改动后执行。基于 git diff 或当前完成的功能更新 `.codesee/features.json`。
> 参考：`_schema.md`、`_rules.md`

---

## 场景判断

根据当前 features.json 状态选择策略：

### 场景 A：从 0 开发（features.json 为空或只有少量 feature）

你刚帮用户写完一个新功能。不需要 diff——你完全知道刚才写了什么。

1. 直接把刚完成的功能作为新 feature 加入
2. 如果涉及新的业务领域，同时新建 Epic
3. 如果和已有 feature 有关系，补 cross_feature
4. 更新 epic_flow（如果 Epic 结构变了）

优势：你刚写完代码，上下文完整，step 粒度和 refs 都能精确到行。

### 场景 B：改动已有项目

1. 读 `.codesee/features.json`（注意 `manifest.lang` 确定输出语言）
2. 读 `git diff HEAD~1`（或 `git status` + `git diff`）
3. 推断受影响的 feature/step
4. 输出最小变更，覆盖写入

### 场景 C：从规划阶段进入实现

如果 features.json 中存在 `tags: ['planned']` 的 feature，且你刚实现了其中之一：

1. 找到对应的 planned feature
2. 移除 `tags` 中的 `'planned'`（保留其他 tags）
3. 补上真实的 refs（指向你刚写的代码）
4. 把 confidence 从 0.3 升到合理值（0.9+ 如果是简单 CRUD）
5. 把粗粒度的 step 细化（3-6 → 5-10）
6. 补上 error 分支（规划阶段允许略过的）

未实现的 planned feature 保持原状，画布上一眼能区分"已实现 vs 规划中"。

## Checkpoint 协议（重要）

**问题**：用户给的任务可能很大（"实现整个购物车模块"），涉及 20+ 文件。如果等到全部写完才 sync，上下文已经被代码稀释，容易遗漏功能、粒度跑偏、refs 不准。

**协议**：把大任务拆成 checkpoint，**每个逻辑闭环完成立即 sync**。

### 什么是"逻辑闭环"

一个用户能感知的、可独立验证的小功能。例子：
- ✓ "添加购物车 API + 数据库表 + 前端按钮" = 1 个闭环
- ✓ "结算流程的下单步骤" = 1 个闭环
- ✗ "购物车整个模块" = 太大，应拆成多个闭环
- ✗ "数据库 schema 改完" = 不够，没法独立验证

### 执行流程

```
任务开始
  ↓
实现闭环 1（写代码 + 自测）
  ↓
[checkpoint 1] sync features.json，加入这个 feature
  ↓
实现闭环 2
  ↓
[checkpoint 2] sync features.json
  ↓
... 继续直到任务全部完成
  ↓
[最终核查] 整体一致性检查
```

### 最终核查步骤

任务全部完成后，**不要直接回复用户"完成"**。先做一次整体核查：

1. **覆盖度检查**：本次任务涉及的所有用户可感知功能，是否都进了 features.json？漏了哪个？
2. **关系检查**：新增 feature 之间、新增 feature 和已有 feature 之间，是否有遗漏的 cross_feature？
3. **epic_flow 检查**：本次任务有没有改变用户旅程的主线？epic_flow 是否需要更新？
4. **refs 准确性**：每个 step 的 refs 是否真的指向对应的代码？文件路径有没有写错？
5. **跑校验器**：`node .codesee/scripts/validate-features.mjs`，错误必须 0
6. **总结报告**：告诉用户 checkpoint 数 / 总 feature 数 / 是否所有 feature 都通过校验

### 何时跳过 checkpoint

- 任务很小（单文件改动、单功能调整）→ 直接最终核查就行
- 纯样式/重构/重命名 → 不需要 sync
- 用户明确说"先全部写完再统一更新"→ 按用户要求

## 通用约束

- **只动受影响的 feature**，其他一字不改
- **不改 locked: true 的 feature**（提醒用户复核）
- **不重命名既有 id**（废弃用 `tags: ['deprecated']`）
- 新增 feature 标 `provenance: 'ai'`
- step.name 必须用 manifest.lang 指定的语言写动词短语（见 `_rules.md` MUST #4）
- flow.kind 必填（MUST #2）
- 异步 → async；条件 → conditional；错误 → error

## epic_flow 维护

Epic 增删或主线变化时更新 epic_flow。
优先 `next`，note 必填，用 manifest.lang 指定的语言写语义短句。
不要因小改动重写整个 epic_flow。

## 完成

1. 覆盖写入 `.codesee/features.json`
2. 跑 `node .codesee/scripts/validate-features.mjs`，退出码 1 必须修
3. 变更摘要：新增 / 修改 / 删除 / planned → implemented 了什么

## 边界情况

- 纯样式/重构：不改 features.json，说明"非语义改动"
- 跨多 feature：分别更新
- 新文件未接入：不追加，只在总结里提
- 删除功能代码：标 `deprecated`，不直接删
