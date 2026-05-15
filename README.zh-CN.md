# CodeSee

[English](./README.md) | [中文](./README.zh-CN.md)

**把项目的功能逻辑以语义流程图的形式可视化呈现。**

不是调用图，不是 import 图——是人类可读的"这个项目在做什么"的故事。

> 类比：如果一个功能是"西红柿炒鸡蛋"，
> 画布展示的是"备菜 → 打蛋 → 热油 → 下锅 → 调味 → 出锅"，
> 而不是"`prepare()` 调用 `slice()` 再调用 `whisk()`"。

<!-- TODO: 加截图/GIF -->

---

## 特性

- **AI 驱动** — AI 阅读代码并产出 `features.json`，你在画布上看到功能故事
- **三层缩放** — Epic（业务大块）→ Feature（用户可感知的功能）→ Step（动作流程）
- **语言无关** — 适用于任何技术栈，viewer 只消费 JSON
- **人机协作** — 拖动节点、锁定功能、撤销/重做；AI 不会覆盖你的编辑
- **零耦合** — `features.json` 没有布局数据；`layout.json` 没有语义数据
- **增量同步** — 每次代码改动后，AI 只更新受影响的功能

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
