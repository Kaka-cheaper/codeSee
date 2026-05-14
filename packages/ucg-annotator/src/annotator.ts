import {
  ANNOTATIONS_VERSION,
  emptyAnnotations,
  type Annotation,
  type AnnotationsFile,
  type Ucg,
} from '@codesee/ucg-schema'
import { externalDepsOf, annotateClusterByHeuristic } from './heuristic.js'
import { inferClusters, membersOf } from './clustering.js'
import { annotateClustersByLlm, type LlmConfig } from './llm.js'

const PROVENANCE_HEUR = 'heuristic@v1'

export interface AnnotateOptions {
  /** 已有 annotations.json（用于保留 locked 标注） */
  existing?: AnnotationsFile
  /** LLM 配置；不提供则只跑启发式 */
  llm?: LlmConfig
  /** 强制覆盖：忽略 existing.locked */
  force?: boolean
  /** 进度日志（写到 stderr） */
  onLog?: (msg: string) => void
}

export async function annotate(
  ucg: Ucg,
  options: AnnotateOptions = {},
): Promise<AnnotationsFile> {
  const log = options.onLog ?? (() => {})
  const existing = options.existing ?? emptyAnnotations()
  const out: AnnotationsFile = { ...emptyAnnotations() }

  // 1. 簇定义
  const clusters = inferClusters(ucg)
  out.clusters = clusters

  // 2. 启发式打底
  log(`[annotator] 簇 ${clusters.length} 个，先跑启发式…`)
  const heuristicMap = new Map<string, Annotation>()
  for (const c of clusters) {
    const members = membersOf(c, ucg)
    if (members.length === 0) continue
    const deps = externalDepsOf(members, ucg)
    const r = annotateClusterByHeuristic(members, deps)
    heuristicMap.set(c.id, {
      label: r.label,
      summary: r.summary,
      tags: r.tags,
      confidence: r.confidence,
      provenance: PROVENANCE_HEUR,
      updated_at: new Date().toISOString(),
    })
  }

  // 3. LLM 增强（可选）：对启发式 confidence < 0.8 的簇升级
  if (options.llm) {
    const candidates = clusters.filter((c) => {
      const heur = heuristicMap.get(c.id)
      return heur && heur.confidence < 0.8
    })
    log(`[annotator] LLM 升级 ${candidates.length} 个簇…`)
    try {
      const enriched = await annotateClustersByLlm(
        options.llm,
        ucg,
        candidates.map((c) => ({
          id: c.id,
          members: membersOf(c, ucg),
          externalDeps: externalDepsOf(membersOf(c, ucg), ucg),
        })),
      )
      for (const e of enriched) {
        heuristicMap.set(e.clusterId, {
          label: e.label,
          summary: e.summary,
          tags: e.tags,
          confidence: 0.85,
          provenance: `llm@${options.llm.model}`,
          updated_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      log(`[annotator] LLM 失败，已降级到启发式: ${(err as Error).message}`)
    }
  }

  // 4. 合并 existing.locked
  for (const c of clusters) {
    const key = `cluster:${c.id}`
    const prev = existing.annotations[key]
    const next = heuristicMap.get(c.id)
    if (prev?.locked && !options.force) {
      out.annotations[key] = prev
    } else if (next) {
      out.annotations[key] = next
    }
  }

  // 保留 existing 中针对 node 的锁定标注（不因为没 LLM 节点级而丢失）
  for (const [k, v] of Object.entries(existing.annotations)) {
    if (!k.startsWith('node:')) continue
    if (v.locked || options.force) {
      out.annotations[k] = v
    }
  }

  return { ...out, version: ANNOTATIONS_VERSION }
}
