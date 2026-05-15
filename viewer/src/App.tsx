import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { autoLoad, clearStored, loadFromFile } from '@/fcg/loader'
import type { FeaturesFile } from '@/fcg/types'
import { cn } from '@/lib/cn'
import { FolderOpen, Sparkles, Upload } from 'lucide-react'

type Status = 'pending' | 'ok' | 'missing'

export default function App() {
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

  const onPick = () => inputRef.current?.click()
  const onClear = () => {
    clearStored()
    setFile(null)
    setSourceLabel('')
    setStatus('missing')
  }

  // 全局拖拽
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  return (
    <div
      className="relative flex h-full w-full flex-col text-[var(--color-fg)]"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
            松手即可加载 features.json
          </p>
        </div>
      </div>
    </div>
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
  if (status === 'pending') {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--color-fg-subtle)]">
        正在加载…
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
            打开一份 features.json
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            把目标项目的{' '}
            <code className="rounded bg-[var(--color-bg-2)] px-1 font-mono text-[11px]">
              .codesee/features.json
            </code>{' '}
            拖到这里，或点下面按钮选择文件。
          </p>
          <p className="text-[11.5px] leading-relaxed text-[var(--color-fg-subtle)]">
            没有这个文件？让 AI IDE 在你的项目里读取{' '}
            <code className="font-mono text-[10.5px]">AGENTS.md</code> 自动生成。
          </p>
        </div>
        <button
          onClick={onPick}
          className="mt-1 inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2 text-[12.5px] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-sunken)]"
        >
          <FolderOpen size={14} />
          选择文件
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
