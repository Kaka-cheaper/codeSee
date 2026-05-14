# CodeSee

在 AI 协作开发的过程中，把**项目的功能逻辑**以可视化画布的形式呈现给你。

不是调用图，不是 import 图——是**语义级流程图**：

> 类比：一个功能就是一道菜，画布告诉你"备菜 → 处理 → 下锅 → 调味 → 出锅"，
> 而不是"哪个函数 import 了哪个文件"。

## 核心理念

- **数据来自 AI**。代码本身没有"语义流程"这种信息，让 AI 读项目（或读 diff）直接产出 `features.json`。
- **结构是真值，语义是叠加**——这里的"真值"就是 `features.json` 本身，由 AI 写、由你审。
- **画布只消费 JSON**，不做静态分析、不做调用图、不依赖任何具体语言。
- **人工修正可锁定**。任何 feature 标 `locked: true` 后，AI 同步时不会再覆盖。

## 三层粒度

```
Epic       业务大块            (用户管理 / 订单)
  └─ Feature   单个用户可感知的功能   (添加用户 / 下单结算)
       └─ Step      功能内的一步动作     (校验邮箱 / 写入数据库)
```

画布顶部"概览 / 功能 / 流程"切换三种视图，双击节点向下钻。

## 工作流

### 第一次接入项目（扫描模式）

把 [`prompts/scan.md`](./prompts/scan.md) 整段拷给 AI（Cursor / Claude / Kiro / 任何 IDE），
让 AI 通读项目后产出一份 `features.json` 写到 `mvp-web/public/features.json`。

### 协作开发中（增量同步）

每完成一轮代码改动，把 [`prompts/sync.md`](./prompts/sync.md) 拷给 AI，
它会读 git diff + 现有 `features.json`，输出最小变更后写回。

### 启动画布

```bash
cd mvp-web
npm install
npm run dev
```

打开 `http://localhost:5173/`。如果存在 `mvp-web/public/features.json` 自动加载；
没有也能进入空状态界面，提示你怎么生成。

仓库自带一份示例 `features.json`（用户管理 + 订单结算），删掉它换成自己的就行。

## 项目结构

```
codeSee/
├── mvp-web/                 画布前端（Vite + React + React Flow + Tailwind v4）
│   ├── src/
│   │   ├── fcg/             FCG schema 与加载器
│   │   ├── graph/           画布、节点视图、详情面板、布局
│   │   ├── app/             顶部栏
│   │   └── lib/             小工具
│   └── public/
│       └── features.json    ★ 数据源：AI 产出 / 人工编辑
├── prompts/
│   ├── scan.md              扫描模式 prompt
│   └── sync.md              增量同步 prompt
├── problem.md               问题与方案历史归档
└── README.md
```

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

## 设计原则

- 画布永远只读 `features.json`，不读源码。要看源码点 step 详情面板里的 refs。
- AI 提交的 feature 都是 `provenance: 'ai'`，画布上有机器人徽标；人工编辑后改 `provenance: 'user'` 并 `locked: true` 即可永久保护。
- 任何标签、id 命名规则在 prompt 里写死，确保 AI 跨次输出稳定。
