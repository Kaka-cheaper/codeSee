# CodeSee · 增量同步

> 每轮代码改动后执行。基于 git diff 更新 `.codesee/features.json`。
> 参考：`_schema.md`、`_rules.md`

---

## 步骤

1. 读 `.codesee/features.json`
2. 读 `git diff HEAD~1`（或 `git status` + `git diff`）
3. 推断受影响的 feature/step
4. 输出最小变更，覆盖写入

## 约束

- **只动受影响的 feature**，其他一字不改
- **不改 locked: true 的 feature**（提醒我复核）
- **不重命名既有 id**（废弃用 tags: ['deprecated']）
- 新增 feature 标 `provenance: 'ai'`
- step.name 必须中文动词短语（见 `_rules.md` MUST #4）
- flow.kind 必填（MUST #2）
- 异步 → async；条件 → conditional；错误 → error

## epic_flow 维护

Epic 增删或主线变化时更新 epic_flow。
优先 `next`，note 必填中文语义短句。
不要因小改动重写整个 epic_flow。

## 完成

1. 覆盖写入 `.codesee/features.json`
2. 跑 `node .codesee/scripts/validate-features.mjs`，退出码 1 必须修
3. 变更摘要：新增/修改/删除了什么

## 边界情况

- 纯样式/重构：不改 features.json，说明"非语义改动"
- 跨多 feature：分别更新
- 新文件未接入：不追加，只在总结里提
- 删除功能代码：标 deprecated，不直接删
