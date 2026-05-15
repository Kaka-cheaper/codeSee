/**
 * 节点位置持久化到 localStorage（浏览器无感记忆）。
 * 按 manifest.repo 区分不同项目，按 viewKey 区分不同视图。
 */

const STORAGE_PREFIX = 'codesee.positions.v1.'

type Position = { x: number; y: number }
type ViewPositions = Map<string /* nodeId */, Position>
type AllPositions = Map<string /* viewKey */, ViewPositions>

function getStorageKey(repoId: string): string {
  return `${STORAGE_PREFIX}${repoId}`
}

export function loadPositions(repoId: string): AllPositions {
  try {
    const raw = localStorage.getItem(getStorageKey(repoId))
    if (!raw) return new Map()
    const data = JSON.parse(raw) as Record<string, Record<string, Position>>
    const result: AllPositions = new Map()
    for (const [viewKey, positions] of Object.entries(data)) {
      result.set(viewKey, new Map(Object.entries(positions)))
    }
    return result
  } catch {
    return new Map()
  }
}

export function savePositions(repoId: string, positions: AllPositions): void {
  try {
    const data: Record<string, Record<string, Position>> = {}
    for (const [viewKey, viewPositions] of positions) {
      if (viewPositions.size === 0) continue
      data[viewKey] = Object.fromEntries(viewPositions)
    }
    if (Object.keys(data).length === 0) {
      localStorage.removeItem(getStorageKey(repoId))
    } else {
      localStorage.setItem(getStorageKey(repoId), JSON.stringify(data))
    }
  } catch {
    /* quota exceeded 或浏览器禁用，忽略 */
  }
}

/** 清掉某视图的位置（重置布局时用）；不传 viewKey 则清掉整个 repo */
export function clearPositions(repoId: string, viewKey?: string): void {
  if (!viewKey) {
    try {
      localStorage.removeItem(getStorageKey(repoId))
    } catch {
      /* noop */
    }
    return
  }
  const all = loadPositions(repoId)
  all.delete(viewKey)
  savePositions(repoId, all)
}
