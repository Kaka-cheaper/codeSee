import type { Ucg, UcgNode } from '@/ucg/types'

/**
 * 极简层级布局：按"距离最远入口"的最长路径分层，同层内按 kind 排列。
 * 入口 = 入度为 0 的节点（route / 无被调用的函数等）。
 * 当图有环时退化为按 BFS 层级。
 *
 * 这只是 MVP 用的占位布局，足够看清主线；后续会换 ELK / dagre。
 */

export interface LaidOutNode extends UcgNode {
  position: { x: number; y: number }
}

export function layoutUcg(ucg: Ucg): LaidOutNode[] {
  const { nodes, edges } = ucg
  const idToNode = new Map(nodes.map((n) => [n.id, n]))

  // 邻接表
  const out = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    out.set(n.id, [])
    inDeg.set(n.id, 0)
  }
  for (const e of edges) {
    if (!idToNode.has(e.source) || !idToNode.has(e.target)) continue
    out.get(e.source)!.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }

  // BFS 分层
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
  // 没分到层的（环）补一层
  for (const n of nodes) {
    if (!level.has(n.id)) level.set(n.id, 0)
  }

  // 按层分桶
  const buckets = new Map<number, UcgNode[]>()
  for (const n of nodes) {
    const lv = level.get(n.id) ?? 0
    if (!buckets.has(lv)) buckets.set(lv, [])
    buckets.get(lv)!.push(n)
  }

  const COL_GAP = 280
  const ROW_GAP = 110
  const result: LaidOutNode[] = []
  const sortedLevels = [...buckets.keys()].sort((a, b) => a - b)
  for (const lv of sortedLevels) {
    const list = buckets.get(lv)!
    list.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
    const total = list.length
    list.forEach((n, idx) => {
      const y = (idx - (total - 1) / 2) * ROW_GAP
      result.push({ ...n, position: { x: lv * COL_GAP, y } })
    })
  }
  return result
}
