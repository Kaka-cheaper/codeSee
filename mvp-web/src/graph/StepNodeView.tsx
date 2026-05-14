import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  Layers3,
  RefreshCw,
  Send,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FcgViewNode } from './fcgView'
import { ROLE_META } from './roleMeta'
import type { StepRole } from '@/fcg/types'

export type StepNodeData = {
  view: Extract<FcgViewNode, { kind: 'step' }>
  isNew?: boolean
}

const ROLE_ICON: Record<StepRole, LucideIcon> = {
  input: ArrowDownToLine,
  validation: ShieldCheck,
  auth: KeyRound,
  'data-read': Database,
  'data-write': Database,
  compute: RefreshCw,
  transform: Layers3,
  'side-effect': Send,
  output: ArrowUpFromLine,
  error: AlertTriangle,
  other: CheckCircle2,
}

function StepNodeViewImpl({ data, selected }: NodeProps) {
  const { view, isNew } = data as unknown as StepNodeData
  const s = view.step
  const meta = ROLE_META[s.role] ?? ROLE_META.other
  const Icon = ROLE_ICON[s.role] ?? ROLE_ICON.other

  return (
    <div
      className={cn(
        'group relative w-[224px] rounded-2xl border bg-[var(--color-bg-1)]',
        'px-3 py-2.5 transition-shadow duration-150',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_6px_oklch(0_0_0/0.06)]',
        selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
        isNew && 'is-new-node',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]" />

      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight text-[var(--color-fg)]">
            {s.name}
          </div>
          <div
            className="mt-0.5 truncate text-[10px]"
            style={{ color: meta.fg }}
          >
            {meta.label}
          </div>
        </div>
      </div>

      {s.note && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          {s.note}
        </p>
      )}

      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]" />
    </div>
  )
}

export const StepNodeView = memo(StepNodeViewImpl)
