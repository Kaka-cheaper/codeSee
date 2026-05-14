# CodeSee

在 AI 协作开发的过程中，把**项目的功能逻辑**以可视化画布的形式呈现给你。

不是调用图，不是 import 图——是**语义级流程图**：

> 类比：一个功能就是一道菜，画布告诉你"备菜 → 处理 → 下锅 → 调味 → 出锅"，
> 而不是"哪个函数 import 了哪个文件"。

## 设计原则

- **数据来自 AI**。代码本身没有"语义流程"这种信息，让 AI 读项目（或读 diff）直接产出 `features.json`。
- **viewer 与目标项目解耦**。viewer 留在 codeSee 仓库；目标项目只放 `.codesee/` 子目录。
- **画布只消费 JSON**，不做静态分析、不做调用图、不依赖任何具体语言。
- **人工修正可锁定**。任何 feature 标 `locked: true` 后，AI 同步时不会再覆盖。

## 整体架构

```
你的项目 Polisim/                  ← 目标项目（任意语言/框架）
├── AGENTS.md                      ← 入口规则（AI 自动读取）
├── .codesee/
│   ├── prompts/{scan,scan-light,scan-heavy,sync}.md
│   ├── scripts/validate-features.mjs   ← 结构校验器
│   ├── .gitignore
│   └── features.json              ← AI 写入 / 人工编辑
└── ... 项目自己的代码

codeSee/                           ← viewer 独立放着
├── mvp-web/                       ← 起 dev server，加载远程 features.json
├── prompts/                       ← 模板源
├── templates/AGENTS.md            ← 模板源
└── scripts/
    ├── install.{ps1,sh}           ← 一键安装到目标项目
    └── validate-features.mjs      ← 校验脚本源（被 install 拷到目标项目 .codesee/scripts/）
```

## 使用流程（推荐）

### 一次性安装（per project）

```powershell
# Windows PowerShell
.\scripts\install.ps1 D:\path\to\your\project

# macOS / Linux
./scripts/install.sh /path/to/your/project
```

这会把以下文件注入目标项目：
- `AGENTS.md`：如果目标项目已经有自己的 AGENTS.md，脚本会**追加** CodeSee 段落到末尾（用 `<!-- BEGIN/END: CodeSee integration -->` 标记），不会覆盖原内容。再次运行幂等；加 `-Force` / `--force` 会原地刷新这一段。
- `.codesee/prompts/*.md`
- `.codesee/scripts/validate-features.mjs`：结构校验器，AI 写完 features.json 后必须 `node .codesee/scripts/validate-features.mjs` 自检
- `.codesee/.gitignore`

### 启动 viewer（一次启动，多项目共享）

```bash
cd codeSee/mvp-web
npm install
npm run dev
```

打开 `http://localhost:5173/`，把目标项目的 `.codesee/features.json` **拖进画布**或点"打开"。
浏览器会记住上次打开的文件，下次刷新自动还原。

### 让 AI 维护功能图

在目标项目的 AI IDE（Cursor / Claude Code / Kiro / Codex 等）里，AI 会自动读 `AGENTS.md`：

- **第一次**：根据 `AGENTS.md` 触发 1，AI 执行 `.codesee/prompts/scan.md`，自检规模后选 light/heavy
- **每轮改动后**：AI 自动执行 `.codesee/prompts/sync.md`，增量更新 `.codesee/features.json`
- **人工修正**：直接改 JSON 或在画布里编辑（开发中），标 `locked: true` 防止覆盖

如果你的 IDE 不识别 `AGENTS.md`，重命名/复制为对应文件即可（例：`CLAUDE.md`、`.cursor/rules/codesee.mdc`）。

## 三层粒度

```
Epic       业务大块            (用户管理 / 订单)
  └─ Feature   单个用户可感知的功能   (添加用户 / 下单结算)
       └─ Step      功能内的一步动作     (校验邮箱 / 写入数据库)
```

画布顶部"概览 / 功能 / 流程"切换三档，双击节点向下钻。

## FCG Schema 速查

```ts
type FeaturesFile = {
  version: '0'
  manifest: { repo?: string; commit?: string; generated_at: string; generator?: string }
  epics: Epic[]
  features: Feature[]
  cross_feature?: CrossFeatureLink[]
}

type Feature = {
  id: string; name: string; summary?: string; epicId?: string
  triggers?: { kind: 'http'|'cli'|'cron'|'event'|'ui'|'manual'|'startup'|'unknown'; detail: string }[]
  steps: { id: string; name: string; role: StepRole; note?: string; refs?: SourceRef[] }[]
  flow:  { from: string; to: string; kind: 'next'|'async'|'conditional'|'loop'|'error'; condition?: string }[]
  confidence: number
  provenance: 'ai' | 'user'
  locked?: boolean
  tags?: string[]
  updated_at: string
}

type StepRole =
  | 'input' | 'validation' | 'auth'
  | 'data-read' | 'data-write'
  | 'compute' | 'transform'
  | 'side-effect' | 'output' | 'error' | 'other'
```

完整定义见 [`mvp-web/src/fcg/types.ts`](./mvp-web/src/fcg/types.ts)。

## codeSee 仓库结构

```
codeSee/
├── mvp-web/                     画布前端（Vite + React + React Flow + Tailwind v4）
│   ├── src/{fcg,graph,app,lib}
│   └── public/features.json     仓库自带的示例图（首次访问无外部文件时显示）
├── prompts/                     模板源 → 通过 install 脚本拷贝到目标项目
│   ├── scan.md                  扫描模式入口（自检规模 → 路由）
│   ├── scan-light.md            轻型项目（一次产出）
│   ├── scan-heavy.md            重型项目（四阶段累积）
│   └── sync.md                  增量同步
├── templates/                   AGENTS 模板源
│   ├── AGENTS.md                空白项目用的完整模板
│   └── AGENTS-snippet.md        已有 AGENTS.md 时追加用的片段
├── scripts/
│   ├── install.{ps1,sh}         一键安装到目标项目
│   └── validate-features.mjs    features.json 校验器源（被 install 拷到 .codesee/scripts/）
├── docs/review-checklist.md     人工评审 features.json 的清单
├── problem.md                   开发历史归档
└── README.md
```
