import { FolderOpen, GitBranch, RotateCcw, Sparkles } from 'lucide-react'
import type { FeaturesFile } from '@/fcg/types'

interface Props {
  file: FeaturesFile | null
  status: 'pending' | 'ok' | 'missing'
  sourceLabel: string
  onPick: () => void
  onClear: () => void
}

export function TopBar({ file, status, sourceLabel, onPick, onClear }: Props) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-1)] px-5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-strong)',
          }}
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <span className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          CodeSee
        </span>
        <span className="ml-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
          MVP
        </span>
        {status === 'missing' && (
          <span className="ml-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
            no data
          </span>
        )}
        {sourceLabel && (
          <span
            className="ml-1 truncate rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]"
            title={sourceLabel}
          >
            {sourceLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-muted)]">
        {file && (
          <>
            {file.manifest.repo && (
              <span className="flex items-center gap-1.5 font-mono">
                <GitBranch size={12} className="text-[var(--color-fg-subtle)]" />
                {file.manifest.repo}
                {file.manifest.commit && (
                  <span className="text-[var(--color-fg-subtle)]">
                    @{file.manifest.commit}
                  </span>
                )}
              </span>
            )}
            <span className="h-3 w-px bg-[var(--color-border)]" />
            <span className="font-mono">
              <span className="text-[var(--color-fg)]">{file.epics.length}</span> epics ·{' '}
              <span className="text-[var(--color-fg)]">{file.features.length}</span> features
            </span>
            <span className="h-3 w-px bg-[var(--color-border)]" />
          </>
        )}
        <button
          onClick={onPick}
          title="打开 features.json"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
        >
          <FolderOpen size={12} />
          打开
        </button>
        {status === 'ok' && (
          <button
            onClick={onClear}
            title="清除已加载的文件并回到示例"
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </header>
  )
}
