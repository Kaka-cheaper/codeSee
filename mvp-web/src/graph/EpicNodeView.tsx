import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FcgViewNode } from './fcgView'

export type EpicNodeData = {
  view: Extract<FcgViewNode, { kind: 'epic' }>
  isNew?: boolean
}

function EpicNodeViewImpl({ data, selected }: NodeProps) {
  const { view, isNew } = data as unknown as EpicNodeData
  return (
    <div
      className={cn(
        'group relative flex min-w-[220px] max-w-[300px] items-center gap-3 rounded-2xl border bg-[var(--color-bg-1)]',
        'px-4 py-3 transition-shadow duration-150',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)]',
        selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
        isNew && 'is-new-node',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]" />

      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: 'var(--color-accent-soft)',
          color: 'var(--color-accent-strong)',
        }}
      >
        <Layers size={18} strokeWidth={1.7} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium leading-tight text-[var(--color-fg)]">
          {view.epic.name}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-fg-muted)]">
          <span className="font-mono">{view.featureCount} 个功能</span>
          {view.epic.tags && view.epic.tags.length > 0 && (
            <span className="truncate text-[var(--color-fg-subtle)]">
              {view.epic.tags.slice(0, 3).join(' · ')}
            </span>
          )}
        </div>
        {view.epic.summary && (
          <div className="mt-1.5 truncate text-[11.5px] text-[var(--color-fg-muted)]">
            {view.epic.summary}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]" />
    </div>
  )
}

export const EpicNodeView = memo(EpicNodeViewImpl)
