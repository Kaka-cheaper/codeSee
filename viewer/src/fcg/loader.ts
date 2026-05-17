import type { FeaturesFile } from './types'

const STORAGE_KEY = 'codesee.lastFeaturesFile.v0'

export type LoadResult =
  | { ok: true; file: FeaturesFile; sourceLabel: string; sourceKind: 'fetch' | 'storage' | 'upload'; raw?: string }
  | { ok: false; reason: 'missing' | 'invalid'; detail?: string }

/** 启动时尝试自动加载：优先 localStorage（用户上次打开的），其次 /features.json（仓库自带示例）。 */
export async function autoLoad(): Promise<LoadResult> {
  const fromStorage = loadFromStorage()
  if (fromStorage.ok) return fromStorage

  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const res = await fetch(`${base}features.json`, { cache: 'no-cache' })
    if (!res.ok) return { ok: false, reason: 'missing' }
    const raw = await res.text()
    const data = JSON.parse(raw) as FeaturesFile
    const valid = validate(data)
    if (!valid.ok) return valid
    return { ok: true, file: data, sourceLabel: '内置示例', sourceKind: 'fetch', raw }
  } catch {
    return { ok: false, reason: 'missing' }
  }
}

/** 内置示例的 URL（用于 watcher 轮询） */
export function getBundledExampleUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base}features.json`
}

/** 从用户上传的 File 加载 */
export async function loadFromFile(file: File): Promise<LoadResult> {
  try {
    const text = await file.text()
    const data = JSON.parse(text) as FeaturesFile
    const valid = validate(data)
    if (!valid.ok) return valid
    saveToStorage(data, file.name)
    return { ok: true, file: data, sourceLabel: file.name, sourceKind: 'upload' }
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

/** 加载文本（用于"粘贴 JSON"模式） */
export function loadFromText(text: string, label = 'paste'): LoadResult {
  try {
    const data = JSON.parse(text) as FeaturesFile
    const valid = validate(data)
    if (!valid.ok) return valid
    saveToStorage(data, label)
    return { ok: true, file: data, sourceLabel: label, sourceKind: 'upload' }
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

export function clearStored() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

/**
 * 从 URL 拉取 features.json（用于 watcher 轮询）。
 * 返回 raw text 用于内容对比，避免每次都 setState 引起重渲染。
 */
export async function fetchFromUrl(url: string): Promise<{ ok: true; raw: string; file: FeaturesFile } | { ok: false }> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return { ok: false }
    const raw = await res.text()
    const data = JSON.parse(raw) as FeaturesFile
    const valid = validate(data)
    if (!valid.ok) return { ok: false }
    return { ok: true, raw, file: data }
  } catch {
    return { ok: false }
  }
}

/* ----------------------------------------------------------------- helpers */

/**
 * v0.1 → v0.2 schema 兼容映射（仅迁移枚举值，结构保持不变）：
 *   cross_feature.kind: publishes / subscribes → flow
 *   epic_flow.kind:     enables → depends_on（同时反转 from/to）
 * 修改后的对象会被 validate 接受。
 *
 * 旧文件无需手动迁移——loader 自动转，AI 下次 sync 才按新枚举写。
 */
function migrateLegacyKinds(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const f = data as {
    cross_feature?: Array<{ kind?: string }>
    epic_flow?: Array<{ kind?: string; from?: string; to?: string }>
  }
  if (Array.isArray(f.cross_feature)) {
    for (const link of f.cross_feature) {
      if (link.kind === 'publishes' || link.kind === 'subscribes') {
        link.kind = 'flow'
      }
    }
  }
  if (Array.isArray(f.epic_flow)) {
    for (const ef of f.epic_flow) {
      if (ef.kind === 'enables') {
        // A enables B 等价于 B depends_on A：方向反转 + 改 kind
        const oldFrom = ef.from
        ef.from = ef.to
        ef.to = oldFrom
        ef.kind = 'depends_on'
      }
    }
  }
}

function validate(data: unknown): LoadResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'invalid', detail: '不是 JSON 对象' }
  }
  // 自动迁移老枚举值（影响后续视图渲染但不破坏 schema）
  migrateLegacyKinds(data)
  const f = data as Partial<FeaturesFile>
  if (f.version !== '0') {
    return { ok: false, reason: 'invalid', detail: 'version 不是 "0"' }
  }
  if (!Array.isArray(f.features)) {
    return { ok: false, reason: 'invalid', detail: '缺少 features 数组' }
  }
  return {
    ok: true,
    file: f as FeaturesFile,
    sourceLabel: '',
    sourceKind: 'fetch',
  }
}

function loadFromStorage(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ok: false, reason: 'missing' }
    const wrap = JSON.parse(raw) as { label: string; data: FeaturesFile }
    const valid = validate(wrap.data)
    if (!valid.ok) {
      // 缓存里是坏数据，立刻清掉避免下次刷新继续吃同样数据崩
      localStorage.removeItem(STORAGE_KEY)
      return valid
    }
    return { ok: true, file: wrap.data, sourceLabel: wrap.label, sourceKind: 'storage' }
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
    return { ok: false, reason: 'missing' }
  }
}

function saveToStorage(data: FeaturesFile, label: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ label, data }))
  } catch {
    /* quota exceeded 或浏览器禁用，忽略 */
  }
}
