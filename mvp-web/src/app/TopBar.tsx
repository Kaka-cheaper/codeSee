import { GitBranch, Sparkles } from 'lucide-react'
import type { Ucg } from '@/ucg/types'

interface Props {
  ucg: Ucg
  source: 'fetched' | 'sample'
}

export function TopBar({ ucg, source }: Props) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-1)]/70 px-5 backdrop-blur-md">
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
        <span
          className="ml-1 rounded-md px-1.5 py-0.5 font-mono text-[10px]"
          title={source === 'fetched' ? '加载自 /ucg.json' : '使用内置示例图'}
          style={{
            color:
              source === 'fetched'
                ? 'var(--color-kind-function-fg)'
                : 'var(--color-fg-subtle)',
            background:
              source === 'fetched'
                ? 'var(--color-kind-function)'
                : 'var(--color-bg-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          {source === 'fetched' ? 'live' : 'sample'}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-muted)]">
        <span className="flex items-center gap-1.5 font-mono">
          <GitBranch size={12} className="text-[var(--color-fg-subtle)]" />
          {ucg.manifest.repo}
          {ucg.manifest.commit && (
            <span className="text-[var(--color-fg-subtle)]">@{ucg.manifest.commit}</span>
          )}
        </span>
        <span className="h-3 w-px bg-[var(--color-border)]" />
        <span className="font-mono">
          <span className="text-[var(--color-fg)]">{ucg.nodes.length}</span> nodes ·{' '}
          <span className="text-[var(--color-fg)]">{ucg.edges.length}</span> edges
        </span>
      </div>
    </header>
  )
}
