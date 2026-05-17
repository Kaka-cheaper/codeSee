/**
 * 文件系统访问层 + 多项目元数据管理
 *
 * 设计：
 * - 'directories' store：FSA directory handle（key = repoId）
 * - 'uploads' store：上传/拖入文件的 features.json 快照（key = repoId）
 * - 'projects' store：项目元数据（key = repoId）
 *
 * 三种项目类型：
 *   - fsa：FSA 目录，可读写 layout.json，可实时刷新
 *   - upload：单文件，画布只读（不知目录），不能写 layout.json，不能实时刷新
 *   - bundled：内置示例（codesee 自身、电商示例），写死在前端
 *
 * 兼容性：
 * - Chromium 系：File System Access API
 * - Safari / Firefox：upload 模式仍可用（IndexedDB 存内容）；FSA 模式不可用
 */

const HANDLE_DB = 'codesee-fs-handles'
const HANDLE_STORE = 'directories'
const UPLOAD_STORE = 'uploads'
const PROJECTS_STORE = 'projects'
const DB_VERSION = 3

export type LayoutFile = {
  version: '0'
  views: Record<string, Record<string, { x: number; y: number }>>
  generated_at: string
}

export type ProjectKind = 'fsa' | 'upload' | 'bundled'

export interface ProjectEntry {
  repoId: string
  kind: ProjectKind
  displayName: string
  /** 仅展示用，二级标签：目录名 / 文件名 / "内置示例" */
  sourceLabel: string
  /** ms timestamp */
  lastOpenedAt: number
  addedAt: number
  featuresCount?: number
  epicsCount?: number
  /** bundled 项目的 fetch URL */
  bundledUrl?: string
}

/* ------------------------- IndexedDB ------------------------- */

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE)
      }
      if (!db.objectStoreNames.contains(UPLOAD_STORE)) {
        db.createObjectStore(UPLOAD_STORE)
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet<T>(store: string, key: string): Promise<T | null> {
  try {
    const db = await openHandleDB()
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function dbPut<T>(store: string, key: string, value: T): Promise<void> {
  try {
    const db = await openHandleDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch { /* noop */ }
}

async function dbDelete(store: string, key: string): Promise<void> {
  try {
    const db = await openHandleDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch { /* noop */ }
}

async function dbGetAll<T>(store: string): Promise<T[]> {
  try {
    const db = await openHandleDB()
    return await new Promise<T[]>((resolve) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve((req.result as T[]) ?? [])
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/* ------------------------- Directory Handle (FSA) ------------------------- */

export async function getStoredHandle(repoId: string): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) return null
  return dbGet<FileSystemDirectoryHandle>(HANDLE_STORE, repoId)
}

async function setStoredHandle(repoId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  await dbPut(HANDLE_STORE, repoId, handle)
}

async function clearStoredHandle(repoId: string): Promise<void> {
  await dbDelete(HANDLE_STORE, repoId)
}

/* ------------------------- 权限 ------------------------- */

export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  try {
    // @ts-expect-error queryPermission 不在标准 typings
    const cur = await handle.queryPermission(opts)
    if (cur === 'granted') return true
    // @ts-expect-error requestPermission 不在标准 typings
    const next = await handle.requestPermission(opts)
    return next === 'granted'
  } catch {
    return false
  }
}

export async function checkPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  try {
    // @ts-expect-error queryPermission 不在标准 typings
    const cur = await handle.queryPermission(opts)
    return cur === 'granted'
  } catch {
    return false
  }
}

/* ------------------------- 对外 API ------------------------- */

export function isFSASupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function hasAuthorized(repoId: string): Promise<boolean> {
  if (!isFSASupported()) return false
  const handle = await getStoredHandle(repoId)
  return handle !== null
}

/** 让用户选择包含 features.json 的目录。必须在用户手势同步调用栈内调用。 */
export async function pickDirectory(repoId: string): Promise<FileSystemDirectoryHandle | null> {
  if (!isFSASupported()) return null
  try {
    const safeId = `codesee-${repoId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    // @ts-expect-error showDirectoryPicker
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: safeId,
      mode: 'readwrite',
      startIn: 'documents',
    })
    await setStoredHandle(repoId, handle)
    return handle
  } catch {
    return null
  }
}

/** 取消授权（保留 project 元数据；如果要彻底删项目用 removeProject） */
export async function forgetDirectory(repoId: string): Promise<void> {
  await clearStoredHandle(repoId)
}

/**
 * 把一个临时 repoId 的 handle 搬到正式 repoId。
 * 用于 picker 弹完后才知道目录的真名。
 */
export async function promoteHandle(fromRepoId: string, toRepoId: string): Promise<void> {
  if (fromRepoId === toRepoId) return
  const handle = await dbGet<FileSystemDirectoryHandle>(HANDLE_STORE, fromRepoId)
  if (!handle) return
  await dbPut(HANDLE_STORE, toRepoId, handle)
  await dbDelete(HANDLE_STORE, fromRepoId)
}

/* ------------------------- features.json 读取 ------------------------- */

export type FeaturesReadResult = {
  raw: string
  lastModified: number
  fileName: string
}

/**
 * 在目录中查找 features.json：根目录 → .codesee/features.json
 */
export async function loadFeaturesFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
): Promise<FeaturesReadResult | null> {
  try {
    const fh = await dirHandle.getFileHandle('features.json')
    const file = await fh.getFile()
    return { raw: await file.text(), lastModified: file.lastModified, fileName: 'features.json' }
  } catch { /* noop */ }

  try {
    const sub = await dirHandle.getDirectoryHandle('.codesee')
    const fh = await sub.getFileHandle('features.json')
    const file = await fh.getFile()
    return { raw: await file.text(), lastModified: file.lastModified, fileName: '.codesee/features.json' }
  } catch { /* noop */ }

  return null
}

/**
 * 一站式：弹 picker → 授权 → 读 features.json。
 */
export async function pickDirectoryAndLoadFeatures(
  repoId: string,
): Promise<{ handle: FileSystemDirectoryHandle; features: FeaturesReadResult | null } | null> {
  const handle = await pickDirectory(repoId)
  if (!handle) return null
  const ok = await ensurePermission(handle)
  if (!ok) return { handle, features: null }
  const features = await loadFeaturesFromDirectory(handle)
  return { handle, features }
}

/**
 * 自动加载：从已授权目录读 features.json。
 * - 默认（自动场景）：仅查询权限不请求，避免无用户手势时报 SecurityError
 * - requestIfNeeded=true（用户手势场景）：权限是 prompt 时弹小权限框请求授权
 */
export async function autoLoadFeaturesFromStoredDir(
  repoId: string,
  options: { requestIfNeeded?: boolean } = {},
): Promise<FeaturesReadResult | null> {
  if (!isFSASupported()) return null
  const handle = await getStoredHandle(repoId)
  if (!handle) return null
  const ok = options.requestIfNeeded
    ? await ensurePermission(handle)
    : await checkPermission(handle)
  if (!ok) return null
  return loadFeaturesFromDirectory(handle)
}

/* ------------------------- layout.json 读写 ------------------------- */

/**
 * 失败时不再 clearStoredHandle——避免下次保存又弹 picker。
 */
export async function saveLayoutFile(
  repoId: string,
  layout: LayoutFile,
): Promise<'wrote' | 'downloaded' | 'no-handle'> {
  const text = JSON.stringify(layout, null, 2)

  if (isFSASupported()) {
    const handle = await getStoredHandle(repoId)
    if (handle) {
      const ok = await checkPermission(handle)
      if (!ok) return 'no-handle'
      try {
        const target = await resolveLayoutWriteTarget(handle)
        const fileHandle = await target.dirHandle.getFileHandle('layout.json', { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(text)
        await writable.close()
        return 'wrote'
      } catch {
        return 'no-handle'
      }
    }
    return 'no-handle'
  }
  return downloadAsFile(text)
}

async function resolveLayoutWriteTarget(
  rootHandle: FileSystemDirectoryHandle,
): Promise<{ dirHandle: FileSystemDirectoryHandle; path: string }> {
  try {
    await rootHandle.getFileHandle('features.json')
    return { dirHandle: rootHandle, path: 'layout.json' }
  } catch { /* noop */ }
  try {
    const sub = await rootHandle.getDirectoryHandle('.codesee')
    await sub.getFileHandle('features.json')
    return { dirHandle: sub, path: '.codesee/layout.json' }
  } catch { /* noop */ }
  return { dirHandle: rootHandle, path: 'layout.json' }
}

export async function loadLayoutFile(repoId: string): Promise<LayoutFile | null> {
  if (!isFSASupported()) return null
  const handle = await getStoredHandle(repoId)
  if (!handle) return null
  const ok = await checkPermission(handle)
  if (!ok) return null
  const fromRoot = await tryReadLayout(handle)
  if (fromRoot) return fromRoot
  try {
    const sub = await handle.getDirectoryHandle('.codesee')
    const fromSub = await tryReadLayout(sub)
    if (fromSub) return fromSub
  } catch { /* noop */ }
  return null
}

async function tryReadLayout(dirHandle: FileSystemDirectoryHandle): Promise<LayoutFile | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle('layout.json')
    const file = await fileHandle.getFile()
    const text = await file.text()
    const data = JSON.parse(text) as LayoutFile
    if (data.version !== '0' || !data.views) return null
    return data
  } catch {
    return null
  }
}

/* ------------------------- 项目元数据 (Projects Store) ------------------------- */

/** 32-bit FNV-1a hash，用于 repoId 稳定生成 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function makeRepoId(kind: ProjectKind, ...keys: string[]): string {
  if (kind === 'bundled') return `bundled:${keys.join(':')}`
  return `${kind}:${fnv1a(keys.join('|'))}`
}

export async function listProjects(): Promise<ProjectEntry[]> {
  const entries = await dbGetAll<ProjectEntry>(PROJECTS_STORE)
  return entries.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
}

export async function getProject(repoId: string): Promise<ProjectEntry | null> {
  return dbGet<ProjectEntry>(PROJECTS_STORE, repoId)
}

export async function upsertProject(entry: ProjectEntry): Promise<void> {
  await dbPut(PROJECTS_STORE, entry.repoId, entry)
}

export async function touchProject(
  repoId: string,
  patch: Partial<ProjectEntry> = {},
): Promise<void> {
  const cur = await getProject(repoId)
  if (!cur) return
  await upsertProject({ ...cur, ...patch, lastOpenedAt: Date.now() })
}

export async function removeProject(repoId: string): Promise<void> {
  await dbDelete(PROJECTS_STORE, repoId)
  await dbDelete(HANDLE_STORE, repoId)
  await dbDelete(UPLOAD_STORE, repoId)
}

/* ------------------------- 上传文件快照 ------------------------- */

export interface UploadSnapshot {
  raw: string
  fileName: string
  lastModified: number
}

export async function setUploadSnapshot(repoId: string, snap: UploadSnapshot): Promise<void> {
  await dbPut(UPLOAD_STORE, repoId, snap)
}

export async function getUploadSnapshot(repoId: string): Promise<UploadSnapshot | null> {
  return dbGet<UploadSnapshot>(UPLOAD_STORE, repoId)
}

/* ------------------------- 旧版本迁移 ------------------------- */

const MIGRATION_FLAG_KEY = 'codesee.projects.migrated.v1'

/**
 * 把旧版的 'default' 目录句柄迁移到新的 projects store。
 * 只跑一次；用 localStorage flag 标记。
 */
export async function migrateLegacyDefault(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === '1') return
  try {
    const legacy = await dbGet<FileSystemDirectoryHandle>(HANDLE_STORE, 'default')
    if (legacy) {
      // 给老 handle 起个稳定的新 repoId
      const newId = makeRepoId('fsa', 'legacy-default', legacy.name || 'unknown')
      await dbPut(HANDLE_STORE, newId, legacy)
      await dbDelete(HANDLE_STORE, 'default')
      const exists = await getProject(newId)
      if (!exists) {
        await upsertProject({
          repoId: newId,
          kind: 'fsa',
          displayName: legacy.name || '迁移项目',
          sourceLabel: legacy.name || '',
          lastOpenedAt: Date.now(),
          addedAt: Date.now(),
        })
      }
    }
    localStorage.setItem(MIGRATION_FLAG_KEY, '1')
  } catch { /* noop */ }
}

/* ------------------------- 浏览器下载兜底 ------------------------- */

function downloadAsFile(text: string): 'downloaded' {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'layout.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
