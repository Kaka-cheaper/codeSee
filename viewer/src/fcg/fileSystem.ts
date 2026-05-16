/**
 * 文件系统访问层（统一 directory handle 架构）：
 *
 * 设计原则：
 * - 用户只需要授权一次目录（包含 features.json）
 * - features.json 和 layout.json 在同一目录共存
 * - 后续保存 / 自动保存 / 实时刷新全部复用同一个 directory handle
 * - 永不重复弹 picker（除非用户主动取消授权）
 *
 * 兼容性：
 * - 现代浏览器（Chromium 系）：File System Access API → 直接读写
 * - 不支持（Safari / Firefox）：降级为 input 上传 / 下载 layout.json
 */

const HANDLE_DB = 'codesee-fs-handles'
const HANDLE_STORE = 'directories'

export type LayoutFile = {
  version: '0'
  views: Record<string, Record<string, { x: number; y: number }>>
  generated_at: string
}

/* ------------------------- IndexedDB（持久化目录句柄） ------------------------- */

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // version 2：兼容老版本可能存在的 feature-files store
    const req = indexedDB.open(HANDLE_DB, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE)
      }
      // 旧版的 feature-files store 不再使用，但保留不删（避免迁移失败）
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getStoredHandle(repoId: string): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) return null
  try {
    const db = await openHandleDB()
    return await new Promise<FileSystemDirectoryHandle | null>((resolve) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly')
      const req = tx.objectStore(HANDLE_STORE).get(repoId)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function setStoredHandle(repoId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite')
      tx.objectStore(HANDLE_STORE).put(handle, repoId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* noop */
  }
}

async function clearStoredHandle(repoId: string): Promise<void> {
  try {
    const db = await openHandleDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite')
      tx.objectStore(HANDLE_STORE).delete(repoId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* noop */
  }
}

/* ------------------------- 权限验证 ------------------------- */

/**
 * 在用户手势内调用，可能弹出权限请求（注意：不会弹 picker，只弹小权限框）。
 */
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

/**
 * 仅查询权限，不请求。可以在自动加载/页面初始化时安全调用。
 * 浏览器要求 requestPermission 必须在用户手势内调用，否则报 SecurityError。
 */
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

/** 检查这个 repoId 是否已授权过保存目录 */
export async function hasAuthorized(repoId: string): Promise<boolean> {
  if (!isFSASupported()) return false
  const handle = await getStoredHandle(repoId)
  return handle !== null
}

/**
 * 让用户选择包含 features.json 的目录，并记住（first-time 授权）。
 * 必须在用户手势的同步调用栈内调用。
 */
export async function pickDirectory(repoId: string): Promise<FileSystemDirectoryHandle | null> {
  console.log('[CodeSee FSA] pickDirectory called, repoId:', repoId, 'isFSASupported:', isFSASupported())
  if (!isFSASupported()) return null
  try {
    // id 不允许 / 等特殊字符，替换为 -
    const safeId = `codesee-${repoId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    // @ts-expect-error showDirectoryPicker
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: safeId,
      mode: 'readwrite',
      startIn: 'documents',
    })
    console.log('[CodeSee FSA] 用户选择了目录:', handle.name)
    await setStoredHandle(repoId, handle)
    return handle
  } catch (err) {
    console.log('[CodeSee FSA] pickDirectory 失败或取消:', err)
    return null
  }
}

/** 取消授权 */
export async function forgetDirectory(repoId: string): Promise<void> {
  await clearStoredHandle(repoId)
}

/* ------------------------- features.json 读取 ------------------------- */

export type FeaturesReadResult = {
  raw: string
  lastModified: number
  fileName: string
}

/**
 * 在目录中查找 features.json。
 * 优先级：
 *   1. 根目录 features.json
 *   2. .codesee/features.json
 *
 * 不会请求权限（调用前应已 ensurePermission）。
 */
export async function loadFeaturesFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
): Promise<FeaturesReadResult | null> {
  // 1. 根目录
  try {
    const fh = await dirHandle.getFileHandle('features.json')
    const file = await fh.getFile()
    return {
      raw: await file.text(),
      lastModified: file.lastModified,
      fileName: 'features.json',
    }
  } catch { /* 不在根目录 */ }

  // 2. .codesee/features.json
  try {
    const sub = await dirHandle.getDirectoryHandle('.codesee')
    const fh = await sub.getFileHandle('features.json')
    const file = await fh.getFile()
    return {
      raw: await file.text(),
      lastModified: file.lastModified,
      fileName: '.codesee/features.json',
    }
  } catch { /* 不在 .codesee/ 下 */ }

  return null
}

/**
 * 一站式：弹 picker → 授权 → 在目录里查找 features.json。
 * 如果用户选的目录里没有 features.json，返回 { handle, features: null }
 * 让调用方决定怎么提示。
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
 * 自动加载：检查是否有已授权的目录，有就尝试读 features.json。
 * 只查询权限不请求（避免页面初始化时弹权限框报 SecurityError）。
 */
export async function autoLoadFeaturesFromStoredDir(
  repoId: string,
): Promise<FeaturesReadResult | null> {
  if (!isFSASupported()) return null
  const handle = await getStoredHandle(repoId)
  if (!handle) return null
  const ok = await checkPermission(handle)
  if (!ok) return null
  return loadFeaturesFromDirectory(handle)
}

/* ------------------------- layout.json 读写 ------------------------- */

/**
 * 保存 layout.json：
 * - 已授权目录 → 直接写 layout.json（与 features.json 同目录）
 * - 未授权 → 触发文件下载
 *
 * 关键：失败时不再 clearStoredHandle——避免下次保存又弹 picker。
 * 失败原因可能只是权限暂时回到 prompt 状态，下次用户手势内 ensurePermission 即可恢复。
 */
export async function saveLayoutFile(
  repoId: string,
  layout: LayoutFile,
): Promise<'wrote' | 'downloaded' | 'no-handle'> {
  const text = JSON.stringify(layout, null, 2)
  console.log('[CodeSee FSA] saveLayoutFile called, repoId:', repoId, 'isFSASupported:', isFSASupported())

  if (isFSASupported()) {
    const handle = await getStoredHandle(repoId)
    console.log('[CodeSee FSA] getStoredHandle result:', handle)
    if (handle) {
      // 仅查询权限，不请求（避免无用户手势下报 SecurityError）
      const ok = await checkPermission(handle)
      console.log('[CodeSee FSA] checkPermission result:', ok)
      if (!ok) {
        // 权限不在 granted（可能浏览器重启后回到 prompt）
        // 不清掉 handle！让上层在用户手势内调 ensurePermission 恢复
        return 'no-handle'
      }
      try {
        // 优先与 features.json 同目录写入
        // 如果 features.json 在 .codesee/ 下，layout.json 也写到 .codesee/
        const target = await resolveLayoutWriteTarget(handle)
        const fileHandle = await target.dirHandle.getFileHandle('layout.json', { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(text)
        await writable.close()
        console.log('[CodeSee FSA] 写入成功:', target.path)
        return 'wrote'
      } catch (err) {
        console.error('[CodeSee FSA] 写入失败:', err)
        // 不清 handle，下次重试
        return 'no-handle'
      }
    }
    console.log('[CodeSee FSA] 没有 stored handle，返回 no-handle')
    return 'no-handle'
  }
  console.log('[CodeSee FSA] 不支持 FSA，下载文件')
  return downloadAsFile(text)
}

/**
 * 决定 layout.json 写到哪里：
 * - 如果根目录有 features.json → layout.json 写根目录
 * - 如果 .codesee/features.json 存在 → layout.json 写 .codesee/
 * - 都不存在 → 默认写根目录
 */
async function resolveLayoutWriteTarget(
  rootHandle: FileSystemDirectoryHandle,
): Promise<{ dirHandle: FileSystemDirectoryHandle; path: string }> {
  try {
    await rootHandle.getFileHandle('features.json')
    return { dirHandle: rootHandle, path: 'layout.json' }
  } catch { /* 不在根目录 */ }
  try {
    const sub = await rootHandle.getDirectoryHandle('.codesee')
    await sub.getFileHandle('features.json')
    return { dirHandle: sub, path: '.codesee/layout.json' }
  } catch { /* 不在 .codesee/ */ }
  return { dirHandle: rootHandle, path: 'layout.json' }
}

/**
 * 读 layout.json：从已授权目录里读。
 * 优先级与 features.json 解析一致：根目录 → .codesee/。
 * 自动加载场景：只查询权限不请求。
 */
export async function loadLayoutFile(repoId: string): Promise<LayoutFile | null> {
  if (!isFSASupported()) return null
  const handle = await getStoredHandle(repoId)
  if (!handle) return null
  const ok = await checkPermission(handle)
  if (!ok) return null
  // 1. 根目录
  const fromRoot = await tryReadLayout(handle)
  if (fromRoot) return fromRoot
  // 2. .codesee/
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
