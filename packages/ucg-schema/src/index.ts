/**
 * Universal Code Graph (UCG) — v0 minimal schema.
 *
 * 这是上层（画布 / AI 语义层）唯一允许消费的合同。
 * 任何语言适配器（TS / Python / Go ...）的输出都必须落到这个结构。
 * 上层代码不得依赖任何具体语言或工具的概念。
 */

export const UCG_VERSION = '0' as const

export type NodeKind =
  | 'module'
  | 'class'
  | 'function'
  | 'method'
  | 'route'
  | 'task'
  | 'signal'
  | 'data_model'
  | 'external'

export type EdgeKind =
  | 'call'
  | 'import'
  | 'inherit'
  | 'read'
  | 'write'
  | 'route_to'
  | 'publish'
  | 'subscribe'
  | 'contains'

export interface UcgLocation {
  file: string
  start_line: number
  end_line: number
}

export interface UcgNode {
  /** 稳定指纹：file + qualified_name + kind 哈希。跨次运行不变。 */
  id: string
  kind: NodeKind
  name: string
  qualified_name: string
  location?: UcgLocation
  language: string
  /** drill-down 用代码片段，可选 */
  source_excerpt?: string
  /** 语言/框架特定字段，自由 KV，上层不得用来做逻辑分支 */
  meta?: Record<string, unknown>
}

export interface UcgEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
  /** 1.0 = 静态可证；<1.0 = 推断 / unresolved */
  confidence: number
  /** 哪个 adapter / plugin 产出了这条边 */
  provenance: string
  meta?: Record<string, unknown>
}

export interface UcgManifest {
  repo: string
  commit?: string
  toolchain: Record<string, string>
  generated_at: string
}

export interface UcgUnresolved {
  symbol: string
  context?: string
  reason?: string
}

export interface Ucg {
  version: typeof UCG_VERSION
  manifest: UcgManifest
  nodes: UcgNode[]
  edges: UcgEdge[]
  unresolved?: UcgUnresolved[]
}

/**
 * 计算节点稳定指纹。所有适配器必须用这个函数生成 id，
 * 否则跨适配器的同一节点 id 不一致，annotations 会失锚。
 */
export function nodeId(input: {
  file: string
  qualified_name: string
  kind: NodeKind
}): string {
  // 简单 FNV-1a 32bit，避免引入 crypto 依赖；对 MVP 足够。
  const s = `${input.kind}|${input.file}|${input.qualified_name}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return `${input.kind}:${h.toString(16).padStart(8, '0')}`
}

export function edgeId(input: { source: string; target: string; kind: EdgeKind }): string {
  const s = `${input.kind}|${input.source}|${input.target}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return `e:${h.toString(16).padStart(8, '0')}`
}


/* ---------------- Annotations (语义层，与结构层物理分离) ---------------- */

export const ANNOTATIONS_VERSION = '0' as const

/**
 * 一条注解可以挂在两类目标上：
 * - 单个 UCG 节点 (kind=node)：通过 node id 引用
 * - 一组 UCG 节点形成的"簇"(kind=cluster)：通过 path prefix 或显式 id 列表定义
 *
 * 标注内容只允许 label / summary / tags，不得改动结构字段。
 */

export type AnnotationTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'cluster'; clusterId: string }

export interface ClusterDef {
  id: string
  /** 用于匹配 module 的路径前缀。例：'src/graph' 会把所有 src/graph/** 模块归为此簇。
   *  与画布的 group key 复用同一规则；后续若引入 LLM 自由聚类，也允许显式 ids 列表。
   */
  pathPrefix?: string
  /** 显式成员（覆盖 pathPrefix）。任一 member id 命中即归簇。 */
  ids?: string[]
}

export interface Annotation {
  /** 简短语义标签，例：'画布渲染'、'静态分析'、'数据合同' */
  label: string
  /** 一句话说明（可选） */
  summary?: string
  /** 业务/架构标签（可选） */
  tags?: string[]
  /** 1.0 = 用户确认；<1.0 = AI 推测 */
  confidence: number
  /** 谁写的：'heuristic@v1' / 'llm@gpt-4o' / 'user' */
  provenance: string
  /** 用户锁定后下次重跑不会被覆盖 */
  locked?: boolean
  /** 创建/更新时间 */
  updated_at: string
}

export interface AnnotationsFile {
  version: typeof ANNOTATIONS_VERSION
  /** 簇定义（id → 定义） */
  clusters: ClusterDef[]
  /** target → annotation；target 用 'node:<id>' 或 'cluster:<id>' 形式做 key */
  annotations: Record<string, Annotation>
}

export function annotationKey(target: AnnotationTarget): string {
  if (target.kind === 'node') return `node:${target.nodeId}`
  return `cluster:${target.clusterId}`
}

export function emptyAnnotations(): AnnotationsFile {
  return { version: ANNOTATIONS_VERSION, clusters: [], annotations: {} }
}
