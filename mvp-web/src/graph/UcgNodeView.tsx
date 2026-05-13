import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Boxes,
  Braces,
  Code2,
  Database,
  Globe,
  Package,
  Radio,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { NODE_KIND_META } from './kindMeta'
import type { UcgNode } from '@/ucg/types'
import { cn } from '@/lib/cn'

const KIND_ICON: Record<UcgNode['kind'], LucideIcon> = {
  module: Boxes,
  class: Braces,
  function: Code2,
  method: Code2,
  route: Globe,
  task: Workflow,
  signal: Radio,
  data_model: Database,
  external: Package,
}

export type UcgFlowNodeData = {
  ucg: UcgNode
}

export function UcgNodeView({ data, selected }: NodeProps) {
  const { ucg } = data as unknown as UcgFlowNodeData
  const meta = NODE_KIND_META[ucg.kind]
  const Icon = KIND_ICON[ucg.kind]

  const fileName = ucg.location?.file.split('/').slice(-1)[0]

  return (
    <div
      className={cn(
        'node-enter group relative min-w-[208px] max-w-[288px] rounded-2xl border bg-[var(--color-bg-1)]',
        'px-3.5 py-3 transition-all duration-200',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_8px_oklch(0_0_0/0.06),0_0_0_3px_var(--color-bg-2)]',
        'hover:-translate-y-px',
        selected
          ? 'border-[var(--color-accent)] shadow-[0_2px_12px_oklch(0_0_0/0.06),0_0_0_3px_var(--color-accent-soft)]'
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
          style={{ background: meta.chipBg, color: meta.chipFg }}
        >
          <Icon size={14} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium leading-tight text-[var(--color-fg)]">
            {ucg.name}
          </div>
          <div className="mt-1 truncate font-mono text-[10.5px] leading-tight text-[var(--color-fg-subtle)]">
            {ucg.qualified_name}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide"
          style={{ color: meta.chipFg, background: meta.chipBg }}
        >
          {meta.label}
        </span>
        {fileName && (
          <span className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
            {fileName}
            {ucg.location ? `:${ucg.location.start_line}` : ''}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]"
      />
    </div>
  )
}
