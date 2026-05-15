# CodeSee

[English](./README.md) | [中文](./README.zh-CN.md)

**Visualize your project's feature logic as a semantic flow graph.**

Not call graphs. Not import maps. A human-readable story of what your project does.

> Think of it like this: if a feature is "making scrambled eggs with tomatoes",
> the graph shows "prep → crack eggs → heat oil → stir-fry → season → plate" —
> not "`prepare()` calls `slice()` then `whisk()`".

<!-- TODO: Add screenshot/GIF here -->

---

## Features

- **AI-powered** — AI reads your code and writes `features.json`; you see the story on a canvas
- **Three zoom levels** — Epic (business domains) → Feature (user-facing capabilities) → Step (action flow)
- **Language-agnostic** — Works with any tech stack; the viewer only consumes JSON
- **Human-in-the-loop** — Drag nodes, lock features, undo/redo; AI won't overwrite your edits
- **Zero coupling** — `features.json` has no layout data; `layout.json` has no semantics
- **Incremental sync** — After each code change, AI updates only affected features

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
