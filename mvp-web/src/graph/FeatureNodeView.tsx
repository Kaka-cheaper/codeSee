import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Bot,
  Clock,
  GitBranch,
  Lock,
  MousePointer2,
  Network,
  Play,
  Terminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FcgViewNode } from './fcgView'
import type { Trigger, TriggerKind } from '@/fcg/types'

export type FeatureNodeData = { view: Extract<FcgViewNode, { kind: 'feature' }> }

const TRIGGER_ICON: Record<TriggerKind, LucideIcon> = {
  http: Network,
  cli: Terminal,
  cron: Clock,
  event: Workflow,
  ui: MousePointer2,
  manual: Play,
  startup: Play,
  unknown: GitBranch,
}

function FeatureNodeViewImpl({ data, selected }: NodeProps) {
  const { view } = data as unknown as FeatureNodeData
  const f = view.feature
  const isAi = f.provenance === 'ai'
  const isLocked = f.locked === true
  const lowConfidence = f.confidence < 0.8

  const trigger: Trigger | undefined = f.triggers?.[0]
  const TriggerIcon = trigger ? TRIGGER_ICON[trigger.kind] : Workflow

  return (
    <div
      className={cn(
        'group relative min-w-[240px] max-w-[320px] rounded-2xl border bg-[var(--color-bg-1)]',
        'px-4 py-3 transition-shadow duration-150',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)]',
        selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]" />

      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-bg-2)', color: 'var(--color-fg-muted)' }}
        >
          <TriggerIcon size={16} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium leading-tight text-[var(--color-fg)]">
              {f.name}
            </span>
            {isLocked ? (
              <Lock size={11} className="shrink-0 text-[var(--color-fg-subtle)]" />
            ) : isAi ? (
              <Bot
                size={11}
                className="shrink-0"
                style={{ color: 'var(--color-accent-strong)' }}
              />
            ) : null}
          </div>
          {trigger && (
            <div className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--color-fg-subtle)]">
              {trigger.detail}
            </div>
          )}
          {f.summary && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {f.summary}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--color-fg-subtle)]">
          <span className="font-mono">{f.steps.length} 步</span>
          {f.tags && f.tags.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">
                {f.tags.slice(0, 3).map((t) => '#' + t).join(' ')}
              </span>
            </>
          )}
        </div>
        {lowConfidence && (
          <span
            title={'AI 推测，置信度 ' + f.confidence.toFixed(2)}
            className="rounded-md px-1 font-mono text-[9.5px]"
            style={{ background: 'var(--color-bg-sunken)', color: 'var(--color-fg-subtle)' }}
          >
            ~ {f.confidence.toFixed(2)}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]" />
    </div>
  )
}

export const FeatureNodeView = memo(FeatureNodeViewImpl)
