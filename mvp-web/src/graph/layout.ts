import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
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

const elk = new ELK()

/**
 * 主入口：用 ELK 做布局。
 *
 * 策略：
 * - 概览视图（epic 节点，少边）→ rectpacking 算法（紧凑矩形排列）
 * - 功能视图（feature 节点，按 epicId 分组）→ layered + compound nodes
 * - 流程视图（step 节点，有 flow 边）→ layered 有向图
 *
 * ELK 是异步的，所以这个函数返回 Promise。
 */
export async function layoutViewAsync(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
): Promise<LaidOutNode[]> {
  if (nodes.length === 0) return []

  const firstKind = nodes[0].kind
  if (firstKind === 'step') {
    return elkLayered(nodes, edges, 'RIGHT')
  }
  if (firstKind === 'epic') {
    return elkRectPacking(nodes)
  }
  // feature 视图：按 epicId 分组做 compound layout
  return elkGroupedFeatures(nodes, edges)
}

/**
 * 同步 fallback（用于 layoutWithMemory 等不方便 await 的场景）。
 * 简单网格，仅在 ELK 还没跑完时临时用。
 */
export function layoutViewSync(
  nodes: FcgViewNode[],
): LaidOutNode[] {
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
        x: col * (size.width + 40),
        y: row * (size.height + 40),
      },
    }
  })
}

/* --------------------------------------------------------- ELK 实现 */

async function elkRectPacking(nodes: FcgViewNode[]): Promise<LaidOutNode[]> {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'rectpacking',
      'elk.rectpacking.desiredAspectRatio': '1.6',
      'elk.spacing.nodeNode': '40',
      'elk.padding': '[top=20,left=20,bottom=20,right=20]',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_SIZE[n.kind].width,
      height: NODE_SIZE[n.kind].height,
    })),
    edges: [],
  }

  const result = await elk.layout(graph)
  return mapResult(nodes, result)
}

async function elkGroupedFeatures(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
): Promise<LaidOutNode[]> {
  // 按 epicId 分组
  const groups = new Map<string, FcgViewNode[]>()
  for (const n of nodes) {
    const epicId = n.kind === 'feature' ? (n.feature.epicId ?? '__none__') : '__none__'
    if (!groups.has(epicId)) groups.set(epicId, [])
    groups.get(epicId)!.push(n)
  }

  // 每个 group 是一个 compound node
  const children: ElkNode[] = []
  for (const [groupId, members] of groups) {
    children.push({
      id: `group:${groupId}`,
      layoutOptions: {
        'elk.algorithm': 'rectpacking',
        'elk.rectpacking.desiredAspectRatio': '2.0',
        'elk.spacing.nodeNode': '28',
        'elk.padding': '[top=16,left=16,bottom=16,right=16]',
      },
      children: members.map((n) => ({
        id: n.id,
        width: NODE_SIZE[n.kind].width,
        height: NODE_SIZE[n.kind].height,
      })),
      edges: [],
    })
  }

  // 跨组的边
  const elkEdges: ElkExtendedEdge[] = edges
    .filter((e) => {
      const sGroup = findGroup(e.source, groups)
      const tGroup = findGroup(e.target, groups)
      return sGroup !== tGroup
    })
    .map((e, i) => ({
      id: `elk-edge-${i}`,
      sources: [e.source],
      targets: [e.target],
    }))

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children,
    edges: elkEdges,
  }

  const result = await elk.layout(graph)
  return mapCompoundResult(nodes, result)
}

async function elkLayered(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
  direction: 'RIGHT' | 'DOWN' = 'RIGHT',
): Promise<LaidOutNode[]> {
  const elkEdges: ElkExtendedEdge[] = edges.map((e, i) => ({
    id: `elk-edge-${i}`,
    sources: [e.source],
    targets: [e.target],
  }))

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '36',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.padding': '[top=16,left=16,bottom=16,right=16]',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_SIZE[n.kind].width,
      height: NODE_SIZE[n.kind].height,
    })),
    edges: elkEdges,
  }

  const result = await elk.layout(graph)
  return mapResult(nodes, result)
}

/* --------------------------------------------------------- helpers */

function mapResult(nodes: FcgViewNode[], result: ElkNode): LaidOutNode[] {
  const posMap = new Map<string, { x: number; y: number }>()
  for (const child of result.children ?? []) {
    posMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }
  return nodes.map((n) => {
    const pos = posMap.get(n.id) ?? { x: 0, y: 0 }
    const size = NODE_SIZE[n.kind]
    return { view: n, width: size.width, height: size.height, position: pos }
  })
}

function mapCompoundResult(nodes: FcgViewNode[], result: ElkNode): LaidOutNode[] {
  const posMap = new Map<string, { x: number; y: number }>()
  for (const group of result.children ?? []) {
    const gx = group.x ?? 0
    const gy = group.y ?? 0
    for (const child of group.children ?? []) {
      posMap.set(child.id, { x: gx + (child.x ?? 0), y: gy + (child.y ?? 0) })
    }
  }
  return nodes.map((n) => {
    const pos = posMap.get(n.id) ?? { x: 0, y: 0 }
    const size = NODE_SIZE[n.kind]
    return { view: n, width: size.width, height: size.height, position: pos }
  })
}

function findGroup(nodeId: string, groups: Map<string, FcgViewNode[]>): string {
  for (const [groupId, members] of groups) {
    if (members.some((m) => m.id === nodeId)) return groupId
  }
  return '__none__'
}

/**
 * 给定一份"上一帧的位置"，把当前 nodes 的位置尽量保持稳定：
 * - 仍存在的节点：复用上次位置
 * - 新增节点：按新布局给的位置
 */
export function mergeWithPrevious(
  laid: LaidOutNode[],
  previous: Map<string, { x: number; y: number }>,
): { merged: LaidOutNode[]; newIds: Set<string> } {
  const newIds = new Set<string>()
  const merged = laid.map((n) => {
    const prev = previous.get(n.view.id)
    if (prev) return { ...n, position: prev }
    newIds.add(n.view.id)
    return n
  })
  return { merged, newIds }
}
