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
