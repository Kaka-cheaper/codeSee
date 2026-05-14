import { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react'
import type { Ucg, UcgNode } from '@/ucg/types'
import { groupMembersOf, type ViewNode } from './aggregation'
import { NODE_KIND_META } from './kindMeta'
import { cn } from '@/lib/cn'

interface Props {
  view: ViewNode | null
  ucg: Ucg
  onClose: () => void
}

export function NodeDetailsPanel({ view, ucg, onClose }: Props) {
  const isGroup = view?.kind === 'group' || view?.kind === 'external_group'

  // 对于聚合节点，用其内部成员计算上下游
  const peerInfo = useMemo(() => {
    if (!view) return { incoming: [], outgoing: [], idToName: new Map() }

    if (isGroup) {
      const members = groupMembersOf(ucg, view.id)
      const memberIds = new Set(members.map((m) => m.id))
      // 对于 group，上下游 = 成员的对外边
      const incoming = ucg.edges.filter(
        (e) => memberIds.has(e.target) && !memberIds.has(e.source),
      )
      const outgoing = ucg.edges.filter(
        (e) => memberIds.has(e.source) && !memberIds.has(e.target),
      )
      const idToName = new Map(ucg.nodes.map((n) => [n.id, n.name]))
      return { incoming, outgoing, idToName }
    }

    const ucgId = view.ucg?.id ?? ''
    const incoming = ucg.edges.filter((e) => e.target === ucgId)
    const outgoing = ucg.edges.filter((e) => e.source === ucgId)
    const idToName = new Map(ucg.nodes.map((n) => [n.id, n.name]))
    return { incoming, outgoing, idToName }
  }, [view, ucg, isGroup])

  return (
    <aside
      className={cn(
        'pointer-events-none absolute top-4 right-4 bottom-4 z-10 w-[348px]',
        'transition-[opacity,transform] duration-150',
        view ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
      )}
    >
      {view && (
        <div
          className={cn(
            'pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)]',
            'bg-[var(--color-bg-1)]',
            'shadow-[0_1px_2px_oklch(0_0_0/0.04),0_24px_48px_-24px_oklch(0_0_0/0.18)]',
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide"
                  style={kindStyle(view)}
                >
                  {kindLabel(view)}
                </span>
                {view.ucg?.language && (
                  <span className="text-[11px] text-[var(--color-fg-subtle)]">
                    {view.ucg.language}
                  </span>
                )}
              </div>
              <h2 className="mt-2 truncate text-[14px] font-medium tracking-tight text-[var(--color-fg)]">
                {view.label}
              </h2>
              {view.pathHint && (
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                  {view.pathHint}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="-mr-1 rounded-md p-1.5 text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
              aria-label="关闭"
            >
              <X size={15} />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {isGroup && (
              <Section title="成员">
                <ul className="space-y-1">
                  {groupMembersOf(ucg, view.id)
                    .slice(0, 30)
                    .map((m) => (
                      <li
                        key={m.id}
                        className="truncate font-mono text-[11px] text-[var(--color-fg-muted)]"
                      >
                        {m.qualified_name}
                      </li>
                    ))}
                </ul>
              </Section>
            )}

            {view.ucg?.location && !isGroup && (
              <Section title="位置">
                <div className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                  {view.ucg.location.file}
                  <span className="text-[var(--color-fg-subtle)]">
                    :{view.ucg.location.start_line}-{view.ucg.location.end_line}
                  </span>
                </div>
              </Section>
            )}

            <Section
              title={
                <div className="flex items-center gap-1.5">
                  <ArrowDownRight size={12} />
                  上游 ({peerInfo.incoming.length})
                </div>
              }
            >
              <EdgeList
                edges={peerInfo.incoming}
                idToName={peerInfo.idToName}
                idToNode={ucg.nodes}
                side="source"
              />
            </Section>

            <Section
              title={
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight size={12} />
                  下游 ({peerInfo.outgoing.length})
                </div>
              }
            >
              <EdgeList
                edges={peerInfo.outgoing}
                idToName={peerInfo.idToName}
                idToNode={ucg.nodes}
                side="target"
              />
            </Section>
          </div>
        </div>
      )}
    </aside>
  )
}

function kindLabel(view: ViewNode): string {
  if (view.kind === 'group') return 'Package'
  if (view.kind === 'external_group') return 'External (clustered)'
  if (view.kind === 'external_member') return 'External'
  return 'Module'
}

function kindStyle(view: ViewNode): React.CSSProperties {
  if (view.kind === 'external_group' || view.kind === 'external_member') {
    return {
      color: NODE_KIND_META.external.chipFg,
      background: NODE_KIND_META.external.chipBg,
    }
  }
  return {
    color: NODE_KIND_META.module.chipFg,
    background: NODE_KIND_META.module.chipBg,
  }
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[10.5px] font-medium tracking-wide text-[var(--color-fg-subtle)]">
        {title}
      </div>
      {children}
    </section>
  )
}

function EdgeList({
  edges,
  idToName,
  side,
}: {
  edges: { id: string; source: string; target: string; kind: string; confidence: number }[]
  idToName: Map<string, string>
  idToNode: UcgNode[]
  side: 'source' | 'target'
}) {
  if (edges.length === 0) {
    return <div className="text-[11px] text-[var(--color-fg-subtle)]">（无）</div>
  }
  return (
    <ul className="space-y-1.5">
      {edges.slice(0, 50).map((e) => {
        const peerId = side === 'source' ? e.source : e.target
        return (
          <li
            key={e.id}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5"
          >
            <span className="font-mono text-[9.5px] tracking-wide text-[var(--color-fg-subtle)]">
              {e.kind}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg)]">
              {idToName.get(peerId) ?? peerId}
            </span>
            {e.confidence < 1 && (
              <span className="rounded bg-[var(--color-bg-sunken)] px-1 font-mono text-[9.5px] text-[var(--color-fg-subtle)]">
                p={e.confidence.toFixed(2)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
