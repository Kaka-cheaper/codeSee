/**
 * 内置示例项目：始终可用、无需授权、做"看不懂就先看示例"的入口。
 *
 * URL 走 BASE_URL，部署到 GitHub Pages 等子路径也能正确解析。
 */

import { makeRepoId, type ProjectEntry } from './fileSystem'

export interface BundledProjectDef {
  /** 稳定的 slug，用于生成 repoId 和 fetch URL */
  slug: string
  displayName: string
  sourceLabel: string
  /** features.json 相对 BASE_URL 的路径 */
  path: string
  /** 可选的精挑布局 layout.json 路径——优先于 fallback。
   *  让首屏看到的 codesee/blog-system 等是"作者人挑过的"布局，而不是 ELK 默认输出。 */
  layoutPath?: string
}

const BUNDLED_DEFS: BundledProjectDef[] = [
  {
    slug: 'codesee',
    displayName: 'CodeSee',
    sourceLabel: '内置示例',
    path: 'features.json',
    layoutPath: 'examples/codesee-layout.json',
  },
  {
    slug: 'blog-system',
    displayName: '博客系统示例',
    sourceLabel: '内置示例',
    path: 'examples/blog-system.json',
  },
]

export function getBundledProjects(): (BundledProjectDef & { repoId: string; url: string; layoutUrl?: string })[] {
  const base = import.meta.env.BASE_URL ?? '/'
  return BUNDLED_DEFS.map((d) => ({
    ...d,
    repoId: makeRepoId('bundled', d.slug),
    url: `${base}${d.path}`,
    layoutUrl: d.layoutPath ? `${base}${d.layoutPath}` : undefined,
  }))
}

/** 把内置项目伪造成 ProjectEntry（用于和用户项目一起列在下拉菜单） */
export function bundledAsProjectEntry(): ProjectEntry[] {
  const now = Date.now()
  return getBundledProjects().map((b) => ({
    repoId: b.repoId,
    kind: 'bundled',
    displayName: b.displayName,
    sourceLabel: b.sourceLabel,
    bundledUrl: b.url,
    lastOpenedAt: 0, // 内置项目不会因"打开"提升排序
    addedAt: now,
  }))
}

/** 默认首启项目（CodeSee 自身） */
export function getDefaultBundledRepoId(): string {
  return makeRepoId('bundled', 'codesee')
}

export function findBundledByRepoId(repoId: string): (BundledProjectDef & { repoId: string; url: string; layoutUrl?: string }) | null {
  return getBundledProjects().find((b) => b.repoId === repoId) ?? null
}
