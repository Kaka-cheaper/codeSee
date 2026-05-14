import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Boxes, FileCode, Package, type LucideIcon } from 'lucide-react'
import { NODE_KIND_META } from './kindMeta'
import { cn } from '@/lib/cn'
import type { ViewNode } from './aggregation'

export type UcgFlowNodeData = {
  view: ViewNode
}

function UcgNodeViewImpl({ data, selected }: NodeProps) {
  const { view } = data as unknown as UcgFlowNodeData

  let Icon: LucideIcon = FileCode
  let chipBg = NODE_KIND_META.module.chipBg
  let chipFg = NODE_KIND_META.module.chipFg
  let label = 'Module'
  let subtitle = view.pathHint ?? ''

  if (view.kind === 'external_member') {
    Icon = Package
    chipBg = NODE_KIND_META.external.chipBg
    chipFg = NODE_KIND_META.external.chipFg
    label = 'External'
    subtitle = view.ucg?.qualified_name ?? ''
  } else if (view.kind === 'module') {
    Icon = Boxes
    chipBg = NODE_KIND_META.module.chipBg
    chipFg = NODE_KIND_META.module.chipFg
    label = 'Module'
  }

  return (
    <div
      className={cn(
        'group relative min-w-[180px] max-w-[260px] rounded-xl border bg-[var(--color-bg-1)]',
        'px-3 py-2.5 transition-shadow duration-150',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_6px_oklch(0_0_0/0.06)]',
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

      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: chipBg, color: chipFg }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium leading-tight text-[var(--color-fg)]">
            {view.label}
          </div>
          {subtitle && (
            <div className="mt-0.5 truncate font-mono text-[10px] leading-tight text-[var(--color-fg-subtle)]">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide"
          style={{ color: chipFg, background: chipBg }}
        >
          {label}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]"
      />
    </div>
  )
}

export const UcgNodeView = memo(UcgNodeViewImpl)
