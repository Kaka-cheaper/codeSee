/**
 * Universal Code Graph (UCG) — v0 minimal schema.
 *
 * 这是上层（画布 / AI 语义层）唯一允许消费的合同。
 * 任何语言适配器（TS / Python / Go ...）的输出都必须落到这个结构。
 * 上层代码不得依赖任何具体语言或工具的概念。
 */

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
  /** 稳定指纹：path + qualified_name + kind 哈希。跨次运行不变。 */
  id: string
  kind: NodeKind
  name: string
  qualified_name: string
  location?: UcgLocation
  language: string
  /** drill-down 用，可选 */
  source_excerpt?: string
  /** 语言/框架特定字段，自由 KV，上层不得用做逻辑分支 */
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
  version: '0'
  manifest: UcgManifest
  nodes: UcgNode[]
  edges: UcgEdge[]
  unresolved?: UcgUnresolved[]
}
