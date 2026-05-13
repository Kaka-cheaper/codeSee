import { useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import type { Ucg, UcgNode } from '@/ucg/types'
import { layoutUcg } from './layout'
import { EDGE_KIND_META, NODE_KIND_META } from './kindMeta'
import { UcgNodeView, type UcgFlowNodeData } from './UcgNodeView'
import { NodeDetailsPanel } from './NodeDetailsPanel'

interface Props {
  ucg: Ucg
}

const nodeTypes = { ucg: UcgNodeView }

export function GraphCanvas({ ucg }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const { rfNodes, rfEdges } = useMemo(() => {
    const laidOut = layoutUcg(ucg)
    const nodes: Node<UcgFlowNodeData>[] = laidOut.map((n) => ({
      id: n.id,
      type: 'ucg',
      position: n.position,
      data: { ucg: n },
    }))
    const edges: Edge[] = ucg.edges.map((e) => {
      const meta = EDGE_KIND_META[e.kind]
      const isLow = e.confidence < 1
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: e.kind === 'publish' || e.kind === 'subscribe',
        label: meta.label,
        labelStyle: {
          fill: 'var(--color-fg-subtle)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
        },
        labelBgStyle: { fill: 'var(--color-bg-1)' },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        style: {
          stroke: meta.stroke,
          strokeWidth: 1.4,
          strokeDasharray: meta.dashed || isLow ? '4 4' : undefined,
          opacity: isLow ? 0.75 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: meta.stroke,
        },
      }
    })
    return { rfNodes: nodes, rfEdges: edges }
  }, [ucg])

  const selectedNode: UcgNode | null = useMemo(() => {
    if (!selectedNodeId) return null
    return ucg.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [selectedNodeId, ucg.nodes])

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: false }}
        minZoom={0.2}
        maxZoom={2}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="oklch(0.32 0.02 260)"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="oklch(0.16 0.012 260 / 0.7)"
          nodeColor={(n) => {
            const data = n.data as unknown as UcgFlowNodeData | undefined
            const kind = data?.ucg.kind
            return kind ? NODE_KIND_META[kind].dot : 'oklch(0.5 0.02 260)'
          }}
          nodeStrokeWidth={0}
        />
        <Controls position="bottom-right" />
      </ReactFlow>
      <NodeDetailsPanel
        node={selectedNode}
        ucg={ucg}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  )
}
