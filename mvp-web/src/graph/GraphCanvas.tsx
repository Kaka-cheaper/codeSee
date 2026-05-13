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
        labelBgStyle: { fill: 'var(--color-bg-1)', fillOpacity: 0.85 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        style: {
          stroke: meta.stroke,
          strokeWidth: 1.25,
          strokeDasharray: meta.dashed || isLow ? '4 4' : undefined,
          opacity: isLow ? 0.7 : 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 13,
          height: 13,
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
          gap={28}
          size={1}
          color="oklch(0.86 0.012 70)"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="oklch(0.985 0.006 78 / 0.6)"
          nodeColor={(n) => {
            const data = n.data as unknown as UcgFlowNodeData | undefined
            const kind = data?.ucg.kind
            return kind ? NODE_KIND_META[kind].minimap : 'oklch(0.8 0.012 70)'
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
