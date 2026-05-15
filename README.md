<div align="center">

[中文](./README.zh-CN.md) · English

# 🔭 CodeSee

**Visualize your project's feature logic as a semantic flow graph.**

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

## Why

When collaborating with AI on code:

- 🤯 **AI writes 5000 lines in 5 minutes** — but you need hours to review them all
- 🔍 **You need to understand logic, not syntax** — "what does this feature do" matters more than "which function calls which"
- 🐛 **When something breaks, you trace the full chain** — but the chain might span 20 files you've never read
- 😤 **You lose the sense of ownership** — the project grows faster than your understanding of it

CodeSee solves this: AI writes the code AND writes the feature map. You see the story, not the syntax.

---

Not call graphs. Not import maps. A human-readable story of what your project does.

I built this because when collaborating with AI on code, I needed a way to **see the feature logic** without reading every line. AI writes thousands of lines in minutes — I needed a canvas that shows me "what happened" at a glance, so I can stay in control.

> Think of it like this: if a feature is "making scrambled eggs with tomatoes",
> the graph shows "prep → crack eggs → heat oil → stir-fry → season → plate" —
> not "`prepare()` calls `slice()` then `whisk()`".

<!-- TODO: Add screenshot/GIF here -->

---

## What You Get

| Without CodeSee | With CodeSee |
| --------------- | ------------ |
| AI writes 20 files → you read 20 files | AI writes 20 files → you glance at the canvas |
| "What did this feature change?" → grep 30 minutes | "What did this feature change?" → look at the highlighted nodes |
| Bug in feature A → trace through B, C, D manually | Bug in feature A → see all downstream on the graph |
| New team member → 2 days to understand the project | New team member → 10 minutes on the canvas |

### How it looks

```
┌─────────────────────────────────────────────────────────┐
│  Overview (Epics)                                       │
│  ┌──────┐    ┌──────────┐    ┌────────┐    ┌────────┐  │
│  │ Auth │ →  │ Catalog  │ →  │  Cart  │ →  │ Order  │  │
│  └──────┘    └──────────┘    └────────┘    └────────┘  │
├─────────────────────────────────────────────────────────┤
│  Features (inside "Order" epic)                         │
│  ┌──────────┐  ┌─────────────┐  ┌───────────┐          │
│  │ Checkout │→ │ Pay Callback │→ │ My Orders │          │
│  └──────────┘  └─────────────┘  └───────────┘          │
├─────────────────────────────────────────────────────────┤
│  Steps (inside "Checkout")                              │
│  接收订单 → 锁定库存 → 计算总价 → 创建订单 → 调用支付  │
│                  ↘ 库存不足 → 回滚                      │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install into your project

```powershell
# Windows
.\scripts\install.ps1 D:\path\to\your\project

# macOS / Linux
./scripts/install.sh /path/to/your/project
```

This injects `AGENTS.md` + `.codesee/` (prompts, validator) into your project.

### 2. Let AI scan

Open your project in any AI IDE (Cursor / Claude Code / Kiro / Copilot).
The AI reads `AGENTS.md` and automatically generates `.codesee/features.json`.

### 3. View the graph

```bash
cd codeSee/viewer
npm install
npm run dev
```

Open `http://localhost:5173/`, drag in your `.codesee/features.json`.

---

## How It Works

```
Your Project/                      CodeSee Viewer/
├── AGENTS.md          ←───────── templates/AGENTS.md
├── .codesee/                      viewer/
│   ├── prompts/*.md   ←───────── prompts/*.md
│   ├── scripts/       ←───────── scripts/validate-features.mjs
│   ├── features.json  ──────────→ Drag into viewer
│   └── layout.json    ←───────── Saved from viewer (FSA)
└── your code
```

| Layer | What | Who maintains |
| ----- | ---- | ------------- |
| `features.json` | Semantic flow (epics, features, steps, relations) | AI + human review |
| `layout.json` | Node positions on canvas | User drag + auto-save |
| Viewer | Rendering, interaction, layout algorithms | This repo |

---

## Three Views

| View | Shows | Interaction |
| ---- | ----- | ----------- |
| **Overview** | Epics as nodes, `epic_flow` as edges | Drag to arrange; double-click → Features |
| **Features** | Features grouped in Epic containers | Drag nodes/containers; double-click → Steps |
| **Steps** | Step-by-step flow within one feature | Directed graph with async/conditional/error edges |

---

## Design Principles

1. **Semantic control belongs to AI / features.json** — node order, naming, grouping, relations
2. **Visual & interaction belongs to the viewer** — drag, zoom, theme, layout algorithms
3. **When in doubt, let AI write it explicitly** — no heuristic inference in the frontend

Full details: [`docs/principles.md`](./docs/principles.md)

---

## Project Structure

```
codeSee/
├── viewer/                  Canvas frontend (Vite + React + React Flow + Tailwind v4 + ELK)
│   ├── src/{fcg,graph,app,lib}
│   └── public/{features,layout}.json   Example data
├── prompts/                 AI prompt templates (copied to target projects)
│   ├── scan.md              Entry point (routes to light/heavy)
│   ├── scan-light.md        Light projects (one-shot)
│   ├── scan-heavy.md        Heavy projects (phased)
│   ├── sync.md              Incremental sync
│   ├── _schema.md           Schema + enums + example (single source of truth)
│   └── _rules.md            Constraints (MUST/SHOULD/MAY)
├── templates/               AGENTS.md templates
├── scripts/                 Install script + validator
├── docs/                    Design docs
├── LICENSE                  MIT
└── README.md
```

---

## Contributing

1. Fork & clone
2. `cd viewer && npm install && npm run dev`
3. Make changes, ensure `npm run build` passes
4. Open a PR

---

## License

[MIT](./LICENSE)
