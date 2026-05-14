import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  ChevronDown,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  Lock,
  Package,
  Sparkles,
} from 'lucide-react'
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

  const semanticLabel = view.annotation?.label
  const showSemantic = !!semanticLabel
  const isLLM = view.annotation?.provenance.startsWith('llm@')
  const isLocked = view.annotation?.locked === true
  const lowConfidence =
    view.annotation && view.annotation.confidence < 0.7

  return (
    <div
      className={cn(
        'group relative flex min-w-[200px] max-w-[280px] items-center gap-2.5 rounded-2xl border bg-[var(--color-bg-1)]',
        'px-3.5 py-3 transition-shadow duration-150',
        'shadow-[0_1px_2px_oklch(0_0_0/0.04)]',
        'hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)]',
        selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
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
          <span
            className={cn(
              'truncate font-medium leading-tight text-[var(--color-fg)]',
              showSemantic ? 'text-[14px]' : 'text-[13.5px]',
            )}
            title={view.annotation?.summary}
          >
            {showSemantic ? semanticLabel : view.label}
          </span>
          <Chevron size={12} className="shrink-0 text-[var(--color-fg-subtle)]" />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10.5px] text-[var(--color-fg-subtle)]">
          <span className="truncate">{view.label}</span>
          <span aria-hidden>·</span>
          <span>
            {view.memberCount} {isExternal ? 'pkg' : 'mod'}
          </span>
        </div>
      </div>

      {/* 语义标注的徽标 */}
      {showSemantic && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isLocked ? (
            <span
              className="rounded-md p-1"
              title="已锁定（不会被自动覆盖）"
              style={{ background: 'var(--color-bg-2)', color: 'var(--color-fg-muted)' }}
            >
              <Lock size={10} strokeWidth={2} />
            </span>
          ) : isLLM ? (
            <span
              className="rounded-md p-1"
              title={'LLM 标注：' + view.annotation?.provenance}
              style={{
                background: 'var(--color-accent-soft)',
                color: 'var(--color-accent-strong)',
              }}
            >
              <Sparkles size={10} strokeWidth={2} />
            </span>
          ) : null}
          {lowConfidence && (
            <span
              className="rounded font-mono text-[9px] tracking-wide"
              title={'启发式低置信度：建议复核或开启 LLM'}
              style={{
                color: 'var(--color-fg-subtle)',
              }}
            >
              ~
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-[var(--color-border-strong)] !bg-[var(--color-bg-1)]"
      />
    </div>
  )
}

export const GroupNodeView = memo(GroupNodeViewImpl)
