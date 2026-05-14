import dagre from '@dagrejs/dagre'
import type { FcgViewEdge, FcgViewNode } from './fcgView'

/**
 * 节点尺寸（与节点视图保持一致；估算用，不需要精确）。
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

export function layoutView(
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
    acyclicer: 'greedy', // 容忍小环（loop 边）
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
    // dagre 给的是节点中心点；React Flow 接收的是左上角
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
 * - 新增节点：按 dagre 给的位置
 *
 * 这是动效的关键：旧节点不抖动，新节点淡入到位。
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
