<!-- BEGIN: CodeSee integration -->
## CodeSee 功能图维护

本项目接入了 CodeSee — 把功能逻辑以语义流程图呈现的工具。

### 触发规则

**触发 1：首次扫描**
若 `.codesee/features.json` 不存在或缺少 `version` 字段：
→ 执行 `.codesee/prompts/scan.md`（会自动判断走 light / heavy / planning 哪一档）

**触发 2：每轮代码改动后**
完成改动后，在回复用户前主动：
→ 执行 `.codesee/prompts/sync.md`

跳过条件：纯样式/重构/重命名（无语义变化），或用户明确要求跳过。

**触发 3：用户显式要求**
"刷新功能图""更新 codesee""扫一下" → 按上述策略执行。

### 项目阶段

- **SDD 项目**（有 `.specify/`、`.trellis/`、`.bmad-core/` 等 spec-driven 目录）→ 走 sdd 模式，从 spec/PRD 正向投影
- **规划阶段**（只有文档）→ 走 planning 模式，产出 `tags: ['planned']` 的功能图
- **实现阶段**（有代码）→ 走 light/heavy 模式，产出正式功能图
- **混合阶段**（部分实现）→ sync 自动把 `planned` 升级为 `implemented`

### Checkpoint 协议

大任务（涉及 5+ 文件）必须拆 checkpoint，每完成一个逻辑闭环立即 sync，不要等全部写完才一次性更新。全部完成后做最终整体核查（覆盖度、关系、epic_flow、refs、校验器）。详见 `.codesee/prompts/sync.md`。

### 核心约束

- ❌ 不修改 `.codesee/prompts/` 与 `.codesee/scripts/` 下的文件
- ❌ 不修改 `locked: true` 的 feature
- ❌ 不重命名既有 id（废弃用 tags: ['deprecated']）
- ❌ 不跳过校验（`node .codesee/scripts/validate-features.mjs`）
- ✓ step.name 必须中文动词短语，不要写代码标识符
- ✓ flow.kind 必填，不能省略
- ✓ 写入后必须跑校验，退出码 1 必须修复

### 参考文件

- Schema + 示例：`.codesee/prompts/_schema.md`
- 规则详情：`.codesee/prompts/_rules.md`
- 扫描：`.codesee/prompts/scan.md`
- 同步：`.codesee/prompts/sync.md`
- 校验：`.codesee/scripts/validate-features.mjs`
- 数据：`.codesee/features.json`
- Hooks（可选自动提醒）：`.codesee/hooks/README.md`

> 执行 scan/sync 前先告诉用户你要做什么。
<!-- END: CodeSee integration -->
