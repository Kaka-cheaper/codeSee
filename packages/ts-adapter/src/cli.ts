#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { analyzeProject } from './analyzer.js'

interface Args {
  rootDir: string
  out: string
  repo?: string
  tsConfig?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    rootDir: '.',
    out: 'ucg.json',
  }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--out':
      case '-o':
        args.out = argv[++i]
        break
      case '--repo':
        args.repo = argv[++i]
        break
      case '--tsconfig':
        args.tsConfig = argv[++i]
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
  if (positional.length > 0) args.rootDir = positional[0]
  return args
}

function printHelp() {
  console.log(`
codesee-ts — TypeScript 语言适配器（输出 UCG JSON）

用法:
  codesee-ts <rootDir> [--out <path>] [--repo <name>] [--tsconfig <path>]

示例:
  codesee-ts ./mvp-web --out ./mvp-web/public/ucg.json
`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = path.resolve(args.rootDir)
  if (!fs.existsSync(rootDir)) {
    console.error(`目录不存在: ${rootDir}`)
    process.exit(1)
  }

  console.error(`[ts-adapter] 扫描: ${rootDir}`)
  const start = Date.now()
  const ucg = analyzeProject({
    rootDir,
    repo: args.repo,
    tsConfigFilePath: args.tsConfig,
  })
  const elapsed = Date.now() - start

  const outPath = path.resolve(args.out)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(ucg, null, 2), 'utf-8')

  console.error(
    `[ts-adapter] 节点 ${ucg.nodes.length} 边 ${ucg.edges.length} unresolved ${
      ucg.unresolved?.length ?? 0
    } · 用时 ${elapsed}ms`,
  )
  console.error(`[ts-adapter] 输出: ${outPath}`)
}

main()
