import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import type { Ucg } from '@/ucg/types'
import { layoutView } from './layout'
import { aggregate, type ViewNode } from './aggregation'
import { UcgNodeView, type UcgFlowNodeData } from './UcgNodeView'
import { GroupNodeView, type GroupNodeData } from './GroupNodeView'
import { NodeDetailsPanel } from './NodeDetailsPanel'

interface Props {
  ucg: Ucg
}

const nodeTypes = {
  group: GroupNodeView,
  external_group: GroupNodeView,
  module: UcgNodeView,
  external_member: UcgNodeView,
}

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
}

export function GraphCanvas({ ucg }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const view = useMemo(() => aggregate(ucg, expanded), [ucg, expanded])

  const { rfNodes, rfEdges } = useMemo(() => {
    const laidOut = layoutView(view.nodes, view.edges)
    const nodes: Node<UcgFlowNodeData | GroupNodeData>[] = laidOut.map((n) => ({
      id: n.id,
      type: n.kind === 'group' || n.kind === 'external_group' ? n.kind : n.kind,
      position: n.position,
      data:
        n.kind === 'group' || n.kind === 'external_group'
          ? { view: n satisfies ViewNode }
          : { view: n satisfies ViewNode },
    }))
    const edges: Edge[] = view.edges.map((e) => {
      const isImport = e.kind === 'import'
      const stroke = isImport
        ? 'var(--color-edge-import)'
        : e.kind === 'route_to' || e.kind === 'publish' || e.kind === 'subscribe'
        ? 'var(--color-edge-route)'
        : 'var(--color-edge-call)'
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.count > 1 ? `${e.kind} ×${e.count}` : e.kind,
        labelStyle: {
          fill: 'var(--color-fg-subtle)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
        },
        labelBgStyle: { fill: 'var(--color-bg-1)', fillOpacity: 0.85 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke,
          strokeWidth: Math.min(1 + Math.log2(e.count + 1) * 0.4, 2.4),
          strokeDasharray: e.hasLowConfidence ? '4 4' : undefined,
          opacity: 0.85,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: stroke,
        },
      }
    })
    return { rfNodes: nodes, rfEdges: edges }
  }, [view])

  const toggleGroup = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'group' || node.type === 'external_group') {
        toggleGroup(node.id)
      }
    },
    [toggleGroup],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id)
  }, [])

  const selectedView: ViewNode | null = useMemo(() => {
    if (!selectedNodeId) return null
    return view.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [selectedNodeId, view.nodes])

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        onlyRenderVisibleElements
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => setSelectedNodeId(null)}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="oklch(0.8 0.018 70)"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="oklch(0.948 0.012 80 / 0.55)"
          nodeColor={(n) => {
            const t = n.type
            if (t === 'group') return 'oklch(0.78 0.04 240)'
            if (t === 'external_group' || t === 'external_member') return 'oklch(0.8 0.012 70)'
            return 'oklch(0.78 0.04 240)'
          }}
          nodeStrokeWidth={0}
        />
        <Controls position="bottom-right" />
      </ReactFlow>

      <ViewLegend
        groups={view.groups}
        onToggle={toggleGroup}
      />

      <NodeDetailsPanel
        view={selectedView}
        ucg={ucg}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  )
}

function ViewLegend({
  groups,
  onToggle,
}: {
  groups: { id: string; label: string; expanded: boolean; memberCount: number }[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10">
      <div className="pointer-events-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)]/85 px-3 py-2 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
        <div className="mb-1.5 text-[10px] font-medium tracking-wide text-[var(--color-fg-subtle)]">
          视图分组（双击节点或点这里展开）
        </div>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => onToggle(g.id)}
              className={
                'rounded-md border px-2 py-0.5 font-mono text-[10.5px] transition-colors ' +
                (g.expanded
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-sunken)]')
              }
            >
              {g.label}
              <span className="ml-1 text-[var(--color-fg-subtle)]">
                {g.memberCount}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
