import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { autoLoad, clearStored, loadFromFile, loadFromText } from '@/fcg/loader'
import type { FeaturesFile } from '@/fcg/types'
import { cn } from '@/lib/cn'
import { I18nContext, t as tFn, useI18n, type Locale } from '@/lib/i18n'
import { FolderOpen, Sparkles, Upload } from 'lucide-react'

type Status = 'pending' | 'ok' | 'missing'

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

  useEffect(() => {
    let cancelled = false
    autoLoad().then((res) => {
      if (cancelled) return
      if (res.ok) {
        setFile(res.file)
        setSourceLabel(res.sourceLabel)
        setStatus('ok')
      } else {
        setStatus('missing')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFile = useCallback(async (f: File) => {
    setError(null)
    const res = await loadFromFile(f)
    if (res.ok) {
      setFile(res.file)
      setSourceLabel(res.sourceLabel)
      setStatus('ok')
    } else {
      setError(res.detail ?? '加载失败')
    }
  }, [])

  const handleText = useCallback((text: string, label: string) => {
    setError(null)
    const res = loadFromText(text, label)
    if (res.ok) {
      setFile(res.file)
      setSourceLabel(res.sourceLabel)
      setStatus('ok')
      return true
    } else {
      setError(res.detail ?? '加载失败')
      return false
    }
  }, [])

  const onPick = () => inputRef.current?.click()
  const onClear = () => {
    clearStored()
    setFile(null)
    setSourceLabel('')
    setStatus('missing')
  }

  // 全局拖拽 — 用 window capture 模式监听，确保最先收到事件，避免被任何子元素拦截
  // 注意：HTML5 drag events 只在 draggable=true 元素上触发，
  // ReactFlow 节点拖动用的是 mousedown/mousemove，不会冲突。
  const dragCounterRef = useRef(0)

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      // 必须 preventDefault 否则 dragover 不会触发
      e.preventDefault()
      dragCounterRef.current += 1
      // 不在 dragenter 时检查 types——某些浏览器出于安全考虑，
      // 在 dragenter/dragover 阶段隐藏 files 类型，只在 drop 时暴露
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

      // 1. 优先从 files 读
      let f: File | null = dt.files?.[0] ?? null

      // 2. 回退到 items 取 file（部分场景 files 为空）
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

      // 3. 最后回退：读 text/plain（VSCode/Cursor 等 IDE 拖动会把文件内容放在这里）
      const types = Array.from(dt.types ?? [])
      if (types.includes('text/plain') && dt.items) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i]
          if (item.kind === 'string' && item.type === 'text/plain') {
            item.getAsString((text) => {
              const trimmed = text.trim()
              // 判断是否是 JSON
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                handleText(trimmed, 'IDE drop')
              } else {
                setError('IDE 拖动只传递了文件路径而非内容。请改用文件资源管理器拖动 .codesee/features.json，或点击"打开"按钮选择文件。')
              }
            })
            return
          }
        }
      }

      console.warn('[CodeSee] drop fired but no file. types:', types, 'items:', dt.items?.length)
      setError('未能从拖动中获取文件。请改用文件资源管理器拖动，或点击"打开"按钮。')
    }

    // capture=true 确保最先收到事件，绕过任何子元素的 stopPropagation
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
    <div
      className="relative flex h-full w-full flex-col text-[var(--color-fg)]"
    >
      <TopBar
        file={file}
        status={status}
        sourceLabel={sourceLabel}
        onPick={onPick}
        onClear={onClear}
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
            onPick={onPick}
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

      {/* 全局拖拽蒙层 */}
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
