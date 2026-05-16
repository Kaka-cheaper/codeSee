# CodeSee · 扫描 · SDD 模式（Spec-Driven Development）

> 前置：项目使用 Spec-Driven Development 框架（spec-kit / Trellis / BMAD / Superpowers / Agent OS / Spec Kit Plus 等）。
> 优势：直接从 spec / PRD / tasks 文档**正向投影**到 features.json，不读源码、不做反向工程。
> 参考：`_schema.md`、`_rules.md`

---

## 适用场景

项目根目录存在以下任一目录（按检测优先级）：

```
.specify/                 GitHub Spec Kit (18.6k★)
.trellis/                 Mindfold Trellis (8k★)
.bmad-core/ 或 bmad/      BMAD-METHOD (14.9k★)
.agents/skills/           SKILL.md 标准（agentskills.io）跨平台
.agent-os/                Builder Methods Agent OS
docs/specs/ + docs/prds/  通用 SDD 约定
```

不在此列表？只要项目有结构化的 spec/PRD 文档（如 `docs/architecture.md` + `docs/prd/*.md`），也走本模式。

## 为什么走 SDD 模式

```
代码扫描（scan-light / scan-heavy） → 反向工程
  - 从函数 / 类 / 路由倒推语义
  - 容易丢失"为什么"
  - 容易把脚手架代码误认为业务功能

SDD 模式 → 正向投影
  - 从用户写好的 spec / PRD 直接读取意图
  - 粒度天然对齐（task ≈ feature，spec section ≈ epic）
  - 准确率高、token 省、refs 精确
```

如果项目同时有代码和 SDD 文档，**优先用 SDD 模式**，refs 字段补上对应代码文件。

## 执行步骤

### 第零步：确认输出语言

同 `scan.md`：询问用户希望用什么语言写语义文本，写入 `manifest.lang`，默认 `zh-CN`。

### 第一步：识别 SDD 框架与目录约定

根据检测到的目录使用对应的提取规则：

#### A. spec-kit（`.specify/`）

```
.specify/
├── memory/               项目级常量（架构、技术栈、约束）
└── specs/<feature-id>/   每个 feature 一个目录
    ├── spec.md           需求规范
    ├── plan.md           技术方案
    └── tasks.md          实施任务列表
```

提取规则：
- `memory/` → 用于推断 Epic 划分（按业务域 / 子模块）
- 每个 `specs/<feature-id>/` → 一个 Feature
  - `spec.md` 顶部章节 → feature.name + summary
  - `spec.md` 的 acceptance criteria / user stories → 派生 steps
  - `tasks.md` 中按顺序的 task → 补充 steps（如果 spec.md 不够细）
  - `plan.md` 提到的文件路径 → step.refs

#### B. Trellis（`.trellis/`）

```
.trellis/
├── spec/                 团队规范（按业务域分目录）
├── tasks/<MM-DD-name>/   每个任务一个目录
│   ├── task.json         元数据（status / branch）
│   ├── prd.md            需求文档
│   ├── implement.jsonl   实现上下文
│   └── check.jsonl       验证上下文
├── workspace/            developer journals
└── workflow.md           工作流定义
```

提取规则：
- `spec/<domain>/` 子目录名 → Epic（如 `spec/auth/` → "认证" Epic）
- 每个 `tasks/<MM-DD-name>/prd.md` → 一个 Feature
  - prd.md 顶部 → feature.name + summary
  - prd.md 中的 step / phase → steps
  - `task.json.status` → 决定 tags（active / done / archived）
  - 已 archive 的 task → 可选纳入历史 feature（confidence 标 0.6）

#### C. BMAD-METHOD（`.bmad-core/` 或 `bmad/`）

```
bmad-core/
├── agents/               BMAD 角色定义（Analyst / PM / Architect / SM / Dev 等）
├── workflows/
└── stories/<epic>/<story>.md   或 docs/stories/

docs/
├── prd.md / brief.md     高层 PRD
├── architecture.md
└── stories/              用户故事
```

提取规则：
- `docs/prd.md` 顶层章节 → Epics
- `docs/stories/<epic-id>.<story-id>.md` → Features
  - story 标题 → feature.name
  - acceptance criteria → 派生 steps
  - story 中提到的文件 → step.refs

#### D. Agent Skills（`.agents/skills/`）

```
.agents/skills/<skill-name>/
└── SKILL.md              YAML frontmatter + Markdown 指令
```

提取规则：
- 每个 SKILL.md 是一个**能力**而非 feature——通常用作辅助
- 仅在没有其他 SDD 来源时使用：把每个 skill 当成 Feature 候选，让用户复核

#### E. 通用 SDD（`docs/specs/`、`docs/prds/`）

按目录结构推断，无强约定。

#### F. 都没检测到

回到 `scan.md` 走 light / heavy / planning 路径。

### 第二步：通读所有 spec / PRD 文档

不要边读边写。先建立全局心智模型，再开始产出。

### 第三步：产出 features.json

按以下顺序：

1. **Epic** — 来自 spec 目录结构 / 项目顶层文档章节
   - 给 `order`（用户旅程阶段）
   - 可选 `importance`

2. **Feature** — 一个 spec 目录 / 一个 task PRD = 一个 Feature
   - feature.name 来自文档标题
   - summary 来自文档第一段
   - confidence：
     - 1.0：用户明确写过的、status=done
     - 0.85：spec 完整、status=in-progress
     - 0.5：仅有标题、status=planned
   - tags：
     - `'planned'`：尚未实现（status != done，或 plan/tasks 为空）
     - `'sdd'`：来自 SDD 文档源（标记数据来源）

3. **Steps + Flow** — 来自 PRD 的 acceptance criteria / tasks / phases
   - 即使原文是"实现 X 模块"这样的实现语言，也要翻译成"动作短语"（见 `_rules.md` MUST #4）
   - flow.kind 必填
   - 异步 / 错误 / 条件分支按 `_rules.md` SHOULD 处理

4. **refs** — 来自 spec/plan 中提到的源码文件
   - 如果 spec 没提，留空
   - 不要凭空猜文件路径

5. **cross_feature** — 来自 spec 互相 reference 或 task 依赖关系
   - Trellis：task.json 中可能有 dependencies
   - spec-kit：plan.md 中可能 reference 其他 spec

6. **epic_flow** — Epic 间的用户旅程主线
   - 优先从 README / overview.md / architecture.md 推断
   - 找不到就按常识（Auth → 业务核心 → 报表/管理）

### 第四步：标注数据来源

manifest 中加入提示：

```json
"manifest": {
  "lang": "zh-CN",
  "generator": "ai@<model> via SDD/<framework-name>",
  "generated_at": "..."
}
```

让用户知道这份 features.json 来自哪个 SDD 源。

## 自检

- [ ] 每个 feature 都能追溯到一个具体的 spec/PRD 文件
- [ ] step.name 全是动词短语，没有"实现 X""开发 Y"这种实现语言
- [ ] flow.kind 全部填写
- [ ] confidence 不全是同一值
- [ ] 标记 `'sdd'` tag，让用户知道来源
- [ ] 未实现的 feature 标记 `'planned'`

## 完成

1. 写入 `.codesee/features.json`
2. 跑 `node .codesee/scripts/validate-features.mjs`
3. 简短总结：
   - 检测到的 SDD 框架 / 目录
   - N 个 epic / M 个 feature 来自 X 个 spec 文件
   - 哪些 feature 是 planned / 哪些是 implemented

## 之后怎么办

- 用户改了 spec 或代码 → 触发 `sync.md`（场景 B 走 git diff，场景 C 处理 planned → implemented）
- 用户加了新 task/spec → 增量加 feature，refs 补上
- spec 删除 → feature 标 `tags: ['deprecated']`，不直接删

## 重要约束

**永远不读源码超过必要范围**——SDD 模式的核心价值就是不做反向工程。如果 spec 缺失或写得差，**告诉用户"建议补 spec X"** 而不是去读代码补。
