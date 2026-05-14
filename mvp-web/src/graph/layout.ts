import type { FcgViewEdge, FcgViewNode } from './fcgView'

/**
 * 极简层级布局占位：BFS 分层 + 同层按 label 排序。
 * 后续可换 dagre / ELK；当前节点数不会很大（语义级），够用。
 */

export interface LaidOutNode {
  view: FcgViewNode
  position: { x: number; y: number }
}

export function layoutView(
  nodes: FcgViewNode[],
  edges: FcgViewEdge[],
): LaidOutNode[] {
  const idSet = new Set(nodes.map((n) => n.id))
  const out = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    out.set(n.id, [])
    inDeg.set(n.id, 0)
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue
    out.get(e.source)!.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }

  const level = new Map<string, number>()
  const queue: string[] = []
  for (const n of nodes) {
    if ((inDeg.get(n.id) ?? 0) === 0) {
      level.set(n.id, 0)
      queue.push(n.id)
    }
  }
  while (queue.length) {
    const id = queue.shift()!
    const lv = level.get(id)!
    for (const next of out.get(id) ?? []) {
      const candidate = lv + 1
      if (!level.has(next) || candidate > (level.get(next) ?? 0)) {
        level.set(next, candidate)
        queue.push(next)
      }
    }
  }
  for (const n of nodes) {
    if (!level.has(n.id)) level.set(n.id, 0)
  }

  const buckets = new Map<number, FcgViewNode[]>()
  for (const n of nodes) {
    const lv = level.get(n.id) ?? 0
    if (!buckets.has(lv)) buckets.set(lv, [])
    buckets.get(lv)!.push(n)
  }

  const COL_GAP = 280
  const ROW_GAP = 120
  const result: LaidOutNode[] = []
  const sortedLevels = [...buckets.keys()].sort((a, b) => a - b)
  for (const lv of sortedLevels) {
    const list = buckets.get(lv)!
    list.sort((a, b) => labelOf(a).localeCompare(labelOf(b)))
    const total = list.length
    list.forEach((n, idx) => {
      const y = (idx - (total - 1) / 2) * ROW_GAP
      result.push({ view: n, position: { x: lv * COL_GAP, y } })
    })
  }
  return result
}

function labelOf(n: FcgViewNode): string {
  if (n.kind === 'epic') return n.epic.name
  if (n.kind === 'feature') return n.feature.name
  return n.step.name
}
