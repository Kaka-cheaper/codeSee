import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import type { FcgViewEdge, FcgViewNode } from './fcgView'

/**
 * 节点尺寸（与节点视图保持一致；估算用）。
 */
const NODE_SIZE: Record<FcgViewNode['kind'], { width: number; height: number }> = {
  epic: { width: 300, height: 100 },
  feature: { width: 320, height: 160 },
  step: { width: 240, height: 88 },
}

export interface LaidOutNode {
  view: FcgViewNode
  position: { x: number; y: number }
  width: number
  height: number
}

export interface LayoutGroup {
  id: string
  label: string
  position: { x: number; y: number }
  width: number
  height: number
}

export interface LayoutResult {
  nodes: LaidOutNode[]
  groups: LayoutGroup[]
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
  epicNames?: Map<string, string>,
  measuredSizes?: Map<string, { width: number; height: number }>,
): Promise<LayoutResult> {
  if (nodes.length === 0) return { nodes: [], groups: [] }

  const firstKind = nodes[0].kind
  if (firstKind === 'step') {
    return { nodes: await elkLayered(nodes, edges, 'RIGHT', measuredSizes), groups: [] }
  }
  if (firstKind === 'epic') {
    return { nodes: await elkRectPacking(nodes, measuredSizes), groups: [] }
  }
  // feature 视图：按 epicId 分组做 compound layout
  return elkGroupedFeatures(nodes, edges, epicNames, measuredSizes)
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

async function elkRectPacking(nodes: FcgViewNode[], measuredSizes?: Map<string, { width: number; height: number }>): Promise<LaidOutNode[]> {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'rectpacking',
      'elk.rectpacking.desiredAspectRatio': '1.6',
      'elk.spacing.nodeNode': '48',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: nodes.map((n) => {
      const size = measuredSizes?.get(n.id) ?? NODE_SIZE[n.kind]
      return { id: n.id, width: size.width, height: size.height }
    }),
    edges: [],
  }

  const result = await elk.layout(graph)
  return mapResult(nodes, result)
}

async function elkGroupedFeatures(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
  epicNames?: Map<string, string>,
  measuredSizes?: Map<string, { width: number; height: number }>,
): Promise<LayoutResult> {
  // 按 epicId 分组
  const groups = new Map<string, FcgViewNode[]>()
  for (const n of nodes) {
    const epicId = n.kind === 'feature' ? (n.feature.epicId ?? '__none__') : '__none__'
    if (!groups.has(epicId)) groups.set(epicId, [])
    groups.get(epicId)!.push(n)
  }

  // 每个 group 是一个 compound node（ELK parent）
  const children: ElkNode[] = []
  for (const [groupId, members] of groups) {
    // 组内的边
    const memberIds = new Set(members.map((m) => m.id))
    const intraEdges: ElkExtendedEdge[] = edges
      .filter((e) => memberIds.has(e.source) && memberIds.has(e.target))
      .map((e, i) => ({
        id: `intra-${groupId}-${i}`,
        sources: [e.source],
        targets: [e.target],
      }))

    children.push({
      id: `group:${groupId}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '52',
        'elk.layered.spacing.nodeNodeBetweenLayers': '72',
        'elk.padding': '[top=56,left=32,bottom=32,right=32]',
      },
      children: members.map((n) => {
        const size = measuredSizes?.get(n.id) ?? NODE_SIZE[n.kind]
        return { id: n.id, width: size.width, height: size.height }
      }),
      edges: intraEdges,
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
      id: `inter-edge-${i}`,
      sources: [e.source],
      targets: [e.target],
    }))

  // 根布局策略：有跨组边时用 layered（有方向意义），否则用 rectpacking（紧凑排列）
  const hasInterEdges = elkEdges.length > 0
  const rootOptions: Record<string, string> = hasInterEdges
    ? {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '64',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.padding': '[top=32,left=32,bottom=32,right=32]',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      }
    : {
        'elk.algorithm': 'rectpacking',
        'elk.rectpacking.desiredAspectRatio': '1.8',
        'elk.spacing.nodeNode': '56',
        'elk.padding': '[top=32,left=32,bottom=32,right=32]',
      }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: rootOptions,
    children,
    edges: elkEdges,
  }

  const result = await elk.layout(graph)
  const laidNodes = mapCompoundResult(nodes, result)

  // 提取 group 容器的位置和尺寸，用 Epic 的中文 name
  const layoutGroups: LayoutGroup[] = []
  for (const group of result.children ?? []) {
    const groupId = group.id.replace(/^group:/, '')
    const label = groupId === '__none__'
      ? '其他'
      : (epicNames?.get(groupId) ?? groupId)
    layoutGroups.push({
      id: group.id,
      label,
      position: { x: group.x ?? 0, y: group.y ?? 0 },
      width: group.width ?? 300,
      height: group.height ?? 200,
    })
  }

  return { nodes: laidNodes, groups: layoutGroups }
}

async function elkLayered(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
  direction: 'RIGHT' | 'DOWN' = 'RIGHT',
  measuredSizes?: Map<string, { width: number; height: number }>,
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
    children: nodes.map((n) => {
      const size = measuredSizes?.get(n.id) ?? NODE_SIZE[n.kind]
      return { id: n.id, width: size.width, height: size.height }
    }),
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
  result: LayoutResult,
  previous: Map<string, { x: number; y: number }>,
): { merged: LaidOutNode[]; newIds: Set<string>; groups: LayoutGroup[] } {
  const newIds = new Set<string>()
  const merged = result.nodes.map((n) => {
    const prev = previous.get(n.view.id)
    if (prev) return { ...n, position: prev }
    newIds.add(n.view.id)
    return n
  })
  return { merged, newIds, groups: result.groups }
}
