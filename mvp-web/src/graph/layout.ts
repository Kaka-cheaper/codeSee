import dagre from '@dagrejs/dagre'
import type { FcgViewEdge, FcgViewNode } from './fcgView'

/**
 * 节点尺寸（与节点视图保持一致；估算用）。
 */
const NODE_SIZE: Record<FcgViewNode['kind'], { width: number; height: number }> = {
  epic: { width: 280, height: 96 },
  feature: { width: 280, height: 132 },
  step: { width: 220, height: 80 },
}

export interface LaidOutNode {
  view: FcgViewNode
  position: { x: number; y: number }
  width: number
  height: number
}

export interface LayoutOptions {
  /** 'LR' 横向（默认，流程图） / 'TB' 纵向 */
  direction?: 'LR' | 'TB'
  /** 同层节点间距 */
  nodesep?: number
  /** 不同层之间距 */
  ranksep?: number
}

/**
 * 主入口：根据节点类型自动选择布局策略。
 * - epic / feature 节点（概览/功能视图）→ 网格布局（不依赖边）
 * - step 节点（流程视图）→ dagre 有向图布局（依赖 flow 边）
 */
export function layoutView(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
  options: LayoutOptions = {},
): LaidOutNode[] {
  if (nodes.length === 0) return []

  const firstKind = nodes[0].kind
  if (firstKind === 'step') {
    return layoutDagre(nodes, edges, options)
  }
  return layoutGrid(nodes, edges)
}

/* --------------------------------------------------------- 网格布局 */

/**
 * 网格布局：按 Epic 分组，每组内 feature 横排，组之间纵排。
 * 概览视图：每个 Epic 是一个节点，直接网格排列。
 * 功能视图：按 epicId 分组，组内横排，组间纵排。
 */
function layoutGrid(nodes: FcgViewNode[], _edges: FcgViewEdge[]): LaidOutNode[] {
  const COL_GAP = 32
  const ROW_GAP = 32
  const GROUP_GAP = 48

  // 概览视图（全是 epic）
  if (nodes.every((n) => n.kind === 'epic')) {
    const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)))
    return nodes.map((n, i) => {
      const size = NODE_SIZE[n.kind]
      const col = i % cols
      const row = Math.floor(i / cols)
      return {
        view: n,
        width: size.width,
        height: size.height,
        position: {
          x: col * (size.width + COL_GAP),
          y: row * (size.height + ROW_GAP),
        },
      }
    })
  }

  // 功能视图（全是 feature）：按 epicId 分组
  const groups = new Map<string, FcgViewNode[]>()
  for (const n of nodes) {
    const epicId = n.kind === 'feature' ? (n.feature.epicId ?? '__none__') : '__none__'
    if (!groups.has(epicId)) groups.set(epicId, [])
    groups.get(epicId)!.push(n)
  }

  const result: LaidOutNode[] = []
  let groupY = 0
  const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(nodes.length / (groups.size || 1)))))

  for (const [, members] of groups) {
    let maxRowHeight = 0
    members.forEach((n, i) => {
      const size = NODE_SIZE[n.kind]
      const col = i % cols
      const row = Math.floor(i / cols)
      result.push({
        view: n,
        width: size.width,
        height: size.height,
        position: {
          x: col * (size.width + COL_GAP),
          y: groupY + row * (size.height + ROW_GAP),
        },
      })
      const bottom = row * (size.height + ROW_GAP) + size.height
      if (bottom > maxRowHeight) maxRowHeight = bottom
    })
    groupY += maxRowHeight + GROUP_GAP
  }

  return result
}

/* --------------------------------------------------------- dagre 布局 */

function layoutDagre(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
  options: LayoutOptions = {},
): LaidOutNode[] {
  const direction = options.direction ?? 'LR'
  const g = new dagre.graphlib.Graph({ multigraph: false, compound: false })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: options.nodesep ?? 36,
    ranksep: options.ranksep ?? 90,
    marginx: 16,
    marginy: 16,
    align: 'UL',
    acyclicer: 'greedy',
    ranker: 'tight-tree',
  })

  for (const n of nodes) {
    const size = NODE_SIZE[n.kind]
    g.setNode(n.id, { width: size.width, height: size.height })
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target)
    }
  }

  dagre.layout(g)

  return nodes.map((n) => {
    const layouted = g.node(n.id)
    const size = NODE_SIZE[n.kind]
    return {
      view: n,
      width: size.width,
      height: size.height,
      position: layouted
        ? { x: layouted.x - size.width / 2, y: layouted.y - size.height / 2 }
        : { x: 0, y: 0 },
    }
  })
}

/**
 * 给定一份"上一帧的位置"，把当前 nodes 的位置尽量保持稳定：
 * - 仍存在的节点：复用上次位置
 * - 新增节点：按新布局给的位置
 */
export function layoutWithMemory(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
  previous: Map<string, { x: number; y: number }>,
  options: LayoutOptions = {},
): { laid: LaidOutNode[]; newIds: Set<string> } {
  const fresh = layoutView(nodes, edges, options)
  const newIds = new Set<string>()
  const merged = fresh.map((n) => {
    const prev = previous.get(n.view.id)
    if (prev) return { ...n, position: prev }
    newIds.add(n.view.id)
    return n
  })
  return { laid: merged, newIds }
}
