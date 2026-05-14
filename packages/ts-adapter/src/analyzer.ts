import path from 'node:path'
import fs from 'node:fs'
import {
  Project,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type ClassDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type Identifier,
  type MethodDeclaration,
  type Node,
  type SourceFile,
  type VariableDeclaration,
} from 'ts-morph'
import {
  edgeId,
  nodeId,
  UCG_VERSION,
  type EdgeKind,
  type Ucg,
  type UcgEdge,
  type UcgNode,
  type UcgUnresolved,
} from '@codesee/ucg-schema'

const PROVENANCE = 'ts-adapter@0.0.1'

/** 函数类的 ts-morph 节点（顶层函数 / 箭头 / 函数表达式 / 方法） */
type CallableNode =
  | FunctionDeclaration
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration

interface AnalyzerOptions {
  /** 项目根目录 */
  rootDir: string
  /** 显示给上层的仓库标识 */
  repo?: string
  /** tsconfig 路径，找不到时退化为按 glob 加载 */
  tsConfigFilePath?: string
}

export function analyzeProject(options: AnalyzerOptions): Ucg {
  const rootDir = path.resolve(options.rootDir)
  const project = createProject(rootDir, options.tsConfigFilePath)

  const sourceFiles = project
    .getSourceFiles()
    .filter((sf) => !isExcluded(sf.getFilePath(), rootDir))

  const nodes = new Map<string, UcgNode>()
  const edges: UcgEdge[] = []
  const unresolved: UcgUnresolved[] = []

  /** 节点登记（去重） */
  const upsertNode = (n: UcgNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n)
  }

  /** 边登记（去重） */
  const seenEdge = new Set<string>()
  const addEdge = (
    source: string,
    target: string,
    kind: EdgeKind,
    confidence: number,
    meta?: Record<string, unknown>,
  ) => {
    const id = edgeId({ source, target, kind })
    if (seenEdge.has(id)) return
    seenEdge.add(id)
    edges.push({ id, source, target, kind, confidence, provenance: PROVENANCE, meta })
  }

  /** 给定 ts-morph 节点 → UcgNode（仅当属于本项目；外部包返回 external 节点） */
  const callableToUcgNode = (
    fn: CallableNode,
    forcedName?: string,
  ): UcgNode | null => {
    const sf = fn.getSourceFile()
    if (isExcluded(sf.getFilePath(), rootDir)) return null
    const file = relPath(rootDir, sf.getFilePath())
    const name = forcedName ?? getCallableName(fn) ?? '<anonymous>'
    const qualified = qualifyCallable(rootDir, fn, name)
    const kind = fn.getKind() === SyntaxKind.MethodDeclaration ? 'method' : 'function'
    const id = nodeId({ file, qualified_name: qualified, kind })
    return {
      id,
      kind,
      name,
      qualified_name: qualified,
      language: 'typescript',
      location: locationOf(fn),
      meta: { sourceFile: file },
    }
  }

  for (const sf of sourceFiles) {
    const file = relPath(rootDir, sf.getFilePath())
    const moduleId = nodeId({ file, qualified_name: file, kind: 'module' })
    upsertNode({
      id: moduleId,
      kind: 'module',
      name: path.basename(file),
      qualified_name: file,
      language: 'typescript',
      location: { file, start_line: 1, end_line: sf.getEndLineNumber() },
    })

    // import 边
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue()
      const target = imp.getModuleSpecifierSourceFile()
      if (target && !isExcluded(target.getFilePath(), rootDir)) {
        const targetFile = relPath(rootDir, target.getFilePath())
        const targetId = nodeId({
          file: targetFile,
          qualified_name: targetFile,
          kind: 'module',
        })
        upsertNode({
          id: targetId,
          kind: 'module',
          name: path.basename(targetFile),
          qualified_name: targetFile,
          language: 'typescript',
          location: { file: targetFile, start_line: 1, end_line: target.getEndLineNumber() },
        })
        addEdge(moduleId, targetId, 'import', 1)
      } else {
        const extId = externalNode(spec, upsertNode)
        addEdge(moduleId, extId, 'import', 1)
      }
    }

    // 顶层 class / function / variable→arrow
    for (const cls of sf.getClasses()) {
      registerClass(cls, moduleId, upsertNode, addEdge, callableToUcgNode, rootDir)
    }
    for (const fn of sf.getFunctions()) {
      const ucg = callableToUcgNode(fn)
      if (!ucg) continue
      upsertNode(ucg)
      addEdge(moduleId, ucg.id, 'contains', 1)
      collectCallsFrom(fn, ucg.id, addEdge, upsertNode, callableToUcgNode, unresolved, rootDir)
    }
    for (const v of sf.getVariableDeclarations()) {
      const arrow = v.getInitializerIfKind(SyntaxKind.ArrowFunction)
      const fnExpr = v.getInitializerIfKind(SyntaxKind.FunctionExpression)
      const callable = arrow ?? fnExpr
      if (!callable) continue
      const name = v.getName()
      const ucg = callableToUcgNode(callable, name)
      if (!ucg) continue
      upsertNode(ucg)
      addEdge(moduleId, ucg.id, 'contains', 1)
      collectCallsFrom(
        callable,
        ucg.id,
        addEdge,
        upsertNode,
        callableToUcgNode,
        unresolved,
        rootDir,
      )
    }
  }

  return {
    version: UCG_VERSION,
    manifest: {
      repo: options.repo ?? path.basename(rootDir),
      toolchain: { 'ts-adapter': '0.0.1' },
      generated_at: new Date().toISOString(),
    },
    nodes: [...nodes.values()],
    edges,
    unresolved: unresolved.length ? unresolved : undefined,
  }
}

/* ---------------------------------------------------------------- helpers */

function createProject(rootDir: string, tsConfigFilePath?: string): Project {
  const tsConfig =
    tsConfigFilePath ?? findFirstExisting(rootDir, ['tsconfig.app.json', 'tsconfig.json'])
  if (tsConfig) {
    return new Project({ tsConfigFilePath: tsConfig })
  }
  // 退化：按通配符加载
  const project = new Project({
    compilerOptions: { allowJs: false, jsx: 4 /* ReactJSX */ },
  })
  project.addSourceFilesAtPaths([
    `${rootDir}/**/*.{ts,tsx}`,
    `!${rootDir}/**/node_modules/**`,
    `!${rootDir}/**/dist/**`,
    `!${rootDir}/**/build/**`,
  ])
  return project
}

function findFirstExisting(rootDir: string, names: string[]): string | undefined {
  for (const n of names) {
    const p = path.join(rootDir, n)
    if (fs.existsSync(p)) return p
  }
  return undefined
}

function isExcluded(filePath: string, rootDir: string): boolean {
  const norm = filePath.replace(/\\/g, '/')
  if (norm.includes('/node_modules/')) return true
  if (norm.includes('/dist/') || norm.includes('/build/')) return true
  if (!norm.startsWith(rootDir.replace(/\\/g, '/'))) return true
  return false
}

function relPath(rootDir: string, abs: string): string {
  return path.relative(rootDir, abs).replace(/\\/g, '/')
}

function locationOf(node: Node) {
  const sf = node.getSourceFile()
  return {
    file: sf.getFilePath(),
    start_line: node.getStartLineNumber(),
    end_line: node.getEndLineNumber(),
  }
}

function getCallableName(fn: CallableNode): string | undefined {
  if (fn.getKind() === SyntaxKind.MethodDeclaration) {
    return (fn as MethodDeclaration).getName()
  }
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return (fn as FunctionDeclaration).getName()
  }
  // 箭头 / 函数表达式：尝试从父节点推断
  const parent = fn.getParent()
  if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
    return (parent as VariableDeclaration).getName()
  }
  return undefined
}

function qualifyCallable(rootDir: string, fn: CallableNode, name: string): string {
  const sf = fn.getSourceFile()
  const file = relPath(rootDir, sf.getFilePath())
  // method: 找包裹的 class
  if (fn.getKind() === SyntaxKind.MethodDeclaration) {
    const cls = (fn as MethodDeclaration).getParent()
    if (cls && cls.getKind() === SyntaxKind.ClassDeclaration) {
      const className = (cls as ClassDeclaration).getName() ?? '<anon>'
      return `${file}::${className}.${name}`
    }
  }
  return `${file}::${name}`
}

function externalNode(
  packageName: string,
  upsertNode: (n: UcgNode) => void,
): string {
  // 把 'lodash/fp' 这种归并到 'lodash'，'@scope/pkg/sub' 归并到 '@scope/pkg'
  const root = packageName.startsWith('@')
    ? packageName.split('/').slice(0, 2).join('/')
    : packageName.split('/')[0]
  const id = nodeId({ file: `external::${root}`, qualified_name: root, kind: 'external' })
  upsertNode({
    id,
    kind: 'external',
    name: root,
    qualified_name: root,
    language: 'typescript',
    meta: { package: root },
  })
  return id
}

function registerClass(
  cls: ClassDeclaration,
  moduleId: string,
  upsertNode: (n: UcgNode) => void,
  addEdge: (s: string, t: string, k: EdgeKind, c: number, m?: Record<string, unknown>) => void,
  callableToUcgNode: (fn: CallableNode, forcedName?: string) => UcgNode | null,
  rootDir: string,
) {
  const sf = cls.getSourceFile()
  const file = relPath(rootDir, sf.getFilePath())
  const name = cls.getName() ?? '<anon-class>'
  const qualified = `${file}::${name}`
  const id = nodeId({ file, qualified_name: qualified, kind: 'class' })
  upsertNode({
    id,
    kind: 'class',
    name,
    qualified_name: qualified,
    language: 'typescript',
    location: locationOf(cls),
  })
  addEdge(moduleId, id, 'contains', 1)

  // 继承
  const ext = cls.getExtends()
  if (ext) {
    // 仅作 unresolved 标记，MVP 不深挖跨文件类继承
    addEdge(id, externalSymbolNode(ext.getText(), upsertNode), 'inherit', 0.6, {
      note: 'inherit 暂未做精确解析',
    })
  }

  for (const m of cls.getMethods()) {
    const ucg = callableToUcgNode(m)
    if (!ucg) continue
    upsertNode(ucg)
    addEdge(id, ucg.id, 'contains', 1)
  }
}

function externalSymbolNode(
  symbol: string,
  upsertNode: (n: UcgNode) => void,
): string {
  const id = nodeId({
    file: `external::symbol::${symbol}`,
    qualified_name: symbol,
    kind: 'external',
  })
  upsertNode({
    id,
    kind: 'external',
    name: symbol,
    qualified_name: symbol,
    language: 'typescript',
    meta: { kind: 'symbol' },
  })
  return id
}

/** 收集 fn 函数体内的 call 边。
 *  对每个 CallExpression 取被调表达式的定义位置；若定义在项目内函数/方法上，建一条 call 边；
 *  否则归到 external 或 unresolved。
 */
function collectCallsFrom(
  fn: CallableNode,
  selfId: string,
  addEdge: (s: string, t: string, k: EdgeKind, c: number, m?: Record<string, unknown>) => void,
  upsertNode: (n: UcgNode) => void,
  callableToUcgNode: (fn: CallableNode, forcedName?: string) => UcgNode | null,
  unresolved: UcgUnresolved[],
  rootDir: string,
) {
  const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression)
  for (const c of calls) {
    const handled = handleCallExpression(
      c,
      selfId,
      addEdge,
      upsertNode,
      callableToUcgNode,
      rootDir,
    )
    if (!handled) {
      unresolved.push({
        symbol: c.getText().slice(0, 80),
        context: selfId,
        reason: 'callee 无法解析到具体声明',
      })
    }
  }
}

function handleCallExpression(
  call: CallExpression,
  selfId: string,
  addEdge: (s: string, t: string, k: EdgeKind, c: number, m?: Record<string, unknown>) => void,
  upsertNode: (n: UcgNode) => void,
  callableToUcgNode: (fn: CallableNode, forcedName?: string) => UcgNode | null,
  rootDir: string,
): boolean {
  const expr = call.getExpression()
  const id = expr.asKind(SyntaxKind.Identifier)
  const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression)
  const target = id ?? propAccess?.getNameNode()
  if (!target) return false

  // ts-morph 的 getDefinitions 走 LSP-like 路径，准确度高
  const definitions = (target as Identifier).getDefinitions?.()
  if (!definitions || definitions.length === 0) return false

  let matchedAny = false
  for (const def of definitions) {
    const declNode = def.getDeclarationNode()
    if (!declNode) continue
    const declSf = declNode.getSourceFile()
    if (!declSf) continue

    if (isExcluded(declSf.getFilePath(), rootDir)) {
      // 落到 external（按文件路径根目录推断包名）
      const pkg = guessPackageFromPath(declSf.getFilePath())
      if (!pkg) continue
      const extId = externalSymbolNode(pkg, upsertNode)
      addEdge(selfId, extId, 'call', 0.9, { external: pkg })
      matchedAny = true
      continue
    }

    const callable = pickCallable(declNode)
    if (!callable) continue
    const ucg = callableToUcgNode(callable)
    if (!ucg) continue
    upsertNode(ucg)
    addEdge(selfId, ucg.id, 'call', 1)
    matchedAny = true
  }
  return matchedAny
}

function pickCallable(node: Node): CallableNode | null {
  switch (node.getKind()) {
    case SyntaxKind.FunctionDeclaration:
      return node as FunctionDeclaration
    case SyntaxKind.MethodDeclaration:
      return node as MethodDeclaration
    case SyntaxKind.ArrowFunction:
      return node as ArrowFunction
    case SyntaxKind.FunctionExpression:
      return node as FunctionExpression
    case SyntaxKind.VariableDeclaration: {
      const v = node as VariableDeclaration
      const init =
        v.getInitializerIfKind(SyntaxKind.ArrowFunction) ??
        v.getInitializerIfKind(SyntaxKind.FunctionExpression)
      return init ?? null
    }
    default:
      return null
  }
}

function guessPackageFromPath(filePath: string): string | null {
  const norm = filePath.replace(/\\/g, '/')
  const m = norm.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/)
  return m ? m[1] : null
}
