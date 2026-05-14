import type { ViewEdge, ViewNode } from './aggregation'

/**
 * 极简层级布局（占位）：BFS 分层 + 同层按 label 排序。
 * 接受聚合后的 ViewNode/ViewEdge，不再依赖具体语言。
 *
 * 后续会换成 dagre 或 ELK；当前节点数不大时这个够用。
 */

export interface LaidOutNode extends ViewNode {
  position: { x: number; y: number }
}

export function layoutView(
  nodes: ViewNode[],
  edges: ViewEdge[],
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

  const buckets = new Map<number, ViewNode[]>()
  for (const n of nodes) {
    const lv = level.get(n.id) ?? 0
    if (!buckets.has(lv)) buckets.set(lv, [])
    buckets.get(lv)!.push(n)
  }

  const COL_GAP = 320
  const ROW_GAP = 120
  const result: LaidOutNode[] = []
  const sortedLevels = [...buckets.keys()].sort((a, b) => a - b)
  for (const lv of sortedLevels) {
    const list = buckets.get(lv)!
    list.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label))
    const total = list.length
    list.forEach((n, idx) => {
      const y = (idx - (total - 1) / 2) * ROW_GAP
      result.push({ ...n, position: { x: lv * COL_GAP, y } })
    })
  }
  return result
}
