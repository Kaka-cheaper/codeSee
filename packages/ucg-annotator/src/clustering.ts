import type { ClusterDef, Ucg, UcgNode } from '@codesee/ucg-schema'

/**
 * 与画布端 aggregation.ts 保持一致的分组规则。
 * 单段 → 'root'；两段 → 第一段；≥三段 → 前两段。
 */
function groupKeyOfModule(node: UcgNode): string {
  const file = node.qualified_name
  const parts = file.split('/').filter(Boolean)
  if (parts.length <= 1) return 'root'
  if (parts.length === 2) return parts[0]
  return parts.slice(0, 2).join('/')
}

/**
 * 从 UCG 推断出默认的簇定义（按目录前缀）。
 * external 单独成簇。
 */
export function inferClusters(ucg: Ucg): ClusterDef[] {
  const seen = new Set<string>()
  const clusters: ClusterDef[] = []

  for (const n of ucg.nodes) {
    if (n.kind !== 'module') continue
    const key = groupKeyOfModule(n)
    const id = `group:${key}`
    if (seen.has(id)) continue
    seen.add(id)
    clusters.push({ id, pathPrefix: key })
  }

  if (ucg.nodes.some((n) => n.kind === 'external')) {
    clusters.push({ id: 'group:external', ids: [] }) // ids 留空，由 annotator 用 kind 解析
  }

  return clusters
}

/** 给定簇 + 完整 UCG，返回该簇包含的节点列表 */
export function membersOf(cluster: ClusterDef, ucg: Ucg): UcgNode[] {
  if (cluster.id === 'group:external') {
    return ucg.nodes.filter((n) => n.kind === 'external')
  }
  if (cluster.ids && cluster.ids.length > 0) {
    const set = new Set(cluster.ids)
    return ucg.nodes.filter((n) => set.has(n.id))
  }
  if (cluster.pathPrefix) {
    return ucg.nodes.filter(
      (n) => n.kind === 'module' && groupKeyOfModule(n) === cluster.pathPrefix,
    )
  }
  return []
}
