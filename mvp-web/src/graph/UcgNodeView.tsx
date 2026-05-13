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
  selected?: boolean
}

export function UcgNodeView({ data, selected }: NodeProps) {
  // React Flow 11 把 data 类型固定为 Record<string, unknown>，这里转一次
  const { ucg } = data as unknown as UcgFlowNodeData
  const meta = NODE_KIND_META[ucg.kind]
  const Icon = KIND_ICON[ucg.kind]

  return (
    <div
      className={cn(
        'node-enter group relative min-w-[200px] max-w-[280px] rounded-xl border bg-[var(--color-bg-1)]',
        'px-3.5 py-2.5 shadow-[0_8px_24px_-12px_oklch(0_0_0/0.6)] transition-all',
        'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-2)]',
        selected
          ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
          : 'border-[var(--color-border)]',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--color-bg-2)] !border-[var(--color-border-strong)]"
      />

      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: meta.color, color: 'oklch(0.18 0.01 260)' }}
        >
          <Icon size={14} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight text-[var(--color-fg)]">
            {ucg.name}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] leading-tight text-[var(--color-fg-subtle)]">
            {ucg.qualified_name}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase"
          style={{
            color: meta.dot,
            background: 'color-mix(in oklch, var(--color-bg-2) 70%, transparent)',
            border: '1px solid var(--color-border)',
          }}
        >
          {meta.label}
        </span>
        {ucg.location && (
          <span className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
            {ucg.location.file.split('/').slice(-1)[0]}:{ucg.location.start_line}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--color-bg-2)] !border-[var(--color-border-strong)]"
      />
    </div>
  )
}
