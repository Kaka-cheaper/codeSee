import { GitBranch, Sparkles } from 'lucide-react'
import type { Ucg } from '@/ucg/types'

interface Props {
  ucg: Ucg
}

export function TopBar({ ucg }: Props) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-1)]/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-bg-0)]">
          <Sparkles size={13} strokeWidth={2.4} />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-[var(--color-fg)]">
          CodeSee
        </span>
        <span className="ml-1 rounded bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
          MVP
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-muted)]">
        <span className="flex items-center gap-1.5 font-mono">
          <GitBranch size={12} />
          {ucg.manifest.repo}
          {ucg.manifest.commit && (
            <span className="text-[var(--color-fg-subtle)]">@{ucg.manifest.commit}</span>
          )}
        </span>
        <span className="h-4 w-px bg-[var(--color-border)]" />
        <span className="font-mono">
          <span className="text-[var(--color-fg)]">{ucg.nodes.length}</span> nodes ·{' '}
          <span className="text-[var(--color-fg)]">{ucg.edges.length}</span> edges
        </span>
      </div>
    </header>
  )
}
