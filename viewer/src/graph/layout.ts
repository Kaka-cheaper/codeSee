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
  overviewPositions?: Map<string, { x: number; y: number }>,
): Promise<LayoutResult> {
  if (nodes.length === 0) return { nodes: [], groups: [] }

  const firstKind = nodes[0].kind
  if (firstKind === 'step') {
    return { nodes: await elkLayered(nodes, edges, 'RIGHT', measuredSizes), groups: [] }
  }
  if (firstKind === 'epic') {
    return { nodes: layoutByOrder(nodes), groups: [] }
  }
  // feature 视图：如果有概览位置缓存，用锚点布局；否则走 ELK
  if (overviewPositions && overviewPositions.size > 0) {
    return layoutFeaturesFromOverview(nodes, edges, overviewPositions, epicNames, measuredSizes)
  }
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

/**
 * 按 Epic.order 排列：同 order 横排，不同 order 纵排。
 * 列对齐：所有行使用相同列宽，相同列号的节点 x 坐标对齐，形成网格感。
 * importance 增强：core 节点排在行中央、auxiliary 排在行两端。
 * 兜底：单行超过 MAX_PER_ROW 时自动折行，避免一条横线。
 */
function layoutByOrder(nodes: FcgViewNode[]): LaidOutNode[] {
  const MAX_PER_ROW = 4

  // 按 order 分组
  const orderGroups = new Map<number, FcgViewNode[]>()
  for (const n of nodes) {
    const order = n.kind === 'epic' ? (n.epic.order ?? 99) : 99
    if (!orderGroups.has(order)) orderGroups.set(order, [])
    orderGroups.get(order)!.push(n)
  }

  // 每组内按 importance 排序：core 居中、auxiliary 两端
  for (const [, members] of orderGroups) {
    members.sort((a, b) => {
      const ia = importanceWeight(a)
      const ib = importanceWeight(b)
      return ia - ib // auxiliary(-1) 在前, normal(0) 中间, core(1) 在后
    })
    // 交错排列让 core 居中：auxiliary 放两端，core 放中间
    const sorted = interleaveForCenter(members)
    members.splice(0, members.length, ...sorted)
  }

  const sortedOrders = [...orderGroups.keys()].sort((a, b) => a - b)
  const COL_GAP = 48
  const ROW_GAP = 64

  const allWidths = nodes.map((n) => NODE_SIZE[n.kind].width)
  const allHeights = nodes.map((n) => NODE_SIZE[n.kind].height)
  const colWidth = Math.max(...allWidths)
  const rowHeight = Math.max(...allHeights)

  let maxCols = 1
  for (const order of sortedOrders) {
    const members = orderGroups.get(order)!
    for (let i = 0; i < members.length; i += MAX_PER_ROW) {
      const rowLen = Math.min(MAX_PER_ROW, members.length - i)
      if (rowLen > maxCols) maxCols = rowLen
    }
  }
  const totalWidth = maxCols * colWidth + (maxCols - 1) * COL_GAP

  const result: LaidOutNode[] = []
  let y = 0

  for (const order of sortedOrders) {
    const members = orderGroups.get(order)!
    for (let i = 0; i < members.length; i += MAX_PER_ROW) {
      const row = members.slice(i, i + MAX_PER_ROW)
      const rowWidth = row.length * colWidth + (row.length - 1) * COL_GAP
      const leftPad = (totalWidth - rowWidth) / 2

      row.forEach((n, colIdx) => {
        const size = NODE_SIZE[n.kind]
        const colCenterX = leftPad + colIdx * (colWidth + COL_GAP) + colWidth / 2 - totalWidth / 2
        const x = colCenterX - size.width / 2
        const rowCenterY = y + rowHeight / 2
        const ny = rowCenterY - size.height / 2

        result.push({
          view: n,
          width: size.width,
          height: size.height,
          position: { x, y: ny },
        })
      })

      y += rowHeight + ROW_GAP
    }
  }

  return result
}

/** importance 权重：用于排序 */
function importanceWeight(n: FcgViewNode): number {
  if (n.kind !== 'epic') return 0
  switch (n.epic.importance) {
    case 'core': return 1
    case 'auxiliary': return -1
    default: return 0
  }
}

/** 交错排列让高权重节点居中：[-1, 0, 0, 1] → [0, 1, 0, -1] 这种效果 */
function interleaveForCenter(arr: FcgViewNode[]): FcgViewNode[] {
  if (arr.length <= 2) return arr
  const sorted = [...arr].sort((a, b) => importanceWeight(b) - importanceWeight(a))
  const result: FcgViewNode[] = new Array(sorted.length)
  let left = 0
  let right = sorted.length - 1
  for (let i = 0; i < sorted.length; i++) {
    if (i % 2 === 0) {
      // 高权重放中间（从中心向外交替）
      const mid = Math.floor(sorted.length / 2) + (i % 2 === 0 ? Math.floor(i / 2) : -Math.ceil(i / 2))
      result[mid >= 0 && mid < sorted.length ? mid : left++] = sorted[i]
    } else {
      result[right--] = sorted[i]
    }
  }
  // 简化：直接用"core 放中间，auxiliary 放两端"的策略
  const core = arr.filter((n) => importanceWeight(n) === 1)
  const normal = arr.filter((n) => importanceWeight(n) === 0)
  const aux = arr.filter((n) => importanceWeight(n) === -1)
  // 排列：aux前半 + normal前半 + core + normal后半 + aux后半
  const auxHalf1 = aux.slice(0, Math.ceil(aux.length / 2))
  const auxHalf2 = aux.slice(Math.ceil(aux.length / 2))
  const normalHalf1 = normal.slice(0, Math.ceil(normal.length / 2))
  const normalHalf2 = normal.slice(Math.ceil(normal.length / 2))
  return [...auxHalf1, ...normalHalf1, ...core, ...normalHalf2, ...auxHalf2]
}

export async function elkRectPacking(nodes: FcgViewNode[], measuredSizes?: Map<string, { width: number; height: number }>): Promise<LaidOutNode[]> {
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
  let merged = result.nodes.map((n) => {
    const prev = previous.get(n.view.id)
    if (prev) return { ...n, position: prev }
    newIds.add(n.view.id)
    return n
  })
  // 新节点 vs 旧节点的碰撞检测：避免实时刷新时新节点撞在旧节点上
  if (newIds.size > 0) {
    merged = resolveNewNodeCollisions(merged, newIds)
  }
  return { merged, newIds, groups: result.groups }
}

/**
 * 节点级碰撞检测：新节点如果与旧节点（或已放置的新节点）重叠，向下/右推开。
 * 仅推动新节点，旧节点位置保持不变（保留用户拖动）。
 *
 * 算法：对每个新节点，按 8 方向（下/右/下右/右下/下左/左下/上右/右上）依次尝试，
 * 找到第一个不与任何已放置节点重叠的位置。
 */
function resolveNewNodeCollisions(
  nodes: LaidOutNode[],
  newIds: Set<string>,
): LaidOutNode[] {
  const NODE_GAP = 24

  const overlap = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean => {
    return (
      a.x < b.x + b.w + NODE_GAP &&
      a.x + a.w + NODE_GAP > b.x &&
      a.y < b.y + b.h + NODE_GAP &&
      a.y + a.h + NODE_GAP > b.y
    )
  }

  // 已放置的"占位矩形"列表（旧节点 + 已处理过的新节点）
  const placed: { id: string; x: number; y: number; w: number; h: number }[] = []
  for (const n of nodes) {
    if (newIds.has(n.view.id)) continue
    placed.push({ id: n.view.id, x: n.position.x, y: n.position.y, w: n.width, h: n.height })
  }

  return nodes.map((n) => {
    if (!newIds.has(n.view.id)) return n
    const rect = { x: n.position.x, y: n.position.y, w: n.width, h: n.height }

    // 检测是否撞到任何已放置节点
    const hasCollision = placed.some((p) => overlap(rect, p))
    if (!hasCollision) {
      placed.push({ id: n.view.id, ...rect })
      return n
    }

    // 螺旋搜索：以原位置为中心，按递增半径找空位
    const STEP = 40
    const MAX_RADIUS = 12 // 最多搜索 12 圈
    let found = false
    for (let r = 1; r <= MAX_RADIUS && !found; r++) {
      // 8 方向：右、下、左、上、右下、左下、右上、左上
      const candidates = [
        { dx: r, dy: 0 },
        { dx: 0, dy: r },
        { dx: -r, dy: 0 },
        { dx: 0, dy: -r },
        { dx: r, dy: r },
        { dx: -r, dy: r },
        { dx: r, dy: -r },
        { dx: -r, dy: -r },
      ]
      for (const { dx, dy } of candidates) {
        const candidate = {
          x: rect.x + dx * STEP,
          y: rect.y + dy * STEP,
          w: rect.w,
          h: rect.h,
        }
        if (!placed.some((p) => overlap(candidate, p))) {
          rect.x = candidate.x
          rect.y = candidate.y
          found = true
          break
        }
      }
    }

    placed.push({ id: n.view.id, ...rect })
    return { ...n, position: { x: rect.x, y: rect.y } }
  })
}


/* --------------------------------------------------------- 概览锚点布局（方案 C） */

const CONTAINER_PAD = 60
const CONTAINER_GAP = 80
const CANVAS_SCALE = 2.5
const INTRA_GAP_X = 40
const INTRA_GAP_Y = 32

/**
 * 功能视图布局：用概览视图的 Epic 坐标作为锚点，容器内按网格排列（用真实尺寸），全局矩形排斥防重叠。
 */
function layoutFeaturesFromOverview(
  nodes: FcgViewNode[],
  _edges: FcgViewEdge[],
  overviewPositions: Map<string, { x: number; y: number }>,
  epicNames?: Map<string, string>,
  measuredSizes?: Map<string, { width: number; height: number }>,
): LayoutResult {
  // 1. 按 epicId 分组
  const groups = new Map<string, FcgViewNode[]>()
  for (const n of nodes) {
    const epicId = n.kind === 'feature' ? (n.feature.epicId ?? '__none__') : '__none__'
    if (!groups.has(epicId)) groups.set(epicId, [])
    groups.get(epicId)!.push(n)
  }

  // 2. 计算每个容器的锚点和尺寸
  interface ContainerInfo {
    epicId: string
    anchorX: number
    anchorY: number
    width: number
    height: number
    members: FcgViewNode[]
    cellW: number
    cellH: number
    cols: number
  }
  const containers: ContainerInfo[] = []
  for (const [epicId, members] of groups) {
    const overviewKey = `epic:${epicId}`
    const pos = overviewPositions.get(overviewKey)
    const anchorX = pos ? pos.x * CANVAS_SCALE : 0
    const anchorY = pos ? pos.y * CANVAS_SCALE : 0

    // 用真实测量尺寸算 cell 大小（取该组内最大宽高 + gap）
    let maxW = NODE_SIZE.feature.width
    let maxH = NODE_SIZE.feature.height
    for (const m of members) {
      const s = measuredSizes?.get(m.id)
      if (s) {
        maxW = Math.max(maxW, s.width)
        maxH = Math.max(maxH, s.height)
      }
    }
    const cellW = maxW + INTRA_GAP_X
    const cellH = maxH + INTRA_GAP_Y

    const cols = Math.min(3, members.length)
    const rows = Math.ceil(members.length / cols)
    const width = cols * cellW + CONTAINER_PAD * 2
    const height = rows * cellH + CONTAINER_PAD * 2
    containers.push({ epicId, anchorX, anchorY, width, height, members, cellW, cellH, cols })
  }

  // 3. 矩形排斥：保证容器不重叠
  for (let iter = 0; iter < 20; iter++) {
    let moved = false
    for (let i = 0; i < containers.length; i++) {
      for (let j = i + 1; j < containers.length; j++) {
        const a = containers[i]
        const b = containers[j]
        const overlapX = (a.width / 2 + b.width / 2 + CONTAINER_GAP) - Math.abs(a.anchorX - b.anchorX)
        const overlapY = (a.height / 2 + b.height / 2 + CONTAINER_GAP) - Math.abs(a.anchorY - b.anchorY)
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 1
            if (a.anchorX <= b.anchorX) { a.anchorX -= push; b.anchorX += push }
            else { a.anchorX += push; b.anchorX -= push }
          } else {
            const push = overlapY / 2 + 1
            if (a.anchorY <= b.anchorY) { a.anchorY -= push; b.anchorY += push }
            else { a.anchorY += push; b.anchorY -= push }
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }

  // 4. 容器内按网格排列 Feature（用真实 cell 尺寸，保证不重叠）
  const result: LaidOutNode[] = []
  const layoutGroups: LayoutGroup[] = []

  for (const c of containers) {
    const startX = c.anchorX - c.width / 2 + CONTAINER_PAD
    const startY = c.anchorY - c.height / 2 + CONTAINER_PAD

    c.members.forEach((n, idx) => {
      const col = idx % c.cols
      const row = Math.floor(idx / c.cols)
      const size = measuredSizes?.get(n.id) ?? NODE_SIZE[n.kind]
      result.push({
        view: n,
        width: size.width,
        height: size.height,
        position: {
          x: startX + col * c.cellW,
          y: startY + row * c.cellH,
        },
      })
    })

    layoutGroups.push({
      id: `group:${c.epicId}`,
      label: epicNames?.get(c.epicId) ?? c.epicId,
      position: { x: c.anchorX - c.width / 2, y: c.anchorY - c.height / 2 },
      width: c.width,
      height: c.height,
    })
  }

  return { nodes: result, groups: layoutGroups }
}
