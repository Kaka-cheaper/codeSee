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
import type { FeaturesFile } from '@/fcg/types'
import {
  buildView,
  type FcgViewEdge,
  type FcgViewNode,
  type FcgViewState,
  type ViewMode,
} from './fcgView'
import { layoutView } from './layout'
import { EpicNodeView, type EpicNodeData } from './EpicNodeView'
import { FeatureNodeView, type FeatureNodeData } from './FeatureNodeView'
import { StepNodeView, type StepNodeData } from './StepNodeView'
import { FLOW_META, ROLE_META } from './roleMeta'
import { DetailsPanel } from './DetailsPanel'

interface Props {
  file: FeaturesFile
}

const nodeTypes = {
  epic: EpicNodeView,
  feature: FeatureNodeView,
  step: StepNodeView,
}

const defaultEdgeOptions = { type: 'smoothstep' as const }

export function GraphCanvas({ file }: Props) {
  const [state, setState] = useState<FcgViewState>({ mode: 'features' })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const view = useMemo(() => buildView(file, state), [file, state])

  const { rfNodes, rfEdges } = useMemo(
    () => toReactFlow(view.nodes, view.edges),
    [view],
  )

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const v = view.nodes.find((n) => n.id === node.id)
      if (!v) return
      if (v.kind === 'epic') {
        // Epic 双击 → 切到 features 视图（暂不按 epic 过滤，后续可加）
        setState({ mode: 'features' })
      } else if (v.kind === 'feature') {
        setState({ mode: 'steps', focusedFeatureId: v.feature.id })
      }
    },
    [view.nodes],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id)
  }, [])

  const selectedView: FcgViewNode | null = useMemo(() => {
    if (!selectedId) return null
    return view.nodes.find((n) => n.id === selectedId) ?? null
  }, [selectedId, view.nodes])

  const goMode = useCallback((mode: ViewMode) => {
    setState((prev) => ({
      mode,
      focusedFeatureId: mode === 'steps' ? prev.focusedFeatureId : undefined,
    }))
  }, [])

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.25}
        maxZoom={2}
        onlyRenderVisibleElements
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => setSelectedId(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="oklch(0.8 0.018 70)" />
        <MiniMap
          pannable
          zoomable
          maskColor="oklch(0.948 0.012 80 / 0.55)"
          nodeColor={(n) => {
            if (n.type === 'step') {
              const data = n.data as unknown as StepNodeData | undefined
              if (data?.view.kind === 'step') return ROLE_META[data.view.stepRole].minimap
            }
            if (n.type === 'feature') return 'oklch(0.78 0.04 60)'
            return 'oklch(0.78 0.05 240)'
          }}
          nodeStrokeWidth={0}
        />
        <Controls position="bottom-right" />
      </ReactFlow>

      <ViewSwitcher
        mode={state.mode}
        focusedFeatureName={
          state.focusedFeatureId
            ? file.features.find((f) => f.id === state.focusedFeatureId)?.name
            : undefined
        }
        onChangeMode={goMode}
      />

      <DetailsPanel view={selectedView} file={file} onClose={() => setSelectedId(null)} />
    </div>
  )
}

/* --------------------------------------------------------- React Flow 转换 */

function toReactFlow(nodes: FcgViewNode[], edges: FcgViewEdge[]) {
  const laid = layoutView(nodes, edges)
  const rfNodes: Node<EpicNodeData | FeatureNodeData | StepNodeData>[] = laid.map(
    ({ view, position }) => {
      if (view.kind === 'epic') {
        return { id: view.id, type: 'epic', position, data: { view } }
      }
      if (view.kind === 'feature') {
        return { id: view.id, type: 'feature', position, data: { view } }
      }
      return { id: view.id, type: 'step', position, data: { view } }
    },
  )

  const rfEdges: Edge[] = edges.map((e) => {
    let stroke = 'var(--color-edge-call)'
    let dashed = false
    let animated = false
    if (e.scope === 'step') {
      const m = FLOW_META[e.kind as keyof typeof FLOW_META] ?? FLOW_META.next
      stroke = m.stroke
      dashed = m.dashed
      animated = m.animated
    } else if (e.kind === 'epic-link' || e.kind === 'feature-link') {
      stroke = 'var(--color-edge-import)'
      dashed = true
    }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated,
      label: e.label || undefined,
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
        strokeWidth: 1.4,
        strokeDasharray: dashed ? '4 4' : undefined,
        opacity: 0.9,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 13,
        height: 13,
        color: stroke,
      },
    }
  })

  return { rfNodes, rfEdges }
}

/* --------------------------------------------------------- 视图切换器 */

function ViewSwitcher({
  mode,
  focusedFeatureName,
  onChangeMode,
}: {
  mode: ViewMode
  focusedFeatureName?: string
  onChangeMode: (m: ViewMode) => void
}) {
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <div className="pointer-events-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-1.5 py-1 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
        <div className="flex items-center gap-0.5">
          <ModeBtn active={mode === 'overview'} onClick={() => onChangeMode('overview')}>
            概览
          </ModeBtn>
          <ModeBtn active={mode === 'features'} onClick={() => onChangeMode('features')}>
            功能
          </ModeBtn>
          <ModeBtn
            active={mode === 'steps'}
            onClick={() => mode === 'steps' && onChangeMode('steps')}
            disabled={mode !== 'steps'}
            title={mode !== 'steps' ? '请先在功能视图双击一个功能' : undefined}
          >
            流程
          </ModeBtn>
        </div>
      </div>
      {mode === 'steps' && focusedFeatureName && (
        <div className="pointer-events-auto mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
          <span className="text-[var(--color-fg-subtle)]">流程：</span>
          <span className="font-medium text-[var(--color-fg)]">{focusedFeatureName}</span>
        </div>
      )}
    </div>
  )
}

function ModeBtn({
  active,
  onClick,
  disabled,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        'rounded-md px-2.5 py-1 text-[11.5px] transition-colors ' +
        (active
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
          : disabled
          ? 'text-[var(--color-fg-subtle)] opacity-50'
          : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]')
      }
    >
      {children}
    </button>
  )
}
