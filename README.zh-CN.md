<div align="center">

<img src="./docs/assets/banner.png" alt="CodeSee Banner" width="100%" />

# CodeSee

**AI 写代码，你看故事。**

面向 AI 协作开发的功能级画布。AI 维护项目的语义流程图——你不用逐行读代码就能掌控全局。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Demo](https://img.shields.io/badge/在线演示-▶-brightgreen.svg)](https://Kaka-cheaper.github.io/codeSee/)
[![English](https://img.shields.io/badge/Lang-English-red.svg)](./README.md)
[![LINUX DO](https://img.shields.io/badge/LINUX-DO-FFB003.svg?logo=data:image/svg%2bxml;base64,DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik00Ni44Mi0uMDU1aDYuMjVxMjMuOTY5IDIuMDYyIDM4IDIxLjQyNmM1LjI1OCA3LjY3NiA4LjIxNSAxNi4xNTYgOC44NzUgMjUuNDV2Ni4yNXEtMi4wNjQgMjMuOTY4LTIxLjQzIDM4LTExLjUxMiA3Ljg4NS0yNS40NDUgOC44NzRoLTYuMjVxLTIzLjk3LTIuMDY0LTM4LjAwNC0yMS40M1EuOTcxIDY3LjA1Ni0uMDU0IDUzLjE4di02LjQ3M0MxLjM2MiAzMC43ODEgOC41MDMgMTguMTQ4IDIxLjM3IDguODE3IDI5LjA0NyAzLjU2MiAzNy41MjcuNjA0IDQ2LjgyMS0uMDU2IiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZWNlY2VjO2ZpbGwtb3BhY2l0eToxIi8+PHBhdGggZD0iTTQ3LjI2NiAyLjk1N3EyMi41My0uNjUgMzcuNzc3IDE1LjczOGE0OS43IDQ5LjcgMCAwIDEgNi44NjcgMTAuMTU3cS00MS45NjQuMjIyLTgzLjkzIDAgOS43NS0xOC42MTYgMzAuMDI0LTI0LjM4N2E2MSA2MSAwIDAgMSA5LjI2Mi0xLjUwOCIgc3R5bGU9InN0cm9rZTpub25lO2ZpbGwtcnVsZTpldmVub2RkO2ZpbGw6IzE5MTkxOTtmaWxsLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Ik03Ljk4IDcwLjkyNmMyNy45NzctLjAzNSA1NS45NTQgMCA4My45My4xMTNRODMuNDI2IDg3LjQ3MyA2Ni4xMyA5NC4wODZxLTE4LjgxIDYuNTQ0LTM2LjgzMi0xLjg5OC0xNC4yMDMtNy4wOS0yMS4zMTctMjEuMjYyIiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZjlhZjAwO2ZpbGwtb3BhY2l0eToxIi8+PC9zdmc+)](https://linux.do/)

[![Spec Kit](https://img.shields.io/badge/Spec_Kit-兼容-blue)](https://github.com/github/spec-kit)
[![Trellis](https://img.shields.io/badge/Trellis-兼容-orange)](https://github.com/mindfold-ai/Trellis)
[![BMAD](https://img.shields.io/badge/BMAD-兼容-purple)](https://github.com/bmad-code-org/BMAD-METHOD)
[![SKILL.md](https://img.shields.io/badge/SKILL.md-标准-green)](https://agentskills.io/)

</div>

---

> 类比：如果一个功能是"西红柿炒鸡蛋"，
> 画布展示的是"备菜 → 打蛋 → 热油 → 下锅 → 调味 → 出锅"，
> 而不是"`prepare()` 调用 `slice()` 再调用 `whisk()`"。

不是调用图，不是 import 图——是人类可读的"这个项目在做什么"的故事。

<div align="center">
<img src="./docs/assets/overview.png" alt="概览视图" width="80%" />
<p><em>概览视图 — Epic 按用户旅程顺序排列，语义流程箭头连接</em></p>
</div>

<details>
<summary><strong>▶ 更多视图（功能 / 流程）</strong></summary>

<div align="center">
<img src="./docs/assets/features.png" alt="功能视图" width="80%" />
<p><em>功能视图 — Feature 按 Epic 分组在容器内，可拖动调整</em></p>
</div>

<div align="center">
<img src="./docs/assets/steps.png" alt="流程视图" width="80%" />
<p><em>流程视图 — 单个 Feature 内的有向流程（异步、条件、错误分支）</em></p>
</div>

</details>

---

## 为什么需要这个

和 AI 协作写代码时：

- 🤯 **AI 五分钟写 5000 行** — 但你需要几个小时才能全部审完
- 🔍 **你需要理解的是逻辑，不是语法** — "这个功能做了什么"比"哪个函数调了哪个"重要得多
- 🐛 **出了 bug 要追全链路** — 但链路可能跨 20 个你从没看过的文件
- 😤 **你失去了对项目的掌控感** — 项目增长的速度超过了你理解它的速度

CodeSee 解决这个问题：AI 写代码的同时也写功能地图。你看到的是故事，不是语法。

---

## 核心能力

| 能力 | 描述 |
| ---- | ---- |
| **语义流程图** | 三层下钻：Epic → Feature → Step。看到的是"做什么"和"为什么"，不是"怎么实现"。 |
| **AI 自动维护** | 每次代码改动后 AI 更新 `features.json`。无需手动画图。兼容任何 AI IDE。 |
| **交互式画布** | 拖动、缩放、撤销/重做、自动保存布局。暖白主题，适合长时间审查。 |
| **实时刷新** | 打开 Live 开关 — viewer 每 3 秒轮询 `features.json`，自动刷新画布并对新节点做淡入动画。看着图随 AI 工作生长。 |
| **零锁定** | 纯 JSON 文件。人类可读、可 git diff、可锁定。随时切换 AI 供应商。 |
| **增量同步** | 每次改动只更新受影响的 feature。图随项目生长。 |
| **内置校验** | 校验器自动捕获 schema 违规、幻觉枚举值、结构问题。 |
| **多语言** | UI 支持中英文切换。语义文本语言通过 `manifest.lang` 配置。 |
| **SDD 兼容** | 自动检测 `.specify/`、`.trellis/`、`.bmad-core/`、`.agents/skills/`，直接消费 spec/PRD 文档——不再反向工程源码。 |
| **SKILL.md 标准** | 遵循 [agentskills.io](https://agentskills.io/) 跨平台 skill 标准——Claude Code / Cursor / Codex / Gemini CLI / Copilot 等 20+ 平台开箱即用。 |

---

## 快速开始

### 1. 安装到你的项目

```powershell
# Windows
.\scripts\install.ps1 D:\path\to\your\project

# macOS / Linux
./scripts/install.sh /path/to/your/project
```

这会把 `AGENTS.md` + `.codesee/`（prompts、校验器）注入到你的项目。

### 2. 让 AI 扫描

在你的项目里打开任意 AI IDE（Cursor / Claude Code / Kiro / Copilot / Codex / Gemini CLI / ...）。
AI 读取 `AGENTS.md`（或 SKILL.md 兼容 IDE 读取 `.agents/skills/codesee/SKILL.md`）后自动生成 `.codesee/features.json`。

如果你的项目使用 SDD 框架（`.specify/`、`.trellis/`、`.bmad-core/` 等），CodeSee 会自动检测并直接消费 spec/PRD 文档——不需要扫描源码。

### 3. 查看画布

```bash
cd codeSee/viewer
npm install
npm run dev
```

打开 `http://localhost:5173/`，把 `.codesee/features.json` 拖进去。

---

## 工作原理

```
你的项目/                                  CodeSee Viewer/
├── AGENTS.md                  ←────────── templates/AGENTS.md
├── .agents/skills/codesee/    ←────────── templates/SKILL.md（跨平台 skill）
│   └── SKILL.md
├── .codesee/                              viewer/
│   ├── prompts/*.md           ←────────── prompts/*.md（scan / scan-sdd / sync / ...）
│   ├── scripts/               ←────────── scripts/validate-features.mjs
│   ├── features.json          ──────────→ 拖入 viewer
│   └── layout.json            ←────────── viewer 保存（File System Access API）
└── 你的代码（或 .specify / .trellis / .bmad-core / ... SDD 项目）
```

| 层 | 内容 | 谁维护 |
| -- | ---- | ------ |
| `features.json` | 语义流程（epic、feature、step、关系） | AI + 人工审查 |
| `layout.json` | 画布上的节点位置 | 用户拖动 + 自动保存 |
| Viewer | 渲染、交互、布局算法 | 本仓库 |

---

## 三种视图

| 视图 | 展示 | 交互 |
| ---- | ---- | ---- |
| **概览** | Epic 节点 + `epic_flow` 主线箭头 | 拖动排列；双击进入功能视图 |
| **功能** | Feature 按 Epic 分组在容器内 | 拖动节点/容器；双击进入流程视图 |
| **流程** | 单个 Feature 内的 Step 有向图 | async/conditional/error 边可视化 |

---

## 最佳实践

### 三种使用场景

| 场景 | 时机 | 方式 |
| ---- | ---- | ---- |
| **A. 从0开发（推荐）** | 和 AI 从零开始一个新项目 | 先装 CodeSee，再开发。AI 每写完一个功能就更新 features.json |
| **B. SDD 项目** | 项目已用 spec-kit / Trellis / BMAD / Agent Skills | CodeSee 自动检测并直接消费 spec/PRD 文档——最准、最省 token |
| **C. 接入已有项目** | 给已有的纯代码项目加 CodeSee | 先跑一次代码全量扫描，之后切换到增量同步 |

### 为什么"从0开发"是最佳实践

从第一天就集成 CodeSee：

- **AI 永远不丢上下文** — 代码是它刚写的，每一步做了什么、引用哪些行、功能之间怎么连接，它全知道
- **粒度始终精细** — 每次同步只涉及一个小功能，不是一次性处理 50 个
- **没有幻觉风险** — AI 不需要猜测已有代码做了什么，因为是它刚写的
- **图随项目生长** — 你可以在任何时候审查画布，尽早发现设计问题
- **refs 精确** — 文件路径和行号准确，因为代码刚写完

### 从0开发的工作流

```
1. 在空项目中安装 CodeSee
2. 告诉 AI："实现功能 X"
3. AI 写代码 → AI 更新 features.json（AGENTS.md 中的触发 2）
4. 你在画布上审查 → 发现问题 → 告诉 AI 修复
5. 下一个功能，重复
```

画布成为你的**活的架构图**，始终与现实同步。

### 接入已有项目的工作流

```
1. 在已有项目中安装 CodeSee
2. AI 执行扫描（触发 1）→ 生成完整 features.json
3. 你在画布上审查 → 锁定正确的 feature → 告诉 AI 修复错误的
4. 之后每次代码改动自动触发增量同步
```

### SDD 项目的工作流

```
1. 安装 CodeSee——install 脚本自动检测你用的 SDD 框架
2. AI 读取 .codesee/prompts/scan-sdd.md → 直接消费 spec/PRD 文档
3. 你在 SDD 框架里完成任务 → AI 触发 sync（无需重扫源码）
4. 画布反映的是你的 spec 库结构，而非代码结构
```

这是最准确的路径：spec → features.json 是正向投影（意图保真），而 code → features.json 是反向工程（意图丢失）。

---

## 设计原则

1. **语义控制权归 AI / features.json** — 节点顺序、命名、分组、关系
2. **视觉与交互能力归前端** — 拖动、缩放、主题、布局算法
3. **不确定就让 AI 显式写出来** — 前端不做启发式推断

详见：[`docs/principles.md`](./docs/principles.md)

---

## 项目结构

```
codeSee/
├── viewer/                  画布前端（Vite + React + React Flow + Tailwind v4 + ELK）
│   ├── src/{fcg,graph,app,lib}
│   └── public/{features,layout}.json   示例数据
├── prompts/                 AI prompt 模板（通过 install 脚本拷贝到目标项目）
│   ├── scan.md              入口（自动路由：sdd / planning / light / heavy）
│   ├── scan-sdd.md          SDD 项目（spec-kit / Trellis / BMAD / Agent Skills）
│   ├── scan-light.md        轻型项目（一次产出）
│   ├── scan-heavy.md        重型项目（分阶段）
│   ├── scan-planning.md     纯文档/规划阶段
│   ├── sync.md              增量同步
│   ├── _schema.md           Schema + 枚举 + 示例（唯一真值源）
│   └── _rules.md            约束分级（MUST/SHOULD/MAY）
├── templates/               入口规则模板
│   ├── AGENTS.md            完整 AGENTS.md
│   ├── AGENTS-snippet.md    可追加片段（用于已有 AGENTS.md 的项目）
│   └── SKILL.md             跨平台 skill 入口（agentskills.io 标准）
├── scripts/                 安装脚本 + 校验器
├── docs/                    设计文档
├── LICENSE                  MIT
└── README.md
```

---

## 常见问题

<details>
<summary><strong>加载 features.json 后画布白屏</strong></summary>

AI 大概率使用了 schema 之外的枚举值（比如 `role: "logic"` 而不是 `role: "compute"`）。

1. 运行校验器：`node .codesee/scripts/validate-features.mjs`
2. 修复报告的错误（通常是 `step.role`、`flow.kind` 或 `trigger.kind` 不合法）
3. 重新加载 viewer

viewer 对未知枚举有容错处理，但严重畸形的 JSON 仍可能导致问题。
</details>

<details>
<summary><strong>点击 💾 没有弹出目录选择器</strong></summary>

File System Access API 仅在 Chromium 内核浏览器（Chrome、Edge、Arc）中可用，Firefox 和 Safari 不支持。

- 使用 Chrome 或 Edge
- 确保在 `localhost` 或 HTTPS 下访问（`file://` 协议下 FSA 被禁用）
- 如果仍不弹出，viewer 会回退到 localStorage（布局仍然保存，只是不写文件）
</details>

<details>
<summary><strong>概览视图变成一条横线</strong></summary>

AI 给每个 Epic 分配了递增的 `order`（0, 1, 2, ..., N），而不是把并行模块归到同一个 order。

修复方法：在 `features.json` 中，代表并行能力的 Epic 应该共享相同的 `order` 值。只有用户旅程中有先后顺序的阶段才用不同的 order。
</details>

<details>
<summary><strong>AI 总是编造 schema 之外的枚举值</strong></summary>

这是最常见的问题。prompt 里有严格的枚举表，但某些模型仍会幻觉。

- 每次 AI 写完/更新 `features.json` 后必须跑校验器
- 校验器会报告精确的 JSONPath 位置
- 常见映射：`logic` → `compute`、`init`/`cleanup` → `other`、`websocket` → `http`、`internal` → `event`
</details>

<details>
<summary><strong>如何更新项目中的 CodeSee？</strong></summary>

拉取最新代码后，用 `-Force`（PowerShell）或 `--force`（Bash）重新运行安装脚本：

```powershell
.\scripts\install.ps1 D:\path\to\your\project -Force
```

这会刷新 prompts、校验器和 AGENTS.md 的 CodeSee 段落，不会动你的 `features.json` 和 `layout.json`。
</details>

<details>
<summary><strong>我的项目用了 spec-kit / Trellis / BMAD——能直接用吗？</strong></summary>

可以。install 脚本自动检测这些目录：

- `.specify/` — GitHub Spec Kit
- `.trellis/` — Mindfold Trellis
- `.bmad-core/` 或 `bmad/` — BMAD-METHOD
- `.agents/skills/` — Agent Skills 标准
- `.agent-os/` — Builder Methods Agent OS

检测到后，install 脚本会报告找到的框架，scan.md 路由到 scan-sdd.md，AI 直接消费 spec/PRD 文档——不扫源码，准确率远高于反向工程。
</details>

<details>
<summary><strong>AGENTS.md 和 SKILL.md 的区别？</strong></summary>

`AGENTS.md` 是 Cursor、Claude Code、Kiro 等使用的原始入口规则格式——放在项目根目录。

`SKILL.md` 是 [agentskills.io](https://agentskills.io/) 跨平台标准（Anthropic 2025 年 12 月发布），20+ AI 工具支持。放在 `.agents/skills/codesee/SKILL.md`。它使用渐进式披露（启动时只加载 ~30-50 token，完整指令按需加载）。

install 脚本会同时写入两个文件——你的 AI IDE 会读它能理解的那个。
</details>

---

## 路线图

### 最高优先级

- [ ] **Prompt 持续优化（社区驱动）** — 真实使用中的痛点和案例才是 prompt 的护城河；欢迎贡献边界情况、反例和领域特定规则
- [ ] **语义感知布局** — 布局应尊重功能逻辑而非仅基于节点位置；探索 AI 驱动的布局（`layout.json` 已解耦，为此做好准备）

### 生态与集成

- [x] **SDD 框架集成** — 自动检测 `.specify/`（Spec Kit）、`.trellis/`（Trellis）、`.bmad-core/`（BMAD）、`.agents/skills/`，直接消费 spec/PRD 文档作为 `features.json` 数据源（从 spec 正向投影 vs 从代码反向工程）
- [x] **SKILL.md 标准入口** — 遵循 [agentskills.io](https://agentskills.io/) 跨平台标准，覆盖 Claude Code / Cursor / Codex / Gemini CLI / Copilot 等 20+ 平台
- [x] **画布实时刷新** — 本地 watcher 监听 `features.json` 变化，web 画布自动刷新（无需手动重新加载），AI 工作时实时看到画布更新

### 画布与体验

- [ ] **画布编辑** — 直接在画布上编辑功能名称、添加备注、锁定节点
- [ ] **搜索与筛选** — 按名称搜索功能，按 epic/tag/role 筛选
- [ ] **Diff 视图** — 高亮两个版本 `features.json` 之间的变化
- [x] **多项目面板** — 顶栏下拉切换多个项目（FSA 目录 / 上传文件 / 内置示例），无需重新拖文件
- [ ] **导出** — 当前视图导出为 PNG / SVG / PDF
- [ ] **暗色主题** — 暖白与暗色模式切换

### 工程化

- [ ] **CI 集成** — 在 GitHub Actions / GitLab CI 中校验 `features.json`
- [ ] **插件系统** — 自定义节点渲染器、自定义布局算法

### 长期（可选）

- [ ] **向量索引** — 语义嵌入支持"查找相似功能"/ 跨项目复用；必须保持可选，且永不替代"JSON 是唯一真相源"的核心原则

---

## 社区

- 💬 [LinuxDo](https://linux.do/) — 讨论与反馈
- 🐛 [GitHub Issues](https://github.com/Kaka-cheaper/codeSee/issues) — Bug 报告与功能请求

---

## 贡献

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)（开发环境、代码规范、PR 流程）。

快速开始：

1. Fork & clone
2. `cd viewer && npm install && npm run dev`
3. 确保 `npm run build` 通过
4. 提交 PR

---

## 许可证

[MIT](./LICENSE)
