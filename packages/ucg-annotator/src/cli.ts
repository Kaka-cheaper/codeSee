#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import type { AnnotationsFile, Ucg } from '@codesee/ucg-schema'
import { annotate } from './annotator.js'

interface Args {
  ucg: string
  out: string
  force: boolean
  llm: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    ucg: 'ucg.json',
    out: 'annotations.json',
    force: false,
    llm: false,
  }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--out':
      case '-o':
        args.out = argv[++i]
        break
      case '--force':
        args.force = true
        break
      case '--llm':
        args.llm = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
      default:
        if (a.startsWith('-')) {
          console.error(`未知参数: ${a}`)
          process.exit(1)
        }
        positional.push(a)
    }
  }
  if (positional.length > 0) args.ucg = positional[0]
  return args
}

function printHelp() {
  console.log(`
codesee-annotate — 为 UCG 生成语义标注（启发式 + 可选 LLM）

用法:
  codesee-annotate <ucg.json> [--out <annotations.json>] [--llm] [--force]

环境变量（启用 --llm 时使用）:
  CODESEE_LLM_BASE   OpenAI 兼容 base URL (默认 https://api.openai.com/v1)
  CODESEE_LLM_KEY    API Key (必填)
  CODESEE_LLM_MODEL  模型名 (默认 gpt-4o-mini)

示例:
  codesee-annotate ./mvp-web/public/ucg.json -o ./mvp-web/public/annotations.json
  codesee-annotate ./mvp-web/public/ucg.json -o ./mvp-web/public/annotations.json --llm
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const ucgPath = path.resolve(args.ucg)
  if (!fs.existsSync(ucgPath)) {
    console.error(`UCG 文件不存在: ${ucgPath}`)
    process.exit(1)
  }

  const ucg = JSON.parse(fs.readFileSync(ucgPath, 'utf-8')) as Ucg

  const outPath = path.resolve(args.out)
  let existing: AnnotationsFile | undefined
  if (fs.existsSync(outPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'))
      console.error(`[annotator] 已加载现有标注: ${outPath}`)
    } catch {
      console.error(`[annotator] 警告：无法解析现有 ${outPath}，将创建新文件`)
    }
  }

  const llmConfig = args.llm ? buildLlmConfig() : undefined
  if (args.llm && !llmConfig) {
    console.error('[annotator] 缺少 CODESEE_LLM_KEY，跳过 LLM，回退到启发式')
  }

  const start = Date.now()
  const result = await annotate(ucg, {
    existing,
    llm: llmConfig,
    force: args.force,
    onLog: (m) => console.error(m),
  })
  const elapsed = Date.now() - start

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')

  const total = Object.keys(result.annotations).length
  console.error(
    `[annotator] 簇 ${result.clusters.length} · 标注 ${total} · 用时 ${elapsed}ms`,
  )
  console.error(`[annotator] 输出: ${outPath}`)
}

function buildLlmConfig() {
  const key = process.env.CODESEE_LLM_KEY
  if (!key) return undefined
  return {
    apiKey: key,
    baseUrl: process.env.CODESEE_LLM_BASE ?? 'https://api.openai.com/v1',
    model: process.env.CODESEE_LLM_MODEL ?? 'gpt-4o-mini',
  }
}

main().catch((err) => {
  console.error('[annotator] 失败:', err)
  process.exit(1)
})
