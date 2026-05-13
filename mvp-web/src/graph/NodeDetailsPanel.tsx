import { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react'
import type { Ucg, UcgNode } from '@/ucg/types'
import { EDGE_KIND_META, NODE_KIND_META } from './kindMeta'
import { cn } from '@/lib/cn'

interface Props {
  node: UcgNode | null
  ucg: Ucg
  onClose: () => void
}

export function NodeDetailsPanel({ node, ucg, onClose }: Props) {
  const incoming = useMemo(
    () => (node ? ucg.edges.filter((e) => e.target === node.id) : []),
    [node, ucg.edges],
  )
  const outgoing = useMemo(
    () => (node ? ucg.edges.filter((e) => e.source === node.id) : []),
    [node, ucg.edges],
  )
  const idToNode = useMemo(() => new Map(ucg.nodes.map((n) => [n.id, n])), [ucg.nodes])

  return (
    <aside
      className={cn(
        'pointer-events-none absolute top-4 right-4 bottom-4 z-10 w-[348px]',
        'transition-[opacity,transform] duration-200',
        node ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
      )}
    >
      {node && (
        <div
          className={cn(
            'pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)]',
            'bg-[var(--color-bg-1)]/90 backdrop-blur-md',
            'shadow-[0_1px_2px_oklch(0_0_0/0.04),0_24px_48px_-24px_oklch(0_0_0/0.18)]',
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide"
                  style={{
                    color: NODE_KIND_META[node.kind].chipFg,
                    background: NODE_KIND_META[node.kind].chipBg,
                  }}
                >
                  {NODE_KIND_META[node.kind].label}
                </span>
                <span className="text-[11px] text-[var(--color-fg-subtle)]">
                  {node.language}
                </span>
              </div>
              <h2 className="mt-2 truncate text-[14px] font-medium tracking-tight text-[var(--color-fg)]">
                {node.name}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                {node.qualified_name}
              </p>
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
            {node.location && (
              <Section title="位置">
                <div className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                  {node.location.file}
                  <span className="text-[var(--color-fg-subtle)]">
                    :{node.location.start_line}-{node.location.end_line}
                  </span>
                </div>
              </Section>
            )}

            <Section
              title={
                <div className="flex items-center gap-1.5">
                  <ArrowDownRight size={12} />
                  上游 ({incoming.length})
                </div>
              }
            >
              <EdgeList edges={incoming} idToNode={idToNode} side="source" />
            </Section>

            <Section
              title={
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight size={12} />
                  下游 ({outgoing.length})
                </div>
              }
            >
              <EdgeList edges={outgoing} idToNode={idToNode} side="target" />
            </Section>

            {node.meta && Object.keys(node.meta).length > 0 && (
              <Section title="元数据">
                <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-2.5 font-mono text-[10.5px] leading-relaxed text-[var(--color-fg-muted)]">
                  {JSON.stringify(node.meta, null, 2)}
                </pre>
              </Section>
            )}
          </div>
        </div>
      )}
    </aside>
  )
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
  idToNode,
  side,
}: {
  edges: {
    id: string
    source: string
    target: string
    kind: keyof typeof EDGE_KIND_META
    confidence: number
  }[]
  idToNode: Map<string, UcgNode>
  side: 'source' | 'target'
}) {
  if (edges.length === 0) {
    return <div className="text-[11px] text-[var(--color-fg-subtle)]">（无）</div>
  }
  return (
    <ul className="space-y-1.5">
      {edges.map((e) => {
        const peerId = side === 'source' ? e.source : e.target
        const peer = idToNode.get(peerId)
        const meta = EDGE_KIND_META[e.kind]
        return (
          <li
            key={e.id}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5 transition-colors hover:bg-[var(--color-bg-2)]"
          >
            <span
              className="font-mono text-[9.5px] tracking-wide"
              style={{ color: meta.stroke }}
            >
              {meta.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg)]">
              {peer?.name ?? peerId}
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
