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

---

问题6：原暗色主题"太硬核"，希望改为淡雅、轻松的风格，参考 Claude 官网及桌面版的整体感觉（不是照搬具体颜色）。
解决方案：
1. 重写 `src/index.css` 主题 token：底色改为暖米白 oklch(0.985 0.006 78)，叠加左下偏蓝、右上偏暖的两束极淡径向光晕；文字改为深棕灰 oklch(0.32 0.022 55)；边框改为极淡暖灰 oklch(0.91 0.008 70)；accent 改为暖橘赭石 oklch(0.66 0.135 45) + accent-soft 用于环状高亮。
2. 字体启用 Inter 的 cv11 / ss01 / ss03 OpenType 特性，配合 -0.005em 负字距，靠近 Claude / Linear 风格的紧凑文字质感。
3. 节点 kind 配色策略反转：从"深底浅字"改为"淡彩底 + 深字"——背景用 oklch L≈0.92~0.93、低饱和度，前景文字与图标用同色相 L≈0.42~0.50，避免任何高饱和或鲜艳配色，让节点在画布里"安静"。
4. React Flow 控件、minimap、handle、attribution 全部跟随暖白主题：阴影换为极轻 1px + 软外发光圈而非深沉投影；背景点 gap 加大到 28、size=1、用近底色的暖米点；minimap 遮罩用半透暖白；选中态使用 accent-soft 软色环。
5. 节点视图：圆角加大到 2xl、padding 增 + 留白增；hover 用 -translate-y-px + 三层软光圈；选中用 accent 软外环；边线和箭头宽度从 1.4px 降到 1.25px、整体边的不透明度 0.9，弱化指向感的同时保留可读性。
6. 顶部栏：logo 用 accent-soft 暖色块包裹 Sparkles 图标；分隔线、字号、留白都向"信纸排版"靠拢。
7. 详情面板：纸张感卡片，软投影替代深投影；上下游列表项 hover 改为浅暖灰；元数据代码块改用 bg-sunken 米色底。
8. 全链路验证：`tsc -b` 0 错；`vite build` 通过（CSS gzip 6.87KB，整体增量极小）；HMR 已推送新主题到运行中的 dev server (`http://localhost:5175/`)。
9. 提交：`style: 改为暖白淡雅主题（Claude 调性）`。
修改的代码文件：
   - `mvp-web/src/index.css`（重写主题与 React Flow 暗→亮调）
   - `mvp-web/src/graph/kindMeta.ts`（chipBg/chipFg/minimap 三色策略，淡底深字）
   - `mvp-web/src/graph/UcgNodeView.tsx`（圆角、阴影、留白、hover/selected 视觉重做）
   - `mvp-web/src/graph/GraphCanvas.tsx`（背景点、minimap、边样式调淡）
   - `mvp-web/src/graph/NodeDetailsPanel.tsx`（纸张感、软投影、列表 hover）
   - `mvp-web/src/app/TopBar.tsx`（logo 用 accent-soft，弱化分割线）
   - `mvp-web/src/App.tsx`（外层去掉硬色背景以让 body 渐变透出）
应当达成的效果：刷新 `http://localhost:5175/` 后整体观感由"暗色高对比的工程界面"切换为"暖白纸张感、低饱和、留白克制"的淡雅风格，节点之间不再喧宾夺主，accent 用暖橘点缀，长时间审查不易疲劳；同时所有变更仅限主题层，UCG schema 与画布数据流向不变，不影响后续 adapter 接入。

---

问题7：上一版淡雅主题仍然"太晃眼"，希望整体再调暖、降亮。
解决方案：
1. 全面下压 surface 层亮度并增加色温倾斜：bg-0 从 oklch(0.985 0.006 78) 调到 oklch(0.948 0.012 80)（约 -3.7%）；bg-1 从 0.995 调到 0.965；bg-2 从 0.965 调到 0.93；bg-sunken 从 0.955 调到 0.915。整体观感由"近白米"切换为"亚麻 / 信纸"。
2. 边框从 oklch(0.91) 调到 0.87，让节点边界比之前更可见但仍柔；border-strong 同步从 0.84 调到 0.78。
3. 文字略加深、加暖：fg 0.32→0.30、muted 0.50→0.48、subtle 0.66→0.62，色相全部往暖侧 (50/58/62) 偏，避免冷灰感。
4. accent 暖橘整体往深一档：accent 0.66→0.62、accent-soft 0.94→0.90，选中态不再产生"亮一块"的亮斑；accent-strong 0.58→0.55。
5. 节点 kind 底色统一压暗约 3%（L 0.92~0.93 → 0.89~0.90），kind 文字加深一档，对比保留但整张图不再发亮。
6. 背景径向渐变不透明度从 0.5/0.4 降到 0.35/0.28，仅保留极淡的"呼吸"光晕，避免亮斑。
7. 背景点颜色从 oklch(0.86) 调深到 0.80，配合新底色保持点阵可见但不抢焦点；minimap 遮罩改为新底色 0.55 透明度。
8. 边线 stroke 颜色（call/import/route/unresolved）整体压低一档亮度，与降低后的底色保持稳定对比。
9. 全链路验证：tsc -b 0 错；vite build 通过（CSS gzip 6.89KB 几乎不变）；HMR 已推送至 dev server。
10. 提交：`style: 整体降亮加暖，调向亚麻信纸调`。
修改的代码文件：
   - `mvp-web/src/index.css`（surface / border / text / accent / kind / edge token 全面降亮加暖）
   - `mvp-web/src/graph/GraphCanvas.tsx`（背景点颜色与 minimap 遮罩跟随新底色）
应当达成的效果：刷新后整体亮度下降约 3-4%，色温整体偏暖，长时间审视不再有"晃眼"感；节点、边、面板、控件之间的对比关系全部按比例下移，可读性保持，但视觉负担显著降低，整体调性更接近"亚麻信纸 + 暖橘点缀"。

---

问题8：进入下一阶段，实现 TS 语言适配器，让画布从"吃示例"切换为"吃真实分析结果"。
解决方案：
1. 把仓库改造成 npm workspaces 单仓库结构：根目录 `package.json` 声明 `packages/*` 与 `mvp-web` 两个 workspace；新增 `build:schema` / `build:ts-adapter` / `build` / `scan:self` / `dev:web` 等聚合脚本。
2. 新建共享包 `packages/ucg-schema`：把原 `mvp-web/src/ucg/types.ts` 中的 UCG 类型抽离为唯一的合同来源；新增 `nodeId({file, qualified_name, kind})` 与 `edgeId({source,target,kind})` 工具函数，使用 FNV-1a 32 位哈希生成稳定 id（不引入 crypto 依赖），保证跨次运行同一节点 id 不变。配套 `tsconfig.json`、`tsc -p` 构建到 `dist/`。
3. 新建 `packages/ts-adapter`：基于 `ts-morph@^24` 实现 TypeScript 静态分析。
   - 节点：每个 .ts/.tsx 文件 → `module`；class → `class`；顶层 function 与 var = (...) => {} 与函数表达式 → `function`；class 内方法 → `method`；外部包按根包名归并为 `external`（`lodash/fp` 归到 `lodash`，`@scope/pkg/sub` 归到 `@scope/pkg`）。
   - 边：`module → module/external` 的 `import`；`module → class/function`、`class → method` 的 `contains`；`function/method → function/method/external` 的 `call`（通过 `getDefinitions()` 解析）；class 继承落到 `inherit` 但 confidence=0.6 标注 "暂未做精确解析"。
   - 解析失败的 callee 进入 `unresolved` 列表，符号截断 80 字符并附 context 节点 id。
   - tsconfig 检测：优先 `tsconfig.app.json` 再 `tsconfig.json`，找不到时按 glob 加载 ts/tsx 并排除 node_modules / dist / build。
4. CLI `packages/ts-adapter/src/cli.ts`：`codesee-ts <rootDir> [--out <path>] [--repo <name>] [--tsconfig <path>]`，支持 `--help`，输出节点/边/unresolved 统计与耗时到 stderr，UCG JSON 写到 `--out`（自动建目录）。
5. 修改 `mvp-web`：
   - `package.json` 增加 `@codesee/ucg-schema: "*"` 依赖；
   - `src/ucg/types.ts` 改为 `export * from '@codesee/ucg-schema'` 保持上层 import 路径不变；
   - 新增 `src/ucg/loader.ts`：先 `fetch('/ucg.json')`，校验 schema（version/nodes/edges）后返回；失败回退到 `sampleUcg`；
   - `App.tsx` 改为异步加载，加载期间显示"正在加载 UCG…"；
   - `TopBar` 增加 `live` / `sample` 徽章，标识当前画布数据来源。
6. 修复实际跑通过程中遇到的 ESM 下 `require` 不可用问题（`findFirstExisting` 改为模块顶部 `import fs from 'node:fs'`）。
7. 在 `.gitignore` 中追加 `packages/*/dist/` 与 `mvp-web/public/ucg.json`，避免分析产物入库。
8. 自分析跑通：`npx tsx src/cli.ts ../../mvp-web --out ../../mvp-web/public/ucg.json --repo codesee/mvp-web` → 节点 33 / 边 62 / unresolved 5 / 用时 ≈1.8s；统计：module 12 / external 11 / function 10；import 36 / contains 10 / call 16；unresolved 全部为 React useState 返回的 setter（符合预期，本就不应作为业务调用边）。
9. 全链路构建验证：根目录 `npm run build` 串行 schema → ts-adapter → mvp-web 全部通过；vite build 产物 CSS gzip 6.89KB / JS gzip 130.84KB；mvp-web `tsc -b` 0 错；dev server 起在 `http://localhost:5173/` 自动加载 `/ucg.json`。
10. 提交：`feat(ts-adapter): 实现 TS 语言适配器，画布吃真实 UCG`。
修改的代码文件：
   - 新增：`package.json`（根 workspaces）、`packages/ucg-schema/{package.json,tsconfig.json,src/index.ts}`、`packages/ts-adapter/{package.json,tsconfig.json,src/{analyzer.ts,cli.ts}}`、`mvp-web/src/ucg/loader.ts`、`mvp-web/public/ucg.json`（运行产物，已 gitignore）
   - 改动：`mvp-web/package.json`（依赖共享 schema）、`mvp-web/src/ucg/types.ts`（re-export）、`mvp-web/src/App.tsx`（异步加载）、`mvp-web/src/app/TopBar.tsx`（live/sample 徽章）、`.gitignore`
应当达成的效果：从根目录运行 `npm run scan:self` 后，刷新 `http://localhost:5173/` 顶部出现绿色 `live` 徽章，画布展示 mvp-web 项目的真实静态依赖图（App → GraphCanvas / TopBar / loader → ucg-schema / @xyflow/react / lucide-react 等），上层代码与共享 schema 完全语言无关，为后续接入 Python 适配器、AI 语义层、布局升级、影响域查询打下稳定底座。下一阶段可在三件事中选一推进：dagre/ELK 布局升级、AI 聚类与命名、影响域查询高亮。

---

问题9：当前画布"显示得太细"违背了语义级初衷（function 级节点等于看代码），且 33 节点已出现拖动卡顿，需要做粒度调整与性能优化。
解决方案：
1. 识别根因：粒度问题与性能问题本质同一件事——把 function 级直接画在主画布等于把代码搬上来；正确做法是 UCG 数据层保持精细、渲染层做"聚合视图"。
2. 新增 `mvp-web/src/graph/aggregation.ts` 实现 LOD（Level of Detail）：
   - 默认：项目内 module 按目录前缀聚合为"包节点"（group），external 聚合为单一 external 簇。
   - 双击 group → 展开为内部 module，再次双击折叠。
   - function/method/class 默认不进画布（保留在 UCG 中供详情面板 drill-down）。
   - 跨节点的边按 (source,target) 聚合，标签显示 `kind ×count`，宽度按 log2(count) 缩放并设上限；任一原始边 confidence<1 则聚合边显示虚线。
   - 分组规则：单段路径→'root'；两段→第一段（避免 src/App.tsx 这种单文件成包）；≥三段→前两段。
3. 新增 `GroupNodeView.tsx`（folder/package 视觉），重写 `UcgNodeView.tsx` 使其消费 `ViewNode`（module / external_member），两者均 `React.memo` 包裹。
4. `GraphCanvas.tsx` 重构：吃聚合视图，单击=选中、双击 group=展开；启用 `onlyRenderVisibleElements`、`nodesConnectable=false`；去掉边的 animated；左下角加"视图分组"控件可一键切换包展开。
5. 详情面板 `NodeDetailsPanel.tsx` 适配 ViewNode：包节点展示成员列表与成员对外的上下游边；module / external 节点展示自身上下游；面板与顶部栏移除 `backdrop-blur` 以消除滚动/拖拽期间的性能瓶颈。
6. `layout.ts` 改为接收 ViewNode/ViewEdge，列间距 280→320、行间距 110→120 适配新的卡片尺寸；BFS 分层逻辑保留（暂不引入 dagre/ELK）。
7. 修复 TS 严格模式下的 noUnusedLocals 报错（aggregation.ts 中未使用的 idToUcg 与 UcgEdge import）。
8. 验证：mvp-web 自分析 33 节点 / 62 边的 UCG，经聚合后默认渲染节点 6（src 2 / src/graph 5 / src/app 1 / src/ucg 3 / src/lib 1 / external 11，共 6 个视图节点），边相应显著减少；`tsc -b` 0 错；`vite build` 通过；HMR 已推送至 dev server (`http://localhost:5173/`)。
9. 提交：`feat(canvas): 引入聚合视图，默认包级展示，性能优化`。
修改的代码文件：
   - 新增：`mvp-web/src/graph/aggregation.ts`、`mvp-web/src/graph/GroupNodeView.tsx`
   - 改动：`mvp-web/src/graph/{UcgNodeView,GraphCanvas,NodeDetailsPanel,layout}.ts(x)`、`mvp-web/src/app/TopBar.tsx`
应当达成的效果：刷新页面后默认只看到包级的关系图（约 6 个节点），节点之间的边显示聚合次数；拖动顺畅、不再卡顿；想看包内细节双击即可展开为模块级；点击任意节点右侧抽屉显示其内部成员、上下游边、跨节点聚合信息——画布从"代码搬运"切换为"功能块/语义骨架"视图。下一步建议做 AI 语义命名，把 `src/graph` 这类路径名替换为"画布渲染"等语义标签，才算真正脱离"看代码"。

---

问题10：进入下一阶段——加入 AI 语义层，让画布不再显示 "src/graph" 这种物理路径，而是 "画布与图渲染" 这种业务语义标签。
解决方案：
1. 在 `@codesee/ucg-schema` 末尾追加注解类型（与结构层物理分离）：
   - `Annotation`：label / summary / tags / confidence / provenance / locked / updated_at
   - `AnnotationsFile`：version + clusters[] + annotations 字典；annotation key 形如 `node:<id>` 或 `cluster:<id>`
   - `ClusterDef`：簇定义，支持 pathPrefix 或显式 ids
   - 工具函数 `annotationKey()`、`emptyAnnotations()`
   核心规则：annotation 仅可包含 label/summary/tags，不允许触碰任何结构字段。
2. 新增 workspace 包 `packages/ucg-annotator`：
   - `clustering.ts`：与画布端 aggregation 同款分组规则（保证 group id 一致），从 UCG 推导默认簇定义；提供 `membersOf()` 用于反查簇成员。
   - `heuristic.ts`：双线索（路径关键词 + 依赖包名）启发式标签生成；预置 30+ 中文标签 (画布与图渲染/UCG 数据合同/认证与登录/路由/异步任务/通用工具/UI 组件…) 与 20+ 依赖识别 (react-flow/celery/jwt/sqlalchemy…)；external 簇与 main.tsx 入口给出特殊处理；置信度分级：external/精确入口=1.0、命中关键词=0.6、兜底=0.4；额外提供 `annotateNodeByHeuristic` 处理动词起头的函数命名 (get/save/render/parse/...)。
   - `llm.ts`：OpenAI 兼容协议；按 batchSize 分批；prompt 仅传 members 与 external_deps 与少量示例边，不传源码避免上下文爆炸；强制 `response_format=json_object`；返回结构兼容 `id` 与 `clusterId` 两种字段名。
   - `annotator.ts`：编排——先跑启发式打底，再对置信度<0.8 的簇做 LLM 升级；LLM 失败自动降级；与 existing.locked 合并保证用户锁定项不被覆盖（除非 `--force`）。
   - `cli.ts`：`codesee-annotate <ucg.json> [--out] [--llm] [--force]`；`--llm` 走环境变量 `CODESEE_LLM_KEY/BASE/MODEL`；缺 key 时优雅降级。
3. 根 `package.json` 增加脚本：`build:annotator` 与 `annotate:self`，并把 annotator 串入 `build`。
4. mvp-web 接入：
   - 新增 `src/ucg/annotations.ts` 加载 `/annotations.json`，version=0 校验失败回退 null；
   - `App.tsx` 同时加载 ucg + annotations，下传画布；
   - `aggregation.ts` 接收 annotations 参数，把对应 cluster/node 的标注挂到 ViewNode.annotation；
   - `GroupNodeView` 主标题改用语义 label（路径降为副标题）；右上角加 ✨ 徽章（LLM 标注）/ 🔒 徽章（锁定）/ ~ (低置信度) 三态；
   - `NodeDetailsPanel` 头部展示 label/summary/tags（标签云），右上角徽章区分 auto/AI/user 三类来源；
   - 左下角"视图分组"控件按钮文本改为优先显示语义 label，hover tooltip 显示 summary；
   - 顶部栏新增 ✨ "annotated" 徽章，标识当前画布已加载语义标注。
5. 修复构建过程中遇到的字段名不一致问题：annotator.ts 中将 LLM 返回的 `e.id` 改为契约字段 `e.clusterId`；llm.ts 在解析层做向后兼容映射，避免不同模型输出抖动导致丢标注。
6. 自分析跑通：33 节点 / 6 簇，启发式 6 ms 全部命中；产物：src/graph→画布与图渲染、src/ucg→UCG 数据合同、src/app→应用主体、src/lib→通用工具、external→外部依赖；唯一偏差：`src` 因 App.tsx 直接 import @xyflow/react 被依赖线索带向"画布与图渲染"，启发式标 0.6 低置信度，正是 LLM 该上的场景。
7. `.gitignore` 追加 `mvp-web/public/annotations.json`，避免运行产物入库；UCG 与 annotations 都以 sidecar JSON 形式存在，方便人工 review、git diff、回滚。
8. 全链路构建：schema → ts-adapter → annotator → mvp-web 全部通过；mvp-web tsc -b 0 错；vite build 产物 CSS gzip 6.82KB / JS gzip 132.96KB；HMR 已推送至 dev server。
9. 提交：`feat(annotator): 加入语义标注层（启发式 + 可选 LLM）`。
修改的代码文件：
   - 新增：`packages/ucg-annotator/{package.json,tsconfig.json,src/{index,annotator,clustering,heuristic,llm,cli}.ts}`、`mvp-web/src/ucg/annotations.ts`
   - 改动：`packages/ucg-schema/src/index.ts`（追加注解类型）、`package.json`（脚本）、`.gitignore`、`mvp-web/src/{App.tsx, app/TopBar.tsx, graph/{aggregation.ts, GroupNodeView.tsx, GraphCanvas.tsx, NodeDetailsPanel.tsx}}`
应当达成的效果：跑 `npm run annotate:self` 后刷新画布，原本 "src/graph" 的节点主标题切换为 "画布与图渲染"、"src/ucg" 切换为 "UCG 数据合同"、external 切换为 "外部依赖"，路径只剩副标题；右上角徽章区分启发式/LLM/锁定来源；点节点的详情面板显示 summary 与 tags 标签云；顶部 "annotated" 徽章亮起；同时严格遵守"结构是真值，语义是叠加" 的边界——AI 永远不能改 ucg.json 的节点和边，只能往 annotations.json 里追加 label。下一步可三选一：实接 LLM 修正 src 簇的偏差、画布内编辑/锁定标注并写回 annotations.json、影响域查询高亮。

---

问题11：用户复盘核心需求，指出当前方向偏了——他要的是"语义级功能流程图"（类比西红柿炒鸡蛋的步骤链：备菜→处理→下锅→调味→炒），而不是 import/call/contains 这种调用关系图；并指出底层重型静态分析对协作者视角价值不大，更适合直接让 AI 阅读项目或读 diff 来产出语义层；询问是否应让 AI 直接分析+前端直接消费。
解决方案：
1. 承认前面方向偏了，根因是把"代码图"当成了"语义图"——以为可以在调用图上叠 label 得到语义层，但语义流程的节点（动作/阶段）与代码节点（函数/模块）粒度错位、来源错位，根本不是叠加关系，而是"两张错位的图"。
2. 重新评估各组件价值：ts-adapter ≈ 1 星、启发式 annotator ≈ 2 星、LLM 命名 ≈ 2 星，画布 ≈ 5 星，UCG schema 是错误合同。结论：画布与设计系统保留，schema 与底层分析必须重做或大幅降级。
3. 提出新方向 FCG (Feature & Flow Graph)：以 Feature 为一等公民，每个 Feature 内部包含 steps[] 与 flow[]；可选挂载 trigger（HTTP/定时/事件/CLI/UI）、refs（步骤回溯源码文件+行号）、cross_feature（功能间的发布订阅/前置依赖）。step.name 限定为动作短语，flow.kind 区分 sync/async/conditional/loop——直接表达"然后呢"的语义链条，不需要 AI 再叠一层。
4. 数据来源转向"AI 主导 + 人工修正"，提供两种工作模式：
   - 协作模式（主）：每次 AI IDE 完成改动后，读 git diff + 现有 features.json，输出最小 JSON Patch；不得重写未受影响的 feature 以保护人工标注；
   - 扫描模式：第一次接入既有项目，AI 读全项目产出整份 features.json；
   - 人工修正：直接改 JSON 或画布编辑，锁定后不被 AI 覆盖。
5. 静态分析降级方案：ts-adapter / annotator 不删除，但退役为辅助工具，仅承担三件事——验证 refs 文件存在性、输出"自上次以来变更的文件清单"提示 AI 该重审哪个 feature、对 AI 凭空编造的文件路径告警；不再喂画布。
6. 画布迁移成本评估：节点+自定义渲染、聚合视图（Group→展开）、详情面板、边视觉语言（虚线/计数/方向）、暖白主题全部可复用；主要改动只在数据加载与聚合规则——把"按目录聚合 module"换成"按 Feature 聚合 Step"。
7. 给出最小破坏迁移路径：新增 FCG schema 包（保留 UCG）→ 手写示例 features.json → 改画布聚合与节点视觉 → 把 UCG/ts-adapter/annotator 移到 legacy/ 或加 --legacy 才启用 → 写两份 AI prompt 模板（扫描/协作）放仓库 → 可选写极轻 fcg-helper 做 refs 校验与变更检测。
8. 提出三个待用户拍板的问题：
   - 功能粒度：HTTP 端点级 / 用户故事级 / 自定边界？
   - 协作 IDE：Cursor / Claude Code / Kiro / Copilot Chat？决定 prompt 模板风格；
   - ts-adapter / annotator 处置：移到 legacy/ 保留 / 降级当辅助 / 直接删除？
9. 等用户拍板再动手；首要交付物预计是一份"用户登录 + 添加用户"的手工 features.json + 画布在 FCG 数据下的视觉效果，先验证质感再继续。
修改的代码文件：无（停下来做方案校正，未动代码）。
应当达成的效果：用户与 AI 对项目方向重新对齐，明确"代码图 vs 语义流程图"的本质差异，确立 FCG 作为新主合同与"AI 直接产出 + 人工修正"的工作流；同时保留画布与设计系统投入、避免推翻重来；明确等待用户回答三个关键问题后再开始迁移，避免再次走偏。

---

问题12：用户拍板三个关键问题——功能粒度全要（Epic + Feature + Step 三层）、IDE 不影响 prompt、ts-adapter/annotator 直接删干净（git 仓库可回溯），授权开始迁移。
解决方案：
1. 删除全部历史包：`packages/ucg-schema`、`packages/ts-adapter`、`packages/ucg-annotator`、根 `package.json`（workspaces）、`package-lock.json`、`mvp-web/src/ucg/`、`mvp-web/public/{ucg,annotations}.json`，以及旧节点视图 `UcgNodeView.tsx` / `GroupNodeView.tsx` / `NodeDetailsPanel.tsx` / `aggregation.ts` / `kindMeta.ts`。期间因 dev server 占用 .node 文件，先停进程再二次清理 node_modules。共净删 4080 行（含 lockfile）。
2. 新增 FCG (Feature & Flow Graph) schema 在 `mvp-web/src/fcg/types.ts`：三层粒度 Epic→Feature→Step；Feature 包含 triggers (http/cli/cron/event/ui/manual/startup/unknown)、steps (11 类 role) 与 flow (next/async/conditional/loop/error)；可选 cross_feature 跨功能关系（depends_on/publishes/subscribes/triggers）；Feature 自带 confidence/provenance/locked/tags/updated_at；提供 `emptyFeatures()` 工厂。
3. `mvp-web/public/features.json` 写入示例数据：用户管理 + 订单结算两个 Epic、4 个 Feature（用户登录 / 添加用户 / 查询列表 / 下单结算），覆盖 next/async/conditional/loop/error 全部 flow kind 与全部 11 类 role，便于一次性验证视觉效果。
4. `src/fcg/loader.ts` 简单 fetch + 校验 version=0；`src/graph/fcgView.ts` 实现三种视图模式 buildView：
   - overview：渲染 Epics，cross_feature 关系上卷为 Epic 之间的虚线；
   - features：渲染所有 Feature 卡片 + cross_feature 关系；
   - steps（带 focusedFeatureId）：渲染单个 Feature 内部的 Step + Flow；
   - 未归属 Epic 的 features 会落入虚拟 Epic '其他'。
5. `src/graph/roleMeta.ts` 集中节点角色与 flow kind 的视觉元数据：11 类 role 各自一对 bg/fg/minimap 颜色（同饱和度不同色相，认证/副作用/错误用暖色族，数据/校验用冷色族），保持暖白主题统一调；FlowKind 的视觉 dashed/animated 也在这里集中。
6. 三个新节点视图 `EpicNodeView` / `FeatureNodeView` / `StepNodeView`，均 React.memo：
   - Epic：层叠图标 + 名称 + featureCount + summary；
   - Feature：trigger 类型决定图标（HTTP→Network、CLI→Terminal、Cron→Clock 等），AI 来源带 Bot 图标，locked 带锁，低置信度显示 ~confidence；
   - Step：按 role 渲染图标与色块（11 个 LucideIcon 映射），可选展示 note；
7. `GraphCanvas.tsx` 重构：用 buildView 构建视图、`onNodeDoubleClick` 把 epic 双击→features 视图、feature 双击→该 feature 的 steps 视图；左上角加视图切换器（概览/功能/流程，三段开关 + 当前 focused feature 名提示）；保留 onlyRenderVisibleElements / nodesConnectable=false / smoothstep 默认边 / dashed-async 视觉。
8. `DetailsPanel.tsx` 重写：Epic 节点显示 summary 与包含的 features 列表；Feature 节点显示 summary、triggers、有序 steps（带 role 色块）、关联功能、tags 标签云；Step 节点显示所属功能、note、refs 源码位置；header 区分 Epic/Feature/Step 三类徽标，AI/locked 显式标识。
9. `App.tsx` 改为加载 features.json，没有时显示空状态卡片（提示用户 prompt 路径与文件位置）；`TopBar.tsx` 顶部统计改为 epics 数 + features 数；移除全部 ucg 相关引用。
10. mvp-web `package.json` 移除 `@codesee/ucg-schema` 依赖；重新 npm install；`tsc -b` 0 错；vite build 通过（CSS gzip 6.73KB / JS gzip 133.17KB）；dev server 起在 `http://localhost:5173/`。
11. 新增 `prompts/scan.md`（扫描模式）与 `prompts/sync.md`（增量同步）：均为通用 prompt，不绑定特定 IDE；scan 包含完整 schema、命名约束、质量自检；sync 强调"只动受影响的 feature、永不改 locked"、提供"调用→语义"的反例对照表、列出边界情况（纯重构 / 跨多 feature / 新文件未接入 / 删除功能）的处理协议。
12. 新增 `README.md`：核心理念（语义级流程图、AI 主导数据源、画布只读 JSON、人工锁定）、三层粒度示意、扫描/协作/启动三种工作流、项目结构、FCG schema 速查、设计原则。
13. `.gitignore` 简化：移除对 ucg.json/annotations.json 的忽略；features.json **入库**——它是项目核心数据，需要 review 与 git diff 跟踪。
14. 提交：`feat: 转向 FCG（语义流程图），删除旧的 UCG/调用图链路`，46 个文件改动（删 23 / 增 14 / 改 9），净 -4080 行。
修改的代码文件：
   - 删除：`packages/`、`mvp-web/src/ucg/`、`mvp-web/public/{ucg,annotations}.json`、四个旧节点视图与聚合层、根 workspace package.json/lockfile
   - 新增：`mvp-web/src/fcg/{types,loader}.ts`、`mvp-web/src/graph/{fcgView,roleMeta,EpicNodeView,FeatureNodeView,StepNodeView,DetailsPanel}.tsx`、`mvp-web/public/features.json`、`prompts/{scan,sync}.md`、`README.md`
   - 改动：`mvp-web/{App,app/TopBar,graph/GraphCanvas,graph/layout,package.json}`、`.gitignore`
应当达成的效果：刷新 `http://localhost:5173/` 可看到示例 4 个功能、2 个 Epic 的语义流程图；左上角"概览/功能/流程"三档切换，双击 Epic→功能、双击 Feature→流程；流程视图里能直观看到"接收→校验→查用户→比对→签 token→返回 / 异步发邮件"这种动作链；详情面板可下钻到 step 的源码 refs（如 AI 在 prompt 中如实填写）；项目代码量大幅瘦身，仅保留 mvp-web 单仓库；任何 AI IDE 拷 prompts/scan.md 即可产出 features.json，prompts/sync.md 用于每轮改动后的增量同步；features.json 入库以便 review 与回滚。
下一步建议：在真实项目跑一次扫描模式，验证 AI 产出的 features.json 在画布上的真实质感与可读性，再决定是否补"画布内编辑标注 + 写回"或"细化跨 feature 视觉/搜索筛选"等增强。

---

问题13：用户要在重型项目 D:\桌面\github_project\Polisim 上跑扫描，并提出两个延伸问题：(a) 轻型 / 重型项目是否需要不同 prompt？(b) AI 是不是已有成熟的"扫描 skill"，prompt 只需要告诉它怎么用 skill + 扫到什么粒度？
解决方案：
1. 直接确认两个判断都对：
   - 轻 vs 重需要不同流程：上下文压力 / 产出策略 / 风险都不同；同一份 prompt 跑重型项目易漏功能、错关系、出现幻觉。
   - AI IDE 普遍内置代码探索能力（Cursor @Codebase / Claude Code Agent / Kiro context-gatherer / Copilot @workspace），但它们是"通用工具"，不是"语义提取 skill"——能找文件、读代码、追依赖，但不知道用户想要的"备菜→下锅→出锅"粒度。
2. 重构 prompts/ 目录为入口 + 两档执行：
   - `scan.md`：入口与规模自检；明确"用你 IDE 自带的探索能力，我不告诉你怎么遍历目录"；给出 5 维自检表（文件数 / 子模块 / 端点数 / 上下文是否一次能读完 / 业务领域数），命中任意 2 项重型即走 heavy；强制 AI 输出"我选了哪一档"。同时保留通用约束：命名规则、调用→语义反例对照、写入位置、schema 速查。
   - `scan-light.md`：适用 < 100 文件单仓库；一次性产出完整 features.json；强调步骤 (通读→划 epic→抽 feature→写 step+flow→挂 refs→cross_feature) 与粒度规则 (3-10 step / feature)；末尾保留完整 Schema 与自检清单。
   - `scan-heavy.md`：适用 ≥ 100 文件 / 多模块 / 多服务；四阶段策略：阶段1 建索引（只填 feature 骨架，不写 step）→ 阶段2 一个 epic 一个 epic 分块深入 → 阶段3 cross_feature 关系 → 阶段4 自检回补；显式给出节奏建议（每阶段开始/结束都要报告、累积输出超过 8KB 主动落盘）、边界情况协议（动态路由/共享中间件/生成代码/测试代码）、最终自检 checklist。
3. 三份 prompt 共用一份 Schema，避免 drift；schema 速查只在 scan.md 给出顶层结构，完整定义集中在 scan-light.md，scan-heavy.md 末尾引用以避免重复。
4. 同步更新 README：扫描章节描述"先 scan.md → 自检 → 选 light/heavy 子 prompt"的流程；目录结构里补全四份 prompt 文件的角色说明。
5. 给出 Polisim 的实操步骤：先把 scan.md 拷给 AI 触发自检 → 再拷对应子 prompt → 在阶段 1 (建索引) 后停一次确认 epic 划分 → 阶段 2 完成后产出 features.json → 拷回 mvp-web/public/。强调阶段 1 后中断检查是重型项目避免 AI 飘的关键节点。
6. 提交：`feat(prompts): 扫描 prompt 拆分为 light/heavy 两档，复用 IDE 自带探索能力`。
修改的代码文件：
   - 新增：`prompts/scan-light.md`、`prompts/scan-heavy.md`
   - 改动：`prompts/scan.md`（重写为入口 + 自检 + 路由）、`README.md`（更新扫描流程与目录说明）
应当达成的效果：用户可在任何 AI IDE 里直接拷用一组分级 prompt，AI 会先报告项目规模再选执行路径；轻型项目一次产出，重型项目按 4 阶段累积、可中途校准、显式落盘；AI 不再被要求重复实现"代码遍历"，而是借助 IDE 自身工具，prompt 仅约束粒度与节奏，跨 IDE 通用。下一步建议：在 Polisim 实跑一次扫描，回看 features.json 在画布上的可读性与覆盖度，再决定 prompt 是否针对特定栈（Python / 前后端分离 / 多服务）补特例。

---

问题14：用户提出使用流程的设想：(a) 把 prompt 拷进新项目；(b) 让 AI 知道首次扫描 / 每轮改动各做什么；(c) 是否应让 AI 先读 README 再自己生成规则文件 (AGENTS.md)；(d) 是否把整个 codeSee 拷到目标项目 Polisim 下面。
解决方案：
1. 直接答四个判断：(a)(b) 完全对；(c) 思路对，但应当由 codeSee 提供 AGENTS.md 模板而非让 AI 自行从 README 推导，避免跨项目质量参差不齐；(d) 不可——viewer (mvp-web) 自带数百兆 node_modules 会污染目标项目，多项目使用时升级困难，AI 在目标项目里要看见无关代码。
2. 确定新架构："viewer 与目标项目解耦"：viewer 留在 codeSee 仓库；目标项目仅注入 5 个小文件 (AGENTS.md + 4 份 prompts) + 1 个 .gitignore，全部位于目标项目根的 `AGENTS.md` 与 `.codesee/` 目录。
3. 新增 `templates/AGENTS.md`：作为 AI 协作开发的入口规则文件（兼容 Cursor/Claude Code/Codex/Kiro 等约定），定义三个触发：首次扫描（features.json 缺失/空时）、每轮代码改动后默认 sync、用户显式要求；定义"永远不要做"清单（不修改 prompts 文件、不修改 locked feature、不写到 .codesee 之外、不重命名既有 id）；附"调用 → 语义"反例对照表；附文件位置索引；要求 AI 在执行前先告知用户。
4. 全量改写 prompts 内的写入路径：`mvp-web/public/features.json` → `.codesee/features.json`；跨文件引用 `prompts/...md` → `.codesee/prompts/...md`，保证安装到目标项目后所有路径自洽。
5. mvp-web 加载层重构（loader.ts）：
   - `autoLoad`：优先读 localStorage（用户上次拖入的文件），其次 fetch `/features.json`（仓库自带示例）；
   - `loadFromFile`：File API 加载，校验 version=0 与 features 数组；
   - `loadFromText`：备用粘贴模式；
   - `clearStored`：清空 localStorage；
   - 验证函数返回 `LoadResult` 联合类型，区分 missing / invalid / ok 三态。
6. App 重构：全局监听拖拽（onDragOver/onDragLeave/onDrop），松手即加载；提供 `<input type=file>` 隐藏元素 + 顶栏"打开"按钮；空状态卡片提示用户拖入 `.codesee/features.json` 或运行 install 脚本；显示半透明 backdrop 蒙层与"松手即可加载"提示。
7. TopBar 增强：左侧加 sourceLabel 徽章显示当前数据来源（文件名 / "内置示例"）；右侧加"打开"按钮与"清除"按钮；状态徽章 no data / sample / live 区分清晰。
8. 一键安装脚本：
   - `scripts/install.ps1`（PowerShell）：参数 `<TargetDir> [-Force]`；自我定位（`$PSScriptRoot/..`）；安全检查（目标 ≠ codeSee 自身、目标存在）；写入 AGENTS.md（默认跳过已有，-Force 覆盖）、`.codesee/prompts/{scan,scan-light,scan-heavy,sync}.md`、`.codesee/.gitignore`（features.json 入库，仅忽略 cache/*.tmp）；末尾打印下一步操作与 viewer 启动命令。
   - `scripts/install.sh`（Bash）：等效实现，set -euo pipefail，参数 `<目标> [--force]`，便于 macOS/Linux 用户使用。
9. README 重写：突出"viewer 与目标项目解耦"的整体架构图；给出三步使用流程（install → 启动 viewer → AI 在目标项目里维护 features.json）；明确 viewer 一次启动多项目共享、用户拖入即可切换的工作模式；重写 codeSee 仓库结构说明，区分 viewer / prompts 模板源 / templates / install 脚本。
10. 验证：viewer `tsc -b` 0 错；vite build 通过（CSS gzip 6.91KB / JS gzip 134.46KB）；提交 `feat: viewer 与目标项目解耦，提供 AGENTS.md 模板与一键安装脚本`。
修改的代码文件：
   - 新增：`templates/AGENTS.md`、`scripts/install.ps1`、`scripts/install.sh`
   - 改动：`prompts/{scan,scan-light,scan-heavy,sync}.md`（路径全量改 .codesee）、`mvp-web/src/{App.tsx,fcg/loader.ts,app/TopBar.tsx}`、`README.md`
应当达成的效果：用户在 codeSee 根目录跑一次 `./scripts/install.ps1 <目标项目>` 即可完成集成，目标项目除 6 个轻量文件外不被污染；AI IDE 在目标项目里读 AGENTS.md 自动按"首次扫描 / 增量同步"两种触发维护 `.codesee/features.json`；viewer 独立运行，浏览器拖入或选择文件即可切换不同项目，localStorage 记忆上次打开；同一份 viewer + 同一套 prompts/templates 模板可服务任意数量的目标项目，符合"低侵入、可升级、跨项目共享"目标。下一步：在 Polisim 上跑一次 install + AI 扫描，验证整套流程的实际可用性与 features.json 的可读性。

---

问题15：用户实际跑 install.ps1 时遇到 PowerShell 解析错误"字符串缺少终止符"——根因是脚本中文输出在 PowerShell 5.1 下被默认 GBK 解码导致引号被切断。同时发现一个潜在风险：Polisim 已有自己的 AGENTS.md，原脚本"跳过或覆盖"二选一的策略不合适。
解决方案：
1. 重写 install.ps1 全部改为 ASCII 输出（避免任何控制台编码问题），同时设置 `$OutputEncoding = UTF8` 与 `[UTF8Encoding]::new($false)` 写文件，确保跨 PowerShell 版本（5.1 / 7+）一致行为。
2. 引入 AGENTS.md 智能追加机制：
   - 新增 `templates/AGENTS-snippet.md`：CodeSee 集成段落，用 `<!-- BEGIN: CodeSee integration -->` 与 `<!-- END: CodeSee integration -->` 标记包裹；
   - 三态处理：目标无 AGENTS.md → 直接拷贝完整模板；已有 AGENTS.md 但无 CodeSee 标记 → 追加 snippet 到末尾（自动补换行）；已有 AGENTS.md 且有标记 → 默认跳过保持幂等，`-Force` / `--force` 时按 BEGIN/END 标记原地替换段落（用字符串 IndexOf 切片，比正则更稳）。
3. install.sh 同步改造：核心追加逻辑用 grep -F + 内联 python3 段落实现 BEGIN/END 替换，便于跨平台；输出全部 ASCII。
4. 实测三种情况：
   - 首次跑 Polisim：成功追加 CodeSee 段落；
   - 第二次跑：报告 "CodeSee section already present, skipped"，幂等；
   - 加 `-Force` 跑：报告 "replaced existing CodeSee section"，原地刷新；
   - 用 `[System.IO.File]::ReadAllText(..., UTF8)` 读 Polisim 的 AGENTS.md 末尾验证：BEGIN/END 标记完整、Markdown 表格未被破坏、原 Polisim 内容（包括前面的 Harness、DESIGN.md 等章节）一字未改。
5. README 同步更新："已有 AGENTS.md 时追加而非跳过"的说明，避免用户误以为脚本会覆盖自己的规则。
6. 顺便确认上次"AGENTS.md exists, skipped"是旧版脚本的正确行为（未覆盖 Polisim 原文件）；通过 git status 验证 Polisim/AGENTS.md 不在 modified 列表，原内容完好。
7. 提交：`fix(install): 脚本改用 ASCII 输出避免编码错误；已有 AGENTS.md 时追加而非覆盖`。
修改的代码文件：
   - 新增：`templates/AGENTS-snippet.md`
   - 改动：`scripts/install.ps1`（ASCII 输出 + 三态追加逻辑）、`scripts/install.sh`（同步改造）、`README.md`
应当达成的效果：用户跑 install 脚本可以无视目标项目是否已有 AGENTS.md：没有就建、有就追加、再跑就幂等、加 -Force 就刷新；ASCII 输出在任意 PowerShell 版本下都不会被编码截断；Polisim 端 AGENTS.md 末尾已带完整 CodeSee 段落，AI 读到即可按触发 1 执行扫描，进入正式可用阶段。下一步：在 Polisim 实际触发扫描，跑完后把 .codesee/features.json 拖入 viewer 验证可视化效果。
