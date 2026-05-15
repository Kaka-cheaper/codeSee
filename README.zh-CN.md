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

---

## 效果对比

| 没有 CodeSee | 有 CodeSee |
| ------------ | ---------- |
| AI 写了 20 个文件 → 你读 20 个文件 | AI 写了 20 个文件 → 你看一眼画布 |
| "这个功能改了什么？" → grep 半小时 | "这个功能改了什么？" → 看高亮的节点 |
| 功能 A 出 bug → 手动追踪 B、C、D | 功能 A 出 bug → 图上看到所有下游 |
| 新人入职 → 2 天才能理解项目 | 新人入职 → 10 分钟看画布 |

### 长什么样

```
┌─────────────────────────────────────────────────────────┐
│  概览视图（Epic）                                        │
│  ┌──────┐    ┌──────────┐    ┌────────┐    ┌────────┐  │
│  │ 认证 │ →  │ 商品浏览 │ →  │ 购物车 │ →  │  订单  │  │
│  └──────┘    └──────────┘    └────────┘    └────────┘  │
├─────────────────────────────────────────────────────────┤
│  功能视图（"订单" Epic 内部）                            │
│  ┌──────────┐  ┌─────────────┐  ┌───────────┐          │
│  │ 下单结算 │→ │  支付回调   │→ │ 我的订单  │          │
│  └──────────┘  └─────────────┘  └───────────┘          │
├─────────────────────────────────────────────────────────┤
│  流程视图（"下单结算" 内部）                             │
│  接收订单 → 锁定库存 → 计算总价 → 创建订单 → 调用支付  │
│                  ↘ 库存不足 → 回滚                      │
└─────────────────────────────────────────────────────────┘
```

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

## 贡献

1. Fork & clone
2. `cd viewer && npm install && npm run dev`
3. 确保 `npm run build` 通过
4. 提交 PR

---

## 许可证

[MIT](./LICENSE)
