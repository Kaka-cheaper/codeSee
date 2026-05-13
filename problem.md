# 问题记录

> 本文档用于按时间顺序归档每次提出的问题与解决方案，便于后续修改时避免冲突、复用思路。

---

问题1：希望在 AI 协作开发场景下，通过可视化、可交互的画布审查"功能逻辑"而不是逐行代码，并询问现有 AI 给出的方案分析是否合理（特别是对方案 1 的 Mermaid 文档形式不满、对方案 3 的"AI 生成依赖 JSON 是否准确"存疑、是否需要编译器依赖解析辅助）。
解决方案：
1. 指出原回答的盲区——没有把问题拆成"结构层 + 语义层"两层，导致推荐方案都各缺一半；落地方案 1 是退化为文档审查；缺少对 AI 输出可验证性、人机回路的讨论。
2. 给出现有工具按"结构准确 / 语义层 / 持续同步 / 交互画布"四维评分，结论是四维全占的工具目前不存在，确实是真实空白。
3. 针对"AI 生成的依赖图能不能信"明确给出否定结论，原因是 AI 上下文有限、不会自动重算、对动态调用/反射/配置驱动的关系易翻车、且不可低成本验证。
4. 给出正确分层架构：静态分析层（tree-sitter / LSP / ts-morph 等）作为 ground truth → AI 语义增强层做聚类与命名 → 可视化画布 → 人机回路（用户修正可持久化、可锁定）。核心原则："结构是真值，语义是叠加"。
5. 重新评分原回答的四个落地方案，结论是真正可跑的形态是"方案 3 + 静态分析 + 人机回路"。
6. 给出技术栈建议（tree-sitter / ts-morph、属性图建模、React Flow / Cytoscape.js、`.codemap/` sidecar JSON 持久化）以及最小可行实验路径（TS 项目 → ts-morph 抽调用图 → AI 聚类命名 → React Flow 渲染 → 跑两次看稳定性、改代码看影响域）。
修改的代码文件：无（讨论分析类，不涉及代码修改）。
应当达成的效果：用户对自身需求的判断、对原 AI 回答四个方案的评估、对"AI 生成准确性 / 是否需要编译器辅助"的疑问获得有结构、有结论的综合分析；并得到一条可以最小成本验证可行性的下一步路径。

---

问题2：能否在 Python 项目上做调用图/依赖抽取，最小可行实验是否可在 Python 上完成。
解决方案：
1. 明确结论：可以做，但要预先认账 Python 因动态类型、duck typing、装饰器、反射、动态导入、框架约定等特性，静态调用图无法做到 100% 精确，目标是"主干高准确率 + 未解析关系显式标记"。
2. 给出 Python 生态工具盘点表（ast、PyCG、Jedi、astroid、Pyright、Pyan、code2flow、pyreverse、modulegraph、Scalpel、tree-sitter），按类型 / 能力 / 准确性 / 维护状态 / 用途分类。
3. 给出推荐组合，仍然遵循"结构是真值、语义是叠加"原则：
   - 结构层：ast 自定义 visitor + PyCG（主调用图）+ Jedi 或 Pyright（引用/类型补强）+ modulegraph（模块依赖）
   - 框架感知层（Python 特别重要）：自定义 visitor 识别 FastAPI/Flask/Django 路由装饰器、Celery task、Django 信号、ORM model、pytest fixture，把这些也建成节点和边
   - 语义层：AI 仅在已建好的图上贴 label，不允许改动边
   - 未解析关系：标 unresolved=true，画布用虚线展示，允许 AI 猜测但需注明
4. 列出 Python 落地常见坑：虚拟环境、`__init__.py` 副作用 import、type hint 覆盖率影响 Jedi/Pyright 准确性、测试代码需排除、入口点识别。
5. 给出 Python 版最小可行实验路径：选 FastAPI/Flask 小项目 → PyCG 出 callgraph.json → ast 装饰器 visitor 补路由边 → Jedi 二次解析 unresolved → AI 聚类命名 → React Flow / Cytoscape 渲染并支持 drill-down → 三项验证（命名稳定性、影响域高亮、PyCG 主干 miss 率）。
6. 给出 TS 与 Python 路线对比表，建议：仅验证方法论用 TS 更快，目标项目本身是 Python 则直接上 Python 但需预算更多时间在框架感知层。
修改的代码文件：无（仍为分析与方案讨论，不涉及代码修改）。
应当达成的效果：用户清楚 Python 路线的可行性、技术栈选型、相对 TS 的差异与额外成本，并拿到一条可以独立验证的 Python 最小实验路径。

---

问题3：意识到目标是做通用工具，但前面方案在 Layer 1 就绑死了具体语言（TS / Python），是否需要重新评估架构；同时倾向先用 TS 跑一个最小实现验证"画布 + 语义层"。
解决方案：
1. 确认担忧成立，但不需要推翻方案，而是在静态分析层和上层之间引入语言无关的中间表示 UCG (Universal Code Graph)，作为整个系统的合同。
2. 将架构改为五层：Layer 1 语言适配器 → Layer 2 UCG (IR) → Layer 3 框架感知插件 → Layer 4 AI 语义层 → Layer 5 可视化画布。核心铁律：Layer 4、5 只读 UCG，不直接消费任何具体语言工具的产物；Layer 3 可读源码但产出必须落到 UCG。
3. 给出 UCG 最小骨架 schema：节点 (id 指纹 / kind 有限枚举 / qualified_name / location / language / meta)、边 (source / target / kind / confidence / provenance)、manifest、unresolved 列表，并把 AI 与用户的语义注解放到独立的 annotations.json 中，与结构层物理分离，确保 AI 永远改不到结构层。设计要点强调：kind 有限枚举、confidence + provenance 必须有、节点指纹 id 跨次运行必须稳定。
4. 给出语言适配器统一接口 (detect/parse/supports)，并推荐底座用 tree-sitter（覆盖 100+ 语言），各语言再叠各自语义工具（TS: ts-morph；Python: PyCG/Jedi；Go: go/types；Java: javaparser），未来可考虑通过 LSP 协议进一步降低适配成本。同时指出此架构天然支持跨语言项目（前端 TS + 后端 Python 在同一张图）。
5. 论证 TS MVP 不与"做通用工具"冲突，前提是遵守铁律：MVP 中 Layer 3/4/5 任何代码不得出现 ts-morph / TypeScript 特有概念，画布只吃 UCG JSON、AI prompt 不携带语言信息、影响域查询基于 UCG 图算法、TS 适配器与上层之间唯一出口是 UCG。如果 MVP 写着写着上层渗入语言特有概念，是架构信号，应立刻重构边界。
6. 给出 MVP 任务顺序：先定 UCG schema (JSON Schema 或 TS types + Zod) → 写 TS 适配器输出 UCG JSON → 写最朴素 React Flow 画布只吃 UCG → AI 语义层输出 annotations.json → 实现影响域查询 → 跑稳定性 / 影响域 / miss 率三项验证。强调第 0 步 schema 必须先于任何代码。
修改的代码文件：无（架构方案讨论，不涉及代码修改）。
应当达成的效果：用户理解"语言绑定"问题的根源是缺少中间合同（UCG），获得清晰的五层架构与 UCG 最小 schema 草案；同时确认 TS MVP 在遵守"上层不依赖语言"的铁律下仍是合理的最小验证路径，并拿到一份重排后的 MVP 任务序列。

---

问题4：担心 MVP 前端美观度不够会打消积极性，并误以为"很多美观的项目都用 Node.js 实现"，请求渲染方案推荐。
解决方案：
1. 先校正概念：Node.js 是运行环境/构建工具，不是渲染层；视觉美观度真正取决于三层——渲染引擎 (SVG / Canvas 2D / WebGL)、图可视化库、UI 框架与设计系统。
2. 给出图可视化库横评（React Flow / G6(AntV) / Reagraph / Cytoscape / Sigma / vis-network / D3 / Excalidraw·tldraw / yFiles），按渲染方式 / 美观默认值 / 自定义能力 / 大图性能 / 学习曲线 / 推荐度对比。
3. 明确推荐：MVP 首选 React Flow + shadcn/ui + Tailwind + Framer Motion；节点 >2000 切换 G6 (Canvas)，>10000 切换 Sigma.js 或 Reagraph (WebGL)；视觉冲击场景可在局部用 Reagraph 3D 力导，但不应作为主画布以避免长时间使用疲劳。
4. 强调"美观度的 80% 不在图库而在 UI 外壳"：UI 用 shadcn/ui 或 Radix + Tailwind；字体用 Inter/Geist 与 JetBrains Mono/Geist Mono；图标 Lucide；动效用 Framer Motion 做克制的微交互；主题深色优先；配色用同一色相不同明度区分 kind；统一 design tokens (圆角/阴影/状态四态)。
5. 给出参考标杆：n8n、Linear、Vercel Dashboard、Cursor、Raycast、Cosmograph、PostHog Path。
6. 列出常见避坑：不要从零用 D3；不要选 vis-network 或裸 Cytoscape 再美化；节点信息密度高时配色与样式必须克制；动画要克制；先做深色再做浅色。
7. 拍板 MVP 技术栈：Next.js 15 (App Router) 或 Vite + React 18；TypeScript strict；shadcn/ui；Tailwind v4；@xyflow/react (React Flow)；Framer Motion；Lucide；状态用 Zustand 或 Jotai；字体 Geist/Inter；深色优先 CSS Variables 主题；前期不上后端，本地直接加载 UCG JSON。
修改的代码文件：无（前端选型与设计方向讨论，不涉及代码修改）。
应当达成的效果：用户对"美观度由什么决定"建立正确心智，拿到一份可直接落地的渲染选型与 UI 外壳搭配方案，并明确 MVP 阶段的技术栈，以确保 MVP 视觉质感不低于主流 SaaS 产品。

---

问题5：请求跑一个可用的画布壳子，验证 React Flow + 设计系统下的默认质感。
解决方案：
1. 在 `mvp-web/` 目录用 Vite + React 18 + TypeScript 初始化项目（Node 22 / npm 10 环境，未安装 pnpm，遂使用 npm）。
2. 安装核心依赖：`@xyflow/react`、`lucide-react`、`clsx`、`tailwind-merge`，开发依赖 `tailwindcss@v4`、`@tailwindcss/vite`。
3. 配置 Vite 接入 Tailwind v4 插件并加 `@/* -> src/*` 路径别名；同步在 `tsconfig.app.json` 中加 paths（按 TS 5+ 写法不再使用 baseUrl，避免弃用警告）。
4. 在 `src/index.css` 用 Tailwind v4 的 `@theme` 定义 OKLCH 设计 token：surface / text / accent / 节点 kind（同色相不同明度）/ 边 kind 颜色，并对 React Flow 控制条、minimap、handle、attribution 等做暗色润色，加节点入场微动效。
5. 落地 UCG schema v0：`src/ucg/types.ts` 定义 NodeKind / EdgeKind 有限枚举、UcgNode / UcgEdge（含 confidence 与 provenance）、UcgManifest、UcgUnresolved，作为画布唯一允许消费的合同。
6. 写示例图 `src/ucg/sample.ts`：模拟 FastAPI 登录流程（route → service → repo/data_model → external，含 Celery publish 边并将其 confidence=0.7 标记为推断）。
7. 实现 `src/graph/`：
   - `kindMeta.ts` 节点/边视觉元数据（图标、颜色、虚线策略）
   - `layout.ts` 极简 BFS 层级布局占位（后续换 ELK/dagre）
   - `UcgNodeView.tsx` 自定义节点（图标 chip + name + qualified_name + 类型标签 + 文件位置），hover/selected 四态
   - `GraphCanvas.tsx` 画布主体：smoothstep 边、ArrowClosed marker、低置信度自动虚线、Background dots、MiniMap 按 kind 上色、Controls
   - `NodeDetailsPanel.tsx` 右侧详情抽屉：节点头信息 + 上下游边列表 + 元数据 JSON
8. 顶部栏 `src/app/TopBar.tsx` 显示仓库 / commit / 节点边总数；`App.tsx` 仅吃 sampleUcg，体现"画布只读 UCG"的边界。
9. 清理 Vite 模板默认的 `App.css` 与 `assets/` 以避免污染主题。
10. 全链路验证：`tsc -b` 类型零错；`vite build` 成功（dist/index.js gzip 130KB、css gzip 6.6KB）；`npm run dev` 跑在 `http://localhost:5175/`。
11. 初始化根目录 git 仓库，添加 `.gitignore`（忽略 node_modules / dist / .env 等），首次提交：`feat: 初始化 MVP 画布壳子（UCG 类型 + React Flow + 示例图）`。
修改的代码文件：
   - 新增：`mvp-web/` 整套项目（package.json、vite.config.ts、tsconfig.app.json、src/index.css、src/App.tsx、src/main.tsx、src/lib/cn.ts、src/ucg/types.ts、src/ucg/sample.ts、src/graph/{kindMeta,layout,UcgNodeView,GraphCanvas,NodeDetailsPanel}.tsx|ts、src/app/TopBar.tsx）
   - 删除：`mvp-web/src/App.css`、`mvp-web/src/assets/`
   - 新增：根目录 `.gitignore`
应当达成的效果：用户访问 `http://localhost:5175/` 可看到一张暗色风格的代码功能图（路由 → 登录服务 → 验证密码 / 签发 token / 仓储 / 数据模型 / 外部包 / 异步任务），具备节点 hover / 选中、缩放 / minimap / 控件、点节点弹出右侧详情面板、低置信度边显示为虚线等基础交互；同时整个上层代码不依赖任何具体语言或工具，所有数据均以 UCG 形式注入，验证"UCG → 画布"链路成立，可作为后续接 TS / Python 适配器的稳定底座。
