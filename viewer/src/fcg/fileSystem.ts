/**
 * 文件系统访问层：
 * - 现代浏览器（Chromium 系）：File System Access API → 直接写本地 .codesee/layout.json
 * - 不支持（Safari / Firefox）：降级为下载 layout.json 文件
 *
 * 用户首次保存时授权一次 .codesee 目录，之后浏览器记住权限。
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
    const req = indexedDB.open(HANDLE_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(HANDLE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getStoredHandle(repoId: string): Promise<FileSystemDirectoryHandle | null> {
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

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  // @ts-expect-error queryPermission 不在标准 typings
  const cur = await handle.queryPermission(opts)
  if (cur === 'granted') return true
  // @ts-expect-error requestPermission 不在标准 typings
  const next = await handle.requestPermission(opts)
  return next === 'granted'
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

/** 让用户选择 .codesee 目录并记住（first-time 授权） */
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

/**
 * 保存 layout.json：
 * - 已授权目录 → 直接写 .codesee/layout.json
 * - 未授权 → 触发文件下载
 *
 * 返回 'wrote' / 'downloaded' / 'aborted'，便于 UI 显示提示。
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
      const ok = await ensurePermission(handle)
      console.log('[CodeSee FSA] ensurePermission result:', ok)
      if (!ok) {
        await clearStoredHandle(repoId)
        return 'no-handle'
      }
      try {
        const fileHandle = await handle.getFileHandle('layout.json', { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(text)
        await writable.close()
        console.log('[CodeSee FSA] 写入成功')
        return 'wrote'
      } catch (err) {
        console.error('[CodeSee FSA] 写入失败:', err)
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
 * 读 layout.json：从已授权目录里读。如果没授权或文件不存在，返回 null。
 */
export async function loadLayoutFile(repoId: string): Promise<LayoutFile | null> {
  if (!isFSASupported()) return null
  const handle = await getStoredHandle(repoId)
  if (!handle) return null
  const ok = await ensurePermission(handle)
  if (!ok) return null
  try {
    const fileHandle = await handle.getFileHandle('layout.json')
    const file = await fileHandle.getFile()
    const text = await file.text()
    const data = JSON.parse(text) as LayoutFile
    if (data.version !== '0' || !data.views) return null
    return data
  } catch {
    return null
  }
}

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
