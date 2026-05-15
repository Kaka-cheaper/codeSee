# AGENTS.md — CodeSee 集成

> AI 协作开发的入口规则。Cursor / Claude Code / Kiro 等 IDE 会自动读取。

---

## 关于本项目

先读 `README.md` 了解业务背景。

## CodeSee 功能图

本项目用 CodeSee 把功能逻辑以语义流程图呈现。
数据在 `.codesee/features.json`，由你（AI）维护。

### 触发规则

**触发 1：首次扫描**
若 `.codesee/features.json` 不存在或缺少 `version` 字段：
→ 执行 `.codesee/prompts/scan.md`

**触发 2：每轮代码改动后**
完成改动后，在回复用户前主动：
→ 执行 `.codesee/prompts/sync.md`

跳过条件：纯样式/重构/重命名，或用户明确要求跳过。

**触发 3：用户显式要求**
"刷新功能图""更新 codesee""扫一下" → 按上述策略执行。

### 核心约束

- ❌ 不修改 `.codesee/prompts/` 与 `.codesee/scripts/` 下的文件
- ❌ 不修改 `locked: true` 的 feature
- ❌ 不重命名既有 id（废弃用 tags: ['deprecated']）
- ❌ 不跳过校验
- ✓ step.name 必须用 manifest.lang 指定的语言写动词短语
- ✓ flow.kind 必填
- ✓ 写入后跑 `node .codesee/scripts/validate-features.mjs`，退出码 1 必须修

### 参考文件

- Schema + 示例：`.codesee/prompts/_schema.md`
- 规则详情：`.codesee/prompts/_rules.md`
- 扫描：`.codesee/prompts/scan.md`
- 同步：`.codesee/prompts/sync.md`
- 校验：`.codesee/scripts/validate-features.mjs`

> 执行 scan/sync 前先告诉用户你要做什么。
