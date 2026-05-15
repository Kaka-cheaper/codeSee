import type { FeaturesFile } from './types'

const STORAGE_KEY = 'codesee.lastFeaturesFile.v0'

export type LoadResult =
  | { ok: true; file: FeaturesFile; sourceLabel: string; sourceKind: 'fetch' | 'storage' | 'upload' }
  | { ok: false; reason: 'missing' | 'invalid'; detail?: string }

/** 启动时尝试自动加载：优先 localStorage（用户上次打开的），其次 /features.json（仓库自带示例）。 */
export async function autoLoad(): Promise<LoadResult> {
  const fromStorage = loadFromStorage()
  if (fromStorage.ok) return fromStorage

  try {
    const res = await fetch('/features.json', { cache: 'no-cache' })
    if (!res.ok) return { ok: false, reason: 'missing' }
    const data = (await res.json()) as FeaturesFile
    const valid = validate(data)
    if (!valid.ok) return valid
    return { ok: true, file: data, sourceLabel: '内置示例', sourceKind: 'fetch' }
  } catch {
    return { ok: false, reason: 'missing' }
  }
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

/* ----------------------------------------------------------------- helpers */

function validate(data: unknown): LoadResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'invalid', detail: '不是 JSON 对象' }
  }
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
