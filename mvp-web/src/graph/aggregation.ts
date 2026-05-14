import type { AnnotationsFile, Ucg, UcgNode } from '@/ucg/types'

/**
 * 视图聚合：从 UCG（结构真值）+ 展开状态 → 渲染层 nodes/edges。
 *
 * 默认 LOD：
 *  - 项目内 module 按目录前缀聚合为"包"节点（group）。
 *  - external 单独聚合为一个 "external 簇"节点。
 *  - function/method/class 默认不进入画布（保留在 UCG 中，drill-down 用）。
 *
 * 展开行为：
 *  - 双击 group 节点：展开 → 显示其内部 module 节点。
 *  - 再次双击：折叠回去。
 *  - 跨 group 的边在折叠端聚合为一条边（带计数）。
 */

export type ViewKind = 'group' | 'module' | 'external_group' | 'external_member'

export interface ViewNode {
  id: string
  kind: ViewKind
  label: string
  /** 仅在 group / external_group 时有意义：内部成员数 */
  memberCount?: number
  /** 仅在 group / module 时有意义：内部成员目录或文件 */
  pathHint?: string
  /** 链回 UCG 节点（仅 module / external_member） */
  ucg?: UcgNode
  /** group 是否已展开 */
  expanded?: boolean
  /** 语义标注（来自 annotations.json） */
  annotation?: {
    label: string
    summary?: string
    tags?: string[]
    confidence: number
    provenance: string
    locked?: boolean
  }
}

export interface ViewEdge {
  id: string
  source: string
  target: string
  /** 主要 edge kind，用 majority vote */
  kind: string
  count: number
  /** 是否包含低置信度边 */
  hasLowConfidence: boolean
}

export interface AggregatedView {
  nodes: ViewNode[]
  edges: ViewEdge[]
  /** 当前可展开 / 已展开的 group 列表，用于 UI 控制 */
  groups: { id: string; label: string; expanded: boolean; memberCount: number }[]
}

const EXTERNAL_GROUP_ID = 'group:external'
const EXTERNAL_GROUP_LABEL = 'external'

/** 取一个 module 节点的目录前缀，作为 group key。
 *  规则：
 *  - 只有一段（单层文件）→ 'root'
 *  - 两段及以上 → 取前两段 (src/graph)；若前两段中第二段是叶子文件，则只取第一段 (src)
 */
function groupKeyOfModule(node: UcgNode): string {
  const file = node.qualified_name
  const parts = file.split('/').filter(Boolean)
  if (parts.length <= 1) return 'root'
  if (parts.length === 2) return parts[0] // src/App.tsx → 'src'
  return parts.slice(0, 2).join('/')
}

export function aggregate(
  ucg: Ucg,
  expanded: ReadonlySet<string>,
  annotations?: AnnotationsFile | null,
): AggregatedView {
  // 1. 把 UCG 节点分桶
  const moduleByGroup = new Map<string, UcgNode[]>()
  const externalNodes: UcgNode[] = []

  for (const n of ucg.nodes) {
    if (n.kind === 'module') {
      const key = `group:${groupKeyOfModule(n)}`
      if (!moduleByGroup.has(key)) moduleByGroup.set(key, [])
      moduleByGroup.get(key)!.push(n)
    } else if (n.kind === 'external') {
      externalNodes.push(n)
    }
    // function / method / class 默认不进入聚合视图
  }

  // 2. 决定每个 ucg 节点最终落在哪个"可见 id"
  //    - module：若所属 group 展开 → 自身 id；否则 → group id
  //    - external：若 external_group 展开 → 自身 id；否则 → group:external
  //    - function/method/class：归到所在 module 所在 group / 或 module
  const visibleIdOf = new Map<string, string>()
  const moduleToGroup = new Map<string, string>()

  for (const [groupId, members] of moduleByGroup) {
    const isOpen = expanded.has(groupId)
    for (const m of members) {
      moduleToGroup.set(m.id, groupId)
      visibleIdOf.set(m.id, isOpen ? m.id : groupId)
    }
  }

  const externalOpen = expanded.has(EXTERNAL_GROUP_ID)
  for (const e of externalNodes) {
    visibleIdOf.set(e.id, externalOpen ? e.id : EXTERNAL_GROUP_ID)
  }

  // 把 function/method/class 也映射到它所在文件的可见 id（可能是 group 或 module）
  for (const n of ucg.nodes) {
    if (n.kind !== 'function' && n.kind !== 'method' && n.kind !== 'class') continue
    const sourceFile = (n.meta?.sourceFile as string | undefined) ?? n.location?.file
    if (!sourceFile) continue
    // 找同文件的 module
    const moduleNode = ucg.nodes.find(
      (m) => m.kind === 'module' && m.qualified_name === sourceFile,
    )
    if (!moduleNode) continue
    const targetVisible = visibleIdOf.get(moduleNode.id)
    if (targetVisible) visibleIdOf.set(n.id, targetVisible)
  }

  // 3. 构造可见节点
  const nodes: ViewNode[] = []
  const annot = (clusterId: string) => {
    const a = annotations?.annotations[`cluster:${clusterId}`]
    return a
      ? {
          label: a.label,
          summary: a.summary,
          tags: a.tags,
          confidence: a.confidence,
          provenance: a.provenance,
          locked: a.locked,
        }
      : undefined
  }
  for (const [groupId, members] of moduleByGroup) {
    const isOpen = expanded.has(groupId)
    if (isOpen) {
      for (const m of members) {
        nodes.push({
          id: m.id,
          kind: 'module',
          label: m.name,
          pathHint: m.qualified_name,
          ucg: m,
          annotation: annotations?.annotations[`node:${m.id}`]
            ? {
                label: annotations.annotations[`node:${m.id}`].label,
                summary: annotations.annotations[`node:${m.id}`].summary,
                tags: annotations.annotations[`node:${m.id}`].tags,
                confidence: annotations.annotations[`node:${m.id}`].confidence,
                provenance: annotations.annotations[`node:${m.id}`].provenance,
                locked: annotations.annotations[`node:${m.id}`].locked,
              }
            : undefined,
        })
      }
    } else {
      nodes.push({
        id: groupId,
        kind: 'group',
        label: groupId.replace(/^group:/, ''),
        memberCount: members.length,
        pathHint: groupId.replace(/^group:/, ''),
        expanded: false,
        annotation: annot(groupId),
      })
    }
  }
  if (externalNodes.length > 0) {
    if (externalOpen) {
      for (const e of externalNodes) {
        nodes.push({
          id: e.id,
          kind: 'external_member',
          label: e.name,
          ucg: e,
        })
      }
    } else {
      nodes.push({
        id: EXTERNAL_GROUP_ID,
        kind: 'external_group',
        label: EXTERNAL_GROUP_LABEL,
        memberCount: externalNodes.length,
        expanded: false,
        annotation: annot(EXTERNAL_GROUP_ID),
      })
    }
  }

  // 4. 聚合边
  type EdgeAccum = {
    source: string
    target: string
    kindCount: Map<string, number>
    count: number
    hasLowConfidence: boolean
  }
  const edgeMap = new Map<string, EdgeAccum>()

  for (const e of ucg.edges) {
    const s = visibleIdOf.get(e.source)
    const t = visibleIdOf.get(e.target)
    if (!s || !t) continue
    if (s === t) continue // 自环（同 group 内）忽略
    const key = `${s}->${t}`
    let acc = edgeMap.get(key)
    if (!acc) {
      acc = {
        source: s,
        target: t,
        kindCount: new Map(),
        count: 0,
        hasLowConfidence: false,
      }
      edgeMap.set(key, acc)
    }
    acc.count++
    acc.kindCount.set(e.kind, (acc.kindCount.get(e.kind) ?? 0) + 1)
    if (e.confidence < 1) acc.hasLowConfidence = true
  }

  const edges: ViewEdge[] = []
  for (const [key, acc] of edgeMap) {
    // majority kind
    let majority = 'call'
    let max = 0
    for (const [k, c] of acc.kindCount) {
      if (c > max) {
        max = c
        majority = k
      }
    }
    edges.push({
      id: `view:${key}`,
      source: acc.source,
      target: acc.target,
      kind: majority,
      count: acc.count,
      hasLowConfidence: acc.hasLowConfidence,
    })
  }

  // 5. 控件用 group 列表
  const groups: AggregatedView['groups'] = []
  for (const [groupId, members] of moduleByGroup) {
    groups.push({
      id: groupId,
      label: groupId.replace(/^group:/, ''),
      expanded: expanded.has(groupId),
      memberCount: members.length,
    })
  }
  if (externalNodes.length > 0) {
    groups.push({
      id: EXTERNAL_GROUP_ID,
      label: EXTERNAL_GROUP_LABEL,
      expanded: expanded.has(EXTERNAL_GROUP_ID),
      memberCount: externalNodes.length,
    })
  }

  return { nodes, edges, groups }
}

/** 暴露常量给上层使用 */
export const EXTERNAL_GROUP = EXTERNAL_GROUP_ID

/** 给定一个聚合视图节点 id，返回它对应的 UCG 节点（如果有）。
 *  group / external_group 没有 UCG 对应节点，返回 null。
 */
export function ucgOfView(node: ViewNode): UcgNode | null {
  return node.ucg ?? null
}

/** 工具：从 UCG 取出某 group 内的成员（用于详情面板展示） */
export function groupMembersOf(
  ucg: Ucg,
  groupId: string,
): UcgNode[] {
  if (groupId === EXTERNAL_GROUP_ID) {
    return ucg.nodes.filter((n) => n.kind === 'external')
  }
  const prefix = groupId.replace(/^group:/, '')
  return ucg.nodes.filter(
    (n) =>
      n.kind === 'module' &&
      (groupKeyOfModule(n) === prefix || n.qualified_name === prefix),
  )
}
