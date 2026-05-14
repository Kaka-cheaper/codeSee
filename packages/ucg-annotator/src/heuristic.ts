import type { Ucg, UcgNode } from '@codesee/ucg-schema'

/** 一组路径/文件名关键词到语义标签的映射，按命中数评分。 */
const PATH_HINTS: { match: RegExp; label: string; tags?: string[] }[] = [
  { match: /(^|\/)graph(\/|$)/i, label: '画布与图渲染', tags: ['canvas', 'graph'] },
  { match: /(^|\/)canvas(\/|$)/i, label: '画布', tags: ['canvas'] },
  { match: /(^|\/)ucg(\/|$)/i, label: 'UCG 数据合同', tags: ['schema'] },
  { match: /(^|\/)schema(\/|$)/i, label: '数据 Schema', tags: ['schema'] },
  { match: /(^|\/)ai(\/|$)/i, label: 'AI 集成', tags: ['ai'] },
  { match: /(^|\/)llm(\/|$)/i, label: 'LLM 接入', tags: ['llm'] },
  { match: /(^|\/)agent(\/|$)/i, label: 'Agent 编排', tags: ['agent'] },
  { match: /(^|\/)auth(\/|$)/i, label: '认证与登录', tags: ['auth'] },
  { match: /(^|\/)login(\/|$)/i, label: '登录流程', tags: ['auth', 'login'] },
  { match: /(^|\/)user(s?)(\/|$)/i, label: '用户管理', tags: ['user'] },
  { match: /(^|\/)payment(\/|$)/i, label: '支付', tags: ['payment'] },
  { match: /(^|\/)order(s?)(\/|$)/i, label: '订单', tags: ['order'] },
  { match: /(^|\/)route(r|s)?(\/|$)/i, label: '路由', tags: ['routing'] },
  { match: /(^|\/)api(\/|$)/i, label: 'API 接入层', tags: ['api'] },
  { match: /(^|\/)service(s?)(\/|$)/i, label: '业务服务', tags: ['service'] },
  { match: /(^|\/)repo(s|sitor(y|ies))?(\/|$)/i, label: '数据仓储', tags: ['repository'] },
  { match: /(^|\/)model(s?)(\/|$)/i, label: '数据模型', tags: ['model'] },
  { match: /(^|\/)entit(y|ies)(\/|$)/i, label: '领域实体', tags: ['entity'] },
  { match: /(^|\/)task(s?)(\/|$)/i, label: '异步任务', tags: ['task'] },
  { match: /(^|\/)job(s?)(\/|$)/i, label: '后台任务', tags: ['job'] },
  { match: /(^|\/)queue(\/|$)/i, label: '消息队列', tags: ['queue'] },
  { match: /(^|\/)util(s?)(\/|$)/i, label: '通用工具', tags: ['utility'] },
  { match: /(^|\/)lib(\/|$)/i, label: '通用工具', tags: ['utility'] },
  { match: /(^|\/)helper(s?)(\/|$)/i, label: '辅助函数', tags: ['utility'] },
  { match: /(^|\/)config(\/|$)/i, label: '配置', tags: ['config'] },
  { match: /(^|\/)test(s?)(\/|$)/i, label: '测试', tags: ['test'] },
  { match: /(^|\/)hook(s?)(\/|$)/i, label: 'React Hooks', tags: ['react'] },
  { match: /(^|\/)component(s?)(\/|$)/i, label: 'UI 组件', tags: ['ui'] },
  { match: /(^|\/)page(s?)(\/|$)/i, label: '页面', tags: ['ui'] },
  { match: /(^|\/)view(s?)(\/|$)/i, label: '视图', tags: ['ui'] },
  { match: /(^|\/)store(\/|$)/i, label: '状态管理', tags: ['state'] },
  { match: /(^|\/)state(\/|$)/i, label: '状态管理', tags: ['state'] },
  { match: /(^|\/)layout(\/|$)/i, label: '布局', tags: ['ui', 'layout'] },
  { match: /(^|\/)app(\/|$)/i, label: '应用主体', tags: ['app'] },
  { match: /(^|\/)cli(\/|$)/i, label: 'CLI 入口', tags: ['cli'] },
]

/** 命中关键词的依赖包，用来推断这个簇"在做什么" */
const DEP_HINTS: { dep: RegExp; tag: string; label?: string }[] = [
  { dep: /^@xyflow\/react$/, tag: 'react-flow', label: '画布与图渲染' },
  { dep: /^react($|\/)/, tag: 'react' },
  { dep: /^next($|\/)/, tag: 'next', label: 'Next.js 应用' },
  { dep: /^express$/, tag: 'http', label: 'HTTP 服务' },
  { dep: /^fastapi$/, tag: 'http', label: 'HTTP 服务' },
  { dep: /^flask$/, tag: 'http', label: 'HTTP 服务' },
  { dep: /^@nestjs\//, tag: 'http', label: 'HTTP 服务' },
  { dep: /^prisma$/, tag: 'orm' },
  { dep: /^typeorm$/, tag: 'orm' },
  { dep: /^sqlalchemy$/, tag: 'orm' },
  { dep: /^bcrypt$/, tag: 'auth' },
  { dep: /^jsonwebtoken$/, tag: 'auth' },
  { dep: /^pyjwt$/, tag: 'auth' },
  { dep: /^celery$/, tag: 'task' },
  { dep: /^bullmq$/, tag: 'task' },
  { dep: /^redis$/, tag: 'cache' },
  { dep: /^lucide-/, tag: 'ui' },
  { dep: /^tailwind/, tag: 'ui' },
  { dep: /^ts-morph$/, tag: 'static-analysis', label: '静态分析' },
  { dep: /^typescript$/, tag: 'compiler' },
]

export interface HeuristicResult {
  label: string
  summary?: string
  tags: string[]
  confidence: number
}

/**
 * 给一个"簇"打启发式标注。
 * 输入：簇成员（modules + 邻接 external）。
 */
export function annotateClusterByHeuristic(
  members: UcgNode[],
  externalDepsOfCluster: string[],
): HeuristicResult {
  const tagsSet = new Set<string>()
  const labelVotes = new Map<string, number>()

  // 路径线索（只看 module）
  for (const m of members) {
    if (m.kind !== 'module') continue
    const file = m.qualified_name
    for (const h of PATH_HINTS) {
      if (h.match.test(file)) {
        labelVotes.set(h.label, (labelVotes.get(h.label) ?? 0) + 1)
        h.tags?.forEach((t) => tagsSet.add(t))
      }
    }
  }

  // 依赖线索
  for (const dep of externalDepsOfCluster) {
    for (const h of DEP_HINTS) {
      if (h.dep.test(dep)) {
        tagsSet.add(h.tag)
        if (h.label) labelVotes.set(h.label, (labelVotes.get(h.label) ?? 0) + 1)
      }
    }
  }

  // external 簇的特殊处理
  if (members.length > 0 && members.every((m) => m.kind === 'external')) {
    return {
      label: '外部依赖',
      summary: `共 ${members.length} 个第三方包`,
      tags: ['external'],
      confidence: 1, // 这个判断不会错
    }
  }

  // root 簇
  if (members.length === 1 && members[0].kind === 'module') {
    const file = members[0].qualified_name
    if (/main\.[jt]sx?$/.test(file)) {
      return {
        label: '入口',
        summary: `${file} 应用启动文件`,
        tags: ['entry'],
        confidence: 0.9,
      }
    }
  }

  // 投票胜出 label
  let winnerLabel: string | undefined
  let winnerVotes = 0
  for (const [label, votes] of labelVotes) {
    if (votes > winnerVotes) {
      winnerLabel = label
      winnerVotes = votes
    }
  }

  if (winnerLabel) {
    return {
      label: winnerLabel,
      tags: [...tagsSet],
      confidence: 0.6, // 启发式：低置信度，建议人或 LLM 复核
      summary: summaryOfMembers(members),
    }
  }

  // 兜底：取首个 module 的最深一级目录名
  const first = members.find((m) => m.kind === 'module')
  if (first) {
    const dir = first.qualified_name.split('/').slice(-2, -1)[0] ?? '模块'
    return {
      label: dir,
      tags: [...tagsSet],
      confidence: 0.4,
      summary: summaryOfMembers(members),
    }
  }

  return { label: '未命名', tags: [], confidence: 0.3 }
}

/** 给单个 UCG 节点（function/class/method）打启发式标注 */
export function annotateNodeByHeuristic(node: UcgNode): HeuristicResult | null {
  // function/method 命名通常已经够清晰，仅在能从名字里提取动词时给 summary
  if (node.kind === 'function' || node.kind === 'method') {
    const verbs: Record<string, string> = {
      get: '查询',
      fetch: '获取',
      load: '加载',
      save: '保存',
      create: '创建',
      delete: '删除',
      update: '更新',
      find: '查找',
      list: '列出',
      validate: '校验',
      verify: '校验',
      send: '发送',
      handle: '处理',
      render: '渲染',
      build: '构建',
      parse: '解析',
      format: '格式化',
      compute: '计算',
      analyze: '分析',
    }
    const m = node.name.match(/^([a-zA-Z]+)/)
    const head = m?.[1]?.toLowerCase()
    const verb = head ? verbs[head] : undefined
    if (verb) {
      return {
        label: node.name,
        summary: verb,
        tags: [],
        confidence: 0.5,
      }
    }
  }
  return null
}

function summaryOfMembers(members: UcgNode[]): string {
  const files = members.filter((m) => m.kind === 'module').length
  const ext = members.filter((m) => m.kind === 'external').length
  const parts: string[] = []
  if (files) parts.push(`${files} 个模块`)
  if (ext) parts.push(`${ext} 个外部包`)
  return parts.join('，')
}

/** 汇总一个簇内"对外的依赖包名"列表（用于依赖线索） */
export function externalDepsOf(members: UcgNode[], ucg: Ucg): string[] {
  const memberIds = new Set(members.map((m) => m.id))
  const out: string[] = []
  for (const e of ucg.edges) {
    if (!memberIds.has(e.source)) continue
    if (memberIds.has(e.target)) continue
    const target = ucg.nodes.find((n) => n.id === e.target)
    if (target?.kind === 'external') out.push(target.qualified_name)
  }
  return [...new Set(out)]
}
