import type { Ucg } from './types'
import { sampleUcg } from './sample'

/**
 * 加载 UCG：
 * 1. 尝试 fetch 项目根的 /ucg.json（由适配器生成到 public/）
 * 2. 失败则回退到内置 sampleUcg
 */
export async function loadUcg(): Promise<{ ucg: Ucg; source: 'fetched' | 'sample' }> {
  try {
    const res = await fetch('/ucg.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ucg = (await res.json()) as Ucg
    if (!ucg.version || !Array.isArray(ucg.nodes) || !Array.isArray(ucg.edges)) {
      throw new Error('ucg.json 结构不符合 UCG schema')
    }
    return { ucg, source: 'fetched' }
  } catch {
    return { ucg: sampleUcg, source: 'sample' }
  }
}
