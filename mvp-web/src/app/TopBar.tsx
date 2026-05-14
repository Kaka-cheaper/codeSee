import { GitBranch, Sparkles } from 'lucide-react'
import type { FeaturesFile } from '@/fcg/types'

interface Props {
  file: FeaturesFile | null
  loaded: 'pending' | 'ok' | 'missing'
}

export function TopBar({ file, loaded }: Props) {
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
        {loaded === 'missing' && (
          <span
            className="ml-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]"
            title="未找到 features.json"
          >
            no data
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
          </>
        )}
      </div>
    </header>
  )
}
