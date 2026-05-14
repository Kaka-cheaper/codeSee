import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, FolderClosed, FolderOpen, Package } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ViewNode } from './aggregation'

export type GroupNodeData = {
  view: ViewNode
}

function GroupNodeViewImpl({ data, selected }: NodeProps) {
  const { view } = data as unknown as GroupNodeData
  const isExternal = view.kind === 'external_group'
  const Icon = isExternal ? Package : view.expanded ? FolderOpen : FolderClosed
  const Chevron = view.expanded ? ChevronDown : ChevronRight

  return (
    <div
      className={cn(
        'group relative flex min-w-[180px] max-w-[260px] items-center gap-2.5 rounded-2xl border bg-[var(--color-bg-1)]',
        'px-3.5 py-3 transition-shadow duration-150',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)]',
        selected
          ? 'border-[var(--color-accent)]'
          : 'border-[var(--color-border)]',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]"
      />

      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: isExternal
            ? 'var(--color-kind-external)'
            : 'var(--color-kind-module)',
          color: isExternal
            ? 'var(--color-kind-external-fg)'
            : 'var(--color-kind-module-fg)',
        }}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[13.5px] font-medium leading-tight text-[var(--color-fg)]">
            {view.label}
          </span>
          <Chevron
            size={12}
            className="shrink-0 text-[var(--color-fg-subtle)]"
          />
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] text-[var(--color-fg-subtle)]">
          {view.memberCount} {isExternal ? 'packages' : 'modules'}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]"
      />
    </div>
  )
}

export const GroupNodeView = memo(GroupNodeViewImpl)
