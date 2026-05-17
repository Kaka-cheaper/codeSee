import type {
  Epic,
  Feature,
  FeaturesFile,
  Flow,
  FlowKind,
  Step,
  StepRole,
} from '@/fcg/types'

export type ViewMode = 'overview' | 'features' | 'steps'

export type FcgViewNode =
  | {
      id: string
      kind: 'epic'
      epic: Epic
      featureCount: number
    }
  | {
      id: string
      kind: 'feature'
      feature: Feature
    }
  | {
      id: string
      kind: 'step'
      step: Step
      featureId: string
      stepRole: StepRole
    }

export interface FcgViewEdge {
  id: string
  source: string
  target: string
  kind:
    | FlowKind
    | 'epic-link'
    | 'cross-triggers'
    | 'cross-depends_on'
    | 'cross-publishes'
    | 'cross-subscribes'
  label?: string
  /** 跨功能 / 流程内 */
  scope: 'epic' | 'feature' | 'step'
  /** conditional / loop 条件 */
  condition?: string
}

export interface FcgViewState {
  mode: ViewMode
  /** mode=steps 时聚焦的 feature id */
  focusedFeatureId?: string
}

export interface FcgViewResult {
  nodes: FcgViewNode[]
  edges: FcgViewEdge[]
}

/* ----------------------------------------------------------- public API */

export function buildView(file: FeaturesFile, state: FcgViewState): FcgViewResult {
  if (state.mode === 'steps' && state.focusedFeatureId) {
    return buildStepsView(file, state.focusedFeatureId)
  }
  if (state.mode === 'features') {
    return buildFeaturesView(file)
  }
  return buildOverviewView(file)
}

/* ----------------------------------------------------------- impl */

function buildOverviewView(file: FeaturesFile): FcgViewResult {
  const nodes: FcgViewNode[] = []
  const featureCountByEpic = new Map<string, number>()
  for (const f of file.features) {
    const k = f.epicId ?? '__none__'
    featureCountByEpic.set(k, (featureCountByEpic.get(k) ?? 0) + 1)
  }

  for (const e of file.epics) {
    nodes.push({
      id: `epic:${e.id}`,
      kind: 'epic',
      epic: e,
      featureCount: featureCountByEpic.get(e.id) ?? 0,
    })
  }
  // 没归 Epic 的 features 单独一个虚拟 Epic
  if (featureCountByEpic.has('__none__')) {
    nodes.push({
      id: 'epic:__none__',
      kind: 'epic',
      epic: { id: '__none__', name: '其他', summary: '未归属到 Epic 的功能' },
      featureCount: featureCountByEpic.get('__none__') ?? 0,
    })
  }

  // overview 边：只用 epic_flow 主线，不再上卷 cross_feature（那些细节留给功能视图）
  const edges: FcgViewEdge[] = []
  for (const ef of file.epic_flow ?? []) {
    const sourceId = `epic:${ef.from}`
    const targetId = `epic:${ef.to}`
    // 确保两端 Epic 都存在
    if (!nodes.some((n) => n.id === sourceId) || !nodes.some((n) => n.id === targetId)) continue
    edges.push({
      id: `epic-flow:${ef.from}->${ef.to}`,
      source: sourceId,
      target: targetId,
      kind: 'epic-link',
      scope: 'epic',
      label: ef.note ?? undefined, // 语义级标签，如"配置完成后运行"
    })
  }

  return { nodes, edges }
}

function buildFeaturesView(file: FeaturesFile): FcgViewResult {
  const nodes: FcgViewNode[] = file.features.map((f) => ({
    id: `feature:${f.id}`,
    kind: 'feature',
    feature: f,
  }))
  const edges: FcgViewEdge[] = (file.cross_feature ?? []).map((link, i) => ({
    id: `feature-link:${i}`,
    source: `feature:${link.from}`,
    target: `feature:${link.to}`,
    kind: `cross-${link.kind}` as FcgViewEdge['kind'],
    scope: 'feature',
    // note 是语义级中文短句，比技术词 'triggers' 可读得多
    label: link.note,
  }))
  return { nodes, edges }
}

function buildStepsView(file: FeaturesFile, featureId: string): FcgViewResult {
  const f = file.features.find((x) => x.id === featureId)
  if (!f) return { nodes: [], edges: [] }
  const nodes: FcgViewNode[] = f.steps.map<FcgViewNode>((s) => ({
    id: `step:${f.id}:${s.id}`,
    kind: 'step',
    step: s,
    featureId: f.id,
    stepRole: s.role,
  }))
  const edges: FcgViewEdge[] = f.flow.map<FcgViewEdge>((fl, i) => ({
    id: `flow:${f.id}:${i}`,
    source: `step:${f.id}:${fl.from}`,
    target: `step:${f.id}:${fl.to}`,
    kind: fl.kind,
    scope: 'step',
    condition: fl.condition,
    label: flowLabel(fl),
  }))
  return { nodes, edges }
}

function flowLabel(f: Flow): string | undefined {
  if (f.kind === 'next') return undefined
  if (f.condition) return `${labelOfKind(f.kind)} · ${f.condition}`
  return labelOfKind(f.kind)
}

function labelOfKind(k: FlowKind): string {
  switch (k) {
    case 'next':
      return ''
    case 'async':
      return '异步'
    case 'conditional':
      return '条件'
    case 'loop':
      return '循环'
    case 'error':
      return '错误'
  }
}
