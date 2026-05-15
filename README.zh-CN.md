<div align="center">

中文 · [English](./README.md)

# 🔭 CodeSee

**把项目的功能逻辑以语义流程图的形式可视化呈现。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Prompts](https://img.shields.io/badge/Prompts-6-blue.svg)](./prompts/)
[![Viewer](https://img.shields.io/badge/Viewer-React_Flow-purple.svg)](./viewer/)
[![Standard](https://img.shields.io/badge/AgentSkills-Standard-green.svg)](./templates/AGENTS.md)

![Cursor](https://img.shields.io/badge/Cursor-Skill-black?logo=cursor)
![Claude Code](https://img.shields.io/badge/Claude_Code-Skill-orange?logo=anthropic)
![Kiro](https://img.shields.io/badge/Kiro-Skill-blue)
![Copilot](https://img.shields.io/badge/Copilot-Skill-purple?logo=github)
![Codex](https://img.shields.io/badge/Codex-Skill-green?logo=openai)

</div>

---

## 为什么需要这个

和 AI 协作写代码时：

- 🤯 **AI 五分钟写 5000 行** — 但你需要几个小时才能全部审完
- 🔍 **你需要理解的是逻辑，不是语法** — "这个功能做了什么"比"哪个函数调了哪个"重要得多
- 🐛 **出了 bug 要追全链路** — 但链路可能跨 20 个你从没看过的文件
- 😤 **你失去了对项目的掌控感** — 项目增长的速度超过了你理解它的速度

CodeSee 解决这个问题：AI 写代码的同时也写功能地图。你看到的是故事，不是语法。

---

不是调用图，不是 import 图——是人类可读的"这个项目在做什么"的故事。

做这个项目的原因：和 AI 协作写代码时，AI 五分钟能写几千行，但我需要一种方式**不看代码就能看到功能逻辑**——画布让我一眼看清"刚才发生了什么"，保持对项目的掌控感。

> 类比：如果一个功能是"西红柿炒鸡蛋"，
> 画布展示的是"备菜 → 打蛋 → 热油 → 下锅 → 调味 → 出锅"，
> 而不是"`prepare()` 调用 `slice()` 再调用 `whisk()`"。

<!-- TODO: 加截图/GIF -->

<div align="center">
<img src="./docs/assets/overview.png" alt="概览视图" width="80%" />
<p><em>概览视图 — Epic 按用户旅程顺序排列，语义流程箭头连接</em></p>
</div>

<div align="center">
<img src="./docs/assets/features.png" alt="功能视图" width="80%" />
<p><em>功能视图 — Feature 按 Epic 分组在容器内，可拖动调整</em></p>
</div>

<div align="center">
<img src="./docs/assets/steps.png" alt="流程视图" width="80%" />
<p><em>流程视图 — 单个 Feature 内的有向流程（异步、条件、错误分支）</em></p>
</div>

---

## 效果对比

| 没有 CodeSee | 有 CodeSee |
| ------------ | ---------- |
| AI 写了 20 个文件 → 你读 20 个文件 | AI 写了 20 个文件 → 你看一眼画布 |
| "这个功能改了什么？" → grep 半小时 | "这个功能改了什么？" → 看高亮的节点 |
| 功能 A 出 bug → 手动追踪 B、C、D | 功能 A 出 bug → 图上看到所有下游 |
| 新人入职 → 2 天才能理解项目 | 新人入职 → 10 分钟看画布 |

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

在你的项目里打开任意 AI IDE（Cursor / Claude Code / Kiro / Copilot）。
AI 读取 `AGENTS.md` 后自动生成 `.codesee/features.json`。

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
你的项目/                          CodeSee Viewer/
├── AGENTS.md          ←───────── templates/AGENTS.md
├── .codesee/                      viewer/
│   ├── prompts/*.md   ←───────── prompts/*.md
│   ├── scripts/       ←───────── scripts/validate-features.mjs
│   ├── features.json  ──────────→ 拖入 viewer
│   └── layout.json    ←───────── viewer 保存（File System Access API）
└── 你的代码
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
│   ├── scan.md              入口（路由到 light/heavy）
│   ├── scan-light.md        轻型项目（一次产出）
│   ├── scan-heavy.md        重型项目（分阶段）
│   ├── sync.md              增量同步
│   ├── _schema.md           Schema + 枚举 + 示例（唯一真值源）
│   └── _rules.md            约束分级（MUST/SHOULD/MAY）
├── templates/               AGENTS.md 模板
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

---

## 路线图

- [ ] **截图 & 演示 GIF** — 真实项目的可视化效果展示
- [ ] **画布编辑** — 直接在画布上编辑功能名称、添加备注、锁定节点
- [ ] **搜索与筛选** — 按名称搜索功能，按 epic/tag/role 筛选
- [ ] **Diff 视图** — 高亮两个版本 `features.json` 之间的变化
- [ ] **多项目面板** — 不用重新拖文件就能切换项目
- [ ] **CI 集成** — 在 GitHub Actions / GitLab CI 中校验 `features.json`
- [ ] **导出** — 当前视图导出为 PNG / SVG / PDF
- [ ] **暗色主题** — 暖白与暗色模式切换
- [ ] **插件系统** — 自定义节点渲染器、自定义布局算法

---

## 贡献

1. Fork & clone
2. `cd viewer && npm install && npm run dev`
3. 确保 `npm run build` 通过
4. 提交 PR

---

## 许可证

[MIT](./LICENSE)
