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
  kind: FlowKind | 'epic-link' | 'feature-link'
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

  // overview 边：把跨 feature 的关系上卷到 epic 之间
  const edgeKey = new Set<string>()
  const edges: FcgViewEdge[] = []
  const featureToEpic = new Map<string, string>()
  for (const f of file.features) {
    featureToEpic.set(f.id, f.epicId ?? '__none__')
  }
  for (const link of file.cross_feature ?? []) {
    const s = featureToEpic.get(link.from)
    const t = featureToEpic.get(link.to)
    if (!s || !t || s === t) continue
    const id = `epic-link:${s}->${t}:${link.kind}`
    if (edgeKey.has(id)) continue
    edgeKey.add(id)
    edges.push({
      id,
      source: `epic:${s}`,
      target: `epic:${t}`,
      kind: 'epic-link',
      scope: 'epic',
      label: link.kind,
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
    kind: 'feature-link',
    scope: 'feature',
    label: link.kind,
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
