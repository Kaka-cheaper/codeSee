import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { fetchFromUrl, loadFromText } from '@/fcg/loader'
import { useFileWatcher, type WatchSource } from '@/fcg/useFileWatcher'
import {
  isFSASupported,
  pickDirectoryAndLoadFeatures,
  autoLoadFeaturesFromStoredDir,
  listProjects,
  upsertProject,
  touchProject,
  removeProject,
  getProject,
  setUploadSnapshot,
  getUploadSnapshot,
  makeRepoId,
  migrateLegacyDefault,
  promoteHandle,
  type ProjectEntry,
} from '@/fcg/fileSystem'
import {
  bundledAsProjectEntry,
  findBundledByRepoId,
  getDefaultBundledRepoId,
} from '@/fcg/bundledProjects'
import type { FeaturesFile } from '@/fcg/types'
import { cn } from '@/lib/cn'
import { I18nContext, t as tFn, useI18n, type Locale } from '@/lib/i18n'
import { FolderOpen, Sparkles, Upload } from 'lucide-react'

type Status = 'pending' | 'ok' | 'missing'

const ACTIVE_REPO_KEY = 'codesee.activeRepoId.v1'

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem('codesee.locale')
      if (stored === 'en' || stored === 'zh-CN') return stored
    } catch { /* noop */ }
    return 'zh-CN'
  })
  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l)
    try { localStorage.setItem('codesee.locale', l) } catch { /* noop */ }
  }, [])
  const i18n = useMemo(() => ({
    locale,
    setLocale: handleSetLocale,
    t: (key: Parameters<typeof tFn>[1], params?: Parameters<typeof tFn>[2]) => tFn(locale, key, params),
  }), [locale, handleSetLocale])

  const [file, setFile] = useState<FeaturesFile | null>(null)
  const [sourceLabel, setSourceLabel] = useState<string>('')
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 多项目状态
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectEntry[]>([])

  // 实时刷新相关
  const [watchSource, setWatchSource] = useState<WatchSource | null>(null)
  const [currentRaw, setCurrentRaw] = useState<string>('')
  const [liveReload, setLiveReload] = useState<boolean>(() => {
    try {
      return localStorage.getItem('codesee.liveReload') === 'true'
    } catch {
      return false
    }
  })
  const [reloadHint, setReloadHint] = useState<'idle' | 'updated'>('idle')
  const toggleLiveReload = useCallback(() => {
    setLiveReload((v) => {
      const next = !v
      try { localStorage.setItem('codesee.liveReload', String(next)) } catch { /* noop */ }
      return next
    })
  }, [])

  /** 重新加载项目列表（已添加 + 内置） */
  const refreshProjects = useCallback(async () => {
    const userProjects = await listProjects()
    const bundled = bundledAsProjectEntry()
    // 用户项目排前（按 lastOpenedAt 降序），内置排后
    const merged = [...userProjects.filter((p) => p.kind !== 'bundled'), ...bundled]
    setProjects(merged)
    return merged
  }, [])

  /** 把项目数据加载到画布。不改 lastOpenedAt（调用方控制）。
   * fromUserGesture=true 时（用户点击切换），FSA 项目会主动请求权限（弹小权限框）。
   * 启动自动加载场景下传 false，避免无用户手势时报 SecurityError。
   */
  const loadProject = useCallback(async (
    repoId: string,
    fromUserGesture: boolean = false,
  ): Promise<boolean> => {
    setError(null)

    // 1. 内置项目
    const bundled = findBundledByRepoId(repoId)
    if (bundled) {
      const res = await fetchFromUrl(bundled.url)
      if (!res.ok) {
        setError('内置示例加载失败')
        return false
      }
      const parsed = loadFromText(res.raw, bundled.sourceLabel)
      if (!parsed.ok) {
        setError(parsed.detail ?? '示例格式异常')
        return false
      }
      setFile(parsed.file)
      setSourceLabel(bundled.displayName)
      setStatus('ok')
      setCurrentRaw(res.raw)
      setWatchSource({ kind: 'url', url: bundled.url })
      return true
    }

    // 2. 用户项目（fsa / upload）
    const project = await getProject(repoId)
    if (!project) {
      setError('项目不存在或已被移除')
      return false
    }

    if (project.kind === 'fsa') {
      // 用户手势场景：权限是 prompt 时弹小权限框请求；
      // 启动自动场景：仅查询权限，丢了就提示用户去重新点一次
      const fsa = await autoLoadFeaturesFromStoredDir(repoId, {
        requestIfNeeded: fromUserGesture,
      })
      if (!fsa) {
        if (fromUserGesture) {
          // 用户手动点了仍然失败 → 授权被拒或文件不存在
          setError(`无法访问「${project.displayName}」：可能授权被拒或目录已移动。请用「添加项目」重新选择。`)
        } else {
          // 启动自动场景失败 → 不报错，让候选回退机制接管
        }
        return false
      }
      const parsed = loadFromText(fsa.raw, fsa.fileName)
      if (!parsed.ok) {
        setError(parsed.detail ?? '文件格式异常')
        return false
      }
      setFile(parsed.file)
      setSourceLabel(project.displayName)
      setStatus('ok')
      setCurrentRaw(fsa.raw)
      setWatchSource({ kind: 'fsa', repoId })
      // 更新计数
      void touchProject(repoId, {
        featuresCount: parsed.file.features.length,
        epicsCount: parsed.file.epics.length,
      })
      return true
    }

    if (project.kind === 'upload') {
      const snap = await getUploadSnapshot(repoId)
      if (!snap) {
        setError('上传内容已丢失，请重新打开文件')
        return false
      }
      const parsed = loadFromText(snap.raw, snap.fileName)
      if (!parsed.ok) {
        setError(parsed.detail ?? '文件格式异常')
        return false
      }
      setFile(parsed.file)
      setSourceLabel(project.displayName)
      setStatus('ok')
      setCurrentRaw(snap.raw)
      setWatchSource(null) // upload 模式不支持实时刷新
      return true
    }

    return false
  }, [])

  /** 切换到某项目（用户操作）：更新 lastOpenedAt，更新 active，加载内容 */
  const switchProject = useCallback(async (repoId: string) => {
    // fromUserGesture=true：FSA 项目权限是 prompt 时会弹小权限框
    const ok = await loadProject(repoId, true)
    if (!ok) return
    setActiveRepoId(repoId)
    try { localStorage.setItem(ACTIVE_REPO_KEY, repoId) } catch { /* noop */ }
    await touchProject(repoId)
    await refreshProjects()
  }, [loadProject, refreshProjects])

  /** 启动初始化：迁移老数据 → 加载项目列表 → 选定首个可用项目 */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await migrateLegacyDefault()
      const merged = await refreshProjects()
      if (cancelled) return

      // 优先使用 localStorage 记的 active
      let candidateId: string | null = null
      try {
        candidateId = localStorage.getItem(ACTIVE_REPO_KEY)
      } catch { /* noop */ }

      // 候选必须仍存在于列表
      if (candidateId && !merged.some((p) => p.repoId === candidateId)) {
        candidateId = null
      }

      // 候选优先级：上次激活 → 最近打开的用户项目 → 默认内置
      if (!candidateId) {
        const lastUser = merged.find((p) => p.kind !== 'bundled' && p.lastOpenedAt > 0)
        candidateId = lastUser?.repoId ?? getDefaultBundledRepoId()
      }

      const ok = await loadProject(candidateId)
      if (cancelled) return
      if (ok) {
        setActiveRepoId(candidateId)
        // 仅用户项目更新 lastOpenedAt（内置 default 不算"打开"）
        const isUserProject = merged.some(
          (p) => p.repoId === candidateId && p.kind !== 'bundled',
        )
        if (isUserProject) {
          await touchProject(candidateId)
          await refreshProjects()
        }
      } else {
        // 备选项也失败 → 落到默认内置
        const defId = getDefaultBundledRepoId()
        if (candidateId !== defId) {
          const okDef = await loadProject(defId)
          if (cancelled) return
          if (okDef) setActiveRepoId(defId)
          else setStatus('missing')
        } else {
          setStatus('missing')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 处理拖入或 input 选中的 File */
  const handleFile = useCallback(async (f: File) => {
    setError(null)
    const text = await f.text()
    const parsed = loadFromText(text, f.name)
    if (!parsed.ok) {
      setError(parsed.detail ?? '加载失败')
      return
    }
    // upload 类型项目：repoId 由文件名 + manifest.repo + 内容长度构成（稳定）
    const manifestRepo = parsed.file.manifest.repo ?? ''
    const repoId = makeRepoId('upload', f.name, manifestRepo, String(text.length))
    const displayName = manifestRepo || f.name.replace(/\.json$/, '')
    await setUploadSnapshot(repoId, {
      raw: text,
      fileName: f.name,
      lastModified: f.lastModified,
    })
    await upsertProject({
      repoId,
      kind: 'upload',
      displayName,
      sourceLabel: f.name,
      addedAt: Date.now(),
      lastOpenedAt: Date.now(),
      featuresCount: parsed.file.features.length,
      epicsCount: parsed.file.epics.length,
    })
    setFile(parsed.file)
    setSourceLabel(displayName)
    setStatus('ok')
    setCurrentRaw(text)
    setWatchSource(null)
    setActiveRepoId(repoId)
    try { localStorage.setItem(ACTIVE_REPO_KEY, repoId) } catch { /* noop */ }
    await refreshProjects()
  }, [refreshProjects])

  const handleText = useCallback((text: string, label: string) => {
    setError(null)
    const parsed = loadFromText(text, label)
    if (parsed.ok) {
      setFile(parsed.file)
      setSourceLabel(parsed.sourceLabel)
      setStatus('ok')
      return true
    } else {
      setError(parsed.detail ?? '加载失败')
      return false
    }
  }, [])

  const handleWatcherUpdate = useCallback((newFile: FeaturesFile, newRaw: string) => {
    setFile(newFile)
    setCurrentRaw(newRaw)
    setReloadHint('updated')
    window.setTimeout(() => setReloadHint('idle'), 2000)
  }, [])

  useFileWatcher({
    enabled: liveReload,
    source: watchSource,
    currentRaw,
    onChange: handleWatcherUpdate,
  })

  /**
   * 添加新项目（用户点"添加目录"或"上传文件"）
   * - FSA 支持 → 弹 directory picker，授权后建一个 fsa 项目
   * - 不支持 → 走 file input
   */
  const onAddProject = useCallback(async () => {
    if (isFSASupported()) {
      // 临时 repoId：picker 选完后用目录名 + manifest.repo 重新算
      const tmpId = `tmp-${Date.now()}`
      const result = await pickDirectoryAndLoadFeatures(tmpId)
      if (!result) {
        // 用户取消或不支持 → 兜底走 input
        inputRef.current?.click()
        return
      }
      if (!result.features) {
        setError('选中的目录里没找到 features.json（应在根目录或 .codesee/ 下）')
        return
      }
      const parsed = loadFromText(result.features.raw, result.features.fileName)
      if (!parsed.ok) {
        setError(parsed.detail ?? '文件格式异常')
        return
      }
      // 用稳定 repoId 重新存
      const dirName = result.handle.name
      const manifestRepo = parsed.file.manifest.repo ?? ''
      const repoId = makeRepoId('fsa', dirName, manifestRepo)
      // 把 dirHandle 从 tmpId 搬到正式 repoId
      await promoteHandle(tmpId, repoId)

      await upsertProject({
        repoId,
        kind: 'fsa',
        displayName: manifestRepo || dirName,
        sourceLabel: dirName,
        addedAt: Date.now(),
        lastOpenedAt: Date.now(),
        featuresCount: parsed.file.features.length,
        epicsCount: parsed.file.epics.length,
      })
      setFile(parsed.file)
      setSourceLabel(manifestRepo || dirName)
      setStatus('ok')
      setCurrentRaw(result.features.raw)
      setWatchSource({ kind: 'fsa', repoId })
      setActiveRepoId(repoId)
      try { localStorage.setItem(ACTIVE_REPO_KEY, repoId) } catch { /* noop */ }
      await refreshProjects()
      return
    }
    // FSA 不支持 → 走 file input
    inputRef.current?.click()
  }, [refreshProjects])

  /** 移除某项目（清理 handle / upload 内容 / 元数据） */
  const onRemoveProject = useCallback(async (repoId: string) => {
    await removeProject(repoId)
    if (activeRepoId === repoId) {
      // 切到默认内置
      const defId = getDefaultBundledRepoId()
      const ok = await loadProject(defId)
      if (ok) {
        setActiveRepoId(defId)
        try { localStorage.setItem(ACTIVE_REPO_KEY, defId) } catch { /* noop */ }
      }
    }
    await refreshProjects()
  }, [activeRepoId, loadProject, refreshProjects])

/** 顶栏"清除"按钮：现在含义改为"撤销当前项目的目录授权"，但保留项目元数据 */
  const onClear = useCallback(async () => {
    if (!activeRepoId) return
    const project = projects.find((p) => p.repoId === activeRepoId)
    if (!project || project.kind === 'bundled') {
      // 内置项目无法清除，直接切默认
      return
    }
    // 移除这个项目（彻底清干净）
    await onRemoveProject(activeRepoId)
  }, [activeRepoId, projects, onRemoveProject])

  // 全局拖拽蒙层
  const dragCounterRef = useRef(0)
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current += 1
      setDragOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setDragOver(false)
      const dt = e.dataTransfer
      if (!dt) return

      let f: File | null = dt.files?.[0] ?? null
      if (!f && dt.items) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i]
          if (item.kind === 'file') {
            f = item.getAsFile()
            if (f) break
          }
        }
      }
      if (f) {
        handleFile(f)
        return
      }

      // IDE 拖动 fallback：text/plain
      const types = Array.from(dt.types ?? [])
      if (types.includes('text/plain') && dt.items) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i]
          if (item.kind === 'string' && item.type === 'text/plain') {
            item.getAsString((text) => {
              const trimmed = text.trim()
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                handleText(trimmed, 'IDE drop')
              } else {
                setError('IDE 拖动只传递了文件路径而非内容。请用文件资源管理器拖动，或点击"打开"按钮选择目录。')
              }
            })
            return
          }
        }
      }

      setError('未能从拖动中获取文件。请改用文件资源管理器拖动，或点击"打开"按钮选择目录。')
    }

    window.addEventListener('dragenter', onDragEnter, true)
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('dragleave', onDragLeave, true)
    window.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('dragenter', onDragEnter, true)
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('dragleave', onDragLeave, true)
      window.removeEventListener('drop', onDrop, true)
    }
  }, [handleFile, handleText])

  return (
    <I18nContext.Provider value={i18n}>
      <div className="relative flex h-full w-full flex-col text-[var(--color-fg)]">
        <TopBar
          file={file}
          status={status}
          sourceLabel={sourceLabel}
          activeRepoId={activeRepoId}
          projects={projects}
          onSwitchProject={switchProject}
          onAddProject={onAddProject}
          onRemoveProject={onRemoveProject}
          onClear={onClear}
          liveReload={liveReload}
          onToggleLiveReload={toggleLiveReload}
          reloadHint={reloadHint}
          liveAvailable={watchSource !== null}
        />
        <div className="relative flex-1">
          {file ? (
            <ReactFlowProvider>
              <GraphCanvas file={file} />
            </ReactFlowProvider>
          ) : (
            <EmptyState
              status={status}
              error={error}
              onPick={onAddProject}
            />
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />

        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-50 flex items-center justify-center',
            'transition-opacity duration-150',
            dragOver ? 'opacity-100' : 'opacity-0',
          )}
          style={{ background: 'oklch(0.948 0.012 80 / 0.85)' }}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-accent)] px-12 py-10">
            <Upload size={28} className="text-[var(--color-accent-strong)]" />
            <p className="text-[15px] font-medium text-[var(--color-fg)]">
              {i18n.t('drag.hint')}
            </p>
          </div>
        </div>
      </div>
    </I18nContext.Provider>
  )
}

function EmptyState({
  status,
  error,
  onPick,
}: {
  status: Status
  error: string | null
  onPick: () => void
}) {
  const { t } = useI18n()
  if (status === 'pending') {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--color-fg-subtle)]">
        {t('empty.loading')}
      </div>
    )
  }
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-8 py-8 text-center shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-strong)',
          }}
        >
          <Sparkles size={20} strokeWidth={1.8} />
        </span>
        <div className="space-y-1.5">
          <p className="text-[15px] font-medium text-[var(--color-fg)]">
            {t('empty.title')}
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            {t('empty.desc', { code: '.codesee/features.json' })}
          </p>
          <p className="text-[11.5px] leading-relaxed text-[var(--color-fg-subtle)]">
            {t('empty.hint', { code: 'AGENTS.md' })}
          </p>
        </div>
        <button
          onClick={onPick}
          className="mt-1 inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2 text-[12.5px] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-sunken)]"
        >
          <FolderOpen size={14} />
          {t('empty.pick')}
        </button>
        {error && (
          <p className="mt-2 max-w-full break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-2 text-left font-mono text-[10.5px] text-[var(--color-fg-muted)]">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
