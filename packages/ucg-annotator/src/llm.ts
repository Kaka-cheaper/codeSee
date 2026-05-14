import type { Ucg, UcgNode } from '@codesee/ucg-schema'

export interface LlmConfig {
  /** OpenAI 兼容 API base，例：https://api.openai.com/v1 */
  baseUrl: string
  apiKey: string
  model: string
  /** 单次最多请求几个簇，避免上下文超限 */
  batchSize?: number
}

export interface LlmClusterAnnotation {
  clusterId: string
  label: string
  summary?: string
  tags?: string[]
}

interface ClusterPrompt {
  id: string
  members: { name: string; qualified_name: string }[]
  external_deps: string[]
  example_calls: { from: string; to: string; kind: string }[]
}

/**
 * 调用 LLM 给一批簇生成语义标注。
 * 协议：OpenAI Chat Completions 兼容。
 * 失败/超时时抛错由调用方降级到 heuristic。
 */
export async function annotateClustersByLlm(
  config: LlmConfig,
  ucg: Ucg,
  clustersToAnnotate: {
    id: string
    members: UcgNode[]
    externalDeps: string[]
  }[],
): Promise<LlmClusterAnnotation[]> {
  const batchSize = Math.max(1, config.batchSize ?? 8)
  const result: LlmClusterAnnotation[] = []

  for (let i = 0; i < clustersToAnnotate.length; i += batchSize) {
    const batch = clustersToAnnotate.slice(i, i + batchSize)
    const prompts: ClusterPrompt[] = batch.map((c) => ({
      id: c.id,
      members: c.members.map((m) => ({
        name: m.name,
        qualified_name: m.qualified_name,
      })),
      external_deps: c.externalDeps.slice(0, 12),
      example_calls: sampleEdges(ucg, c.members, 6),
    }))

    const annotations = await callLlmOnce(config, prompts)
    result.push(...annotations)
  }

  return result
}

function sampleEdges(
  ucg: Ucg,
  members: UcgNode[],
  limit: number,
): { from: string; to: string; kind: string }[] {
  const memberIds = new Set(members.map((m) => m.id))
  const out: { from: string; to: string; kind: string }[] = []
  for (const e of ucg.edges) {
    if (!memberIds.has(e.source)) continue
    if (memberIds.has(e.target)) continue
    const f = ucg.nodes.find((n) => n.id === e.source)
    const t = ucg.nodes.find((n) => n.id === e.target)
    if (!f || !t) continue
    out.push({ from: f.name, to: t.name, kind: e.kind })
    if (out.length >= limit) break
  }
  return out
}

const SYSTEM_PROMPT = `你是一个代码语义分析助手。我会给你一组"代码簇"，每个簇包含若干模块文件、外部依赖包和示例调用关系。

任务：为每个簇生成一个简洁、语义化的中文标签（不要直接照抄目录名），并给一句话职责说明。

要求：
1. label 必须是中文短语，2-8 字之间；体现这一簇做什么，而不是它的物理路径。
2. summary 一句话，不超过 25 字；说明这一簇在系统中扮演的角色。
3. tags 用英文小写，2-5 个；如 canvas / api / auth / state。
4. 严格输出 JSON：{ "results": [{ "id": "...", "label": "...", "summary": "...", "tags": [...] }] }
5. 不要解释，不要加 markdown 包裹，只输出 JSON。`

async function callLlmOnce(
  config: LlmConfig,
  prompts: ClusterPrompt[],
): Promise<LlmClusterAnnotation[]> {
  const userMsg = JSON.stringify({ clusters: prompts }, null, 2)

  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM 返回为空')

  let parsed: { results?: (LlmClusterAnnotation & { id?: string })[] }
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    throw new Error(`LLM 返回无法解析为 JSON: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed.results)) {
    throw new Error('LLM 返回缺少 results 数组')
  }
  // 兼容 LLM 偶尔输出 "id" 而不是 "clusterId"
  return parsed.results.map((r) => ({
    clusterId: r.clusterId ?? r.id ?? '',
    label: r.label,
    summary: r.summary,
    tags: r.tags,
  }))
}
