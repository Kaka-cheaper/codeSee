import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import type { FeaturesFile } from '@/fcg/types'
import {
  buildView,
  type FcgViewEdge,
  type FcgViewNode,
  type FcgViewState,
  type ViewMode,
} from './fcgView'
import { layoutViewAsync, mergeWithPrevious } from './layout'
import { useForceLayout } from './useForceLayout'
import { EpicNodeView, type EpicNodeData } from './EpicNodeView'
import { FeatureNodeView, type FeatureNodeData } from './FeatureNodeView'
import { StepNodeView, type StepNodeData } from './StepNodeView'
import { FLOW_META, ROLE_META } from './roleMeta'
import { DetailsPanel } from './DetailsPanel'

import { EpicGroupBg, type EpicGroupBgData } from './EpicGroupBg'

interface Props {
  file: FeaturesFile
}

const nodeTypes = {
  epic: EpicNodeView,
  feature: FeatureNodeView,
  step: StepNodeView,
  epicGroup: EpicGroupBg,
}

const defaultEdgeOptions = { type: 'smoothstep' as const }

/** 视图键：相同 viewKey 时复用位置缓存以保持稳定 */
function viewKeyOf(state: FcgViewState): string {
  return state.mode === 'steps'
    ? `steps:${state.focusedFeatureId ?? ''}`
    : state.mode
}

export function GraphCanvas({ file }: Props) {
  return (
    <GraphInner file={file} />
  )
}

function GraphInner({ file }: Props) {
  const [state, setState] = useState<FcgViewState>({ mode: 'features' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const reactFlow = useReactFlow()

  const view = useMemo(() => buildView(file, state), [file, state])
  const viewKey = viewKeyOf(state)

  /** 按 viewKey 缓存最近一次布局位置；切视图时换桶。 */
  const positionsRef = useRef<
    Map<string /* viewKey */, Map<string /* nodeId */, { x: number; y: number }>>
  >(new Map())

  /** 判定本次哪些节点是"新出现的"，用于淡入动效。 */
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set())

  /** 布局后的 React Flow 节点和边 */
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const [, setLayoutDone] = useState(false)

  /** 异步布局：先放节点让 RF 测量，测量完后用真实尺寸跑 ELK */
  useEffect(() => {
    let cancelled = false
    setLayoutDone(false)

    // 第一帧：所有节点放 (0,0)，hidden，让 React Flow 测量真实尺寸
    const initialNodes: Node[] = view.nodes.map((v) => {
      const baseData = { view: v, isNew: false } as unknown as
        | EpicNodeData
        | FeatureNodeData
        | StepNodeData
      return {
        id: v.id,
        type: v.kind === 'epic' ? 'epic' : v.kind === 'feature' ? 'feature' : 'step',
        position: { x: 0, y: 0 },
        data: baseData,
        hidden: true,
      }
    })
    setRfNodes(initialNodes)
    setRfEdges(view.edges.map((e) => buildEdge(e, new Set())))

    // 等一帧让 RF 渲染并测量
    const timer = window.setTimeout(async () => {
      if (cancelled) return

      // 从 RF 拿测量后的真实尺寸
      const measured = reactFlow.getNodes()
      const sizeMap = new Map<string, { width: number; height: number }>()
      for (const n of measured) {
        const w = n.measured?.width ?? n.width ?? 280
        const h = n.measured?.height ?? n.height ?? 132
        sizeMap.set(n.id, { width: w, height: h })
      }
      measuredSizesRef.current = sizeMap

      // 用真实尺寸跑 ELK
      const epicNames = new Map(file.epics.map((e) => [e.id, e.name]))
      const layoutResult = await layoutViewAsync(view.nodes, view.edges, epicNames, sizeMap)
      if (cancelled) return

      const prev = positionsRef.current.get(viewKey)
      let finalNodes = layoutResult.nodes
      let newIds = new Set<string>()
      const groups = layoutResult.groups
      if (prev && prev.size > 0) {
        const r = mergeWithPrevious(layoutResult, prev)
        finalNodes = r.merged
        newIds = r.newIds
      }

      // 写回缓存
      const next = new Map<string, { x: number; y: number }>()
      for (const n of finalNodes) next.set(n.view.id, n.position)
      positionsRef.current.set(viewKey, next)

      setRfNodes(toRfNodes(finalNodes, newIds, groups))
      setRfEdges(view.edges.map((e) => buildEdge(e, newIds)))
      setNewNodeIds(newIds)
      setLayoutDone(true)
    }, 50) // 50ms 足够 RF 完成一帧渲染和测量

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewKey])

  // 概览视图：力导向布局
  const isOverview = state.mode === 'overview'
  const measuredSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map())

  const handleForceTick = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      // 用 React Flow 的 setNodes 直接 patch 位置，避免整个数组重建导致闪烁
      reactFlow.setNodes((nds) =>
        nds.map((n) => {
          const pos = positions.get(n.id)
          if (!pos) return n
          // 只在位置真正变化时更新（避免无意义 re-render）
          if (Math.abs(n.position.x - pos.x) < 0.5 && Math.abs(n.position.y - pos.y) < 0.5) {
            return n
          }
          return { ...n, position: pos }
        }),
      )
    },
    [reactFlow],
  )

  const { onDragStart, onDrag, onDragEnd } = useForceLayout({
    nodes: view.nodes,
    edges: view.edges,
    measuredSizes: measuredSizesRef.current,
    enabled: isOverview,
    onTick: handleForceTick,
  })

  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => {
      if (isOverview) onDragStart(node.id)
    },
    [isOverview, onDragStart],
  )

  const handleNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      if (isOverview) onDrag(node.id, node.position.x, node.position.y)
    },
    [isOverview, onDrag],
  )

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (isOverview) onDragEnd(node.id)
    },
    [isOverview, onDragEnd],
  )

  // 切视图后自动 fit
  useEffect(() => {
    const t = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 320 })
    }, 30)
    return () => window.clearTimeout(t)
  }, [viewKey, reactFlow])

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const v = view.nodes.find((n) => n.id === node.id)
      if (!v) return
      if (v.kind === 'epic') {
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
        minZoom={0.2}
        maxZoom={2}
        onlyRenderVisibleElements
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
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
              if (data?.view.kind === 'step')
                return (ROLE_META[data.view.stepRole] ?? ROLE_META.other).minimap
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

      {newNodeIds.size > 0 && state.mode === 'features' && (
        <NewNodeIndicator count={newNodeIds.size} />
      )}

      <DetailsPanel view={selectedView} file={file} onClose={() => setSelectedId(null)} />
    </div>
  )
}

/* --------------------------------------------------------- helpers */

import type { LaidOutNode, LayoutGroup } from './layout'

function toRfNodes(
  laid: LaidOutNode[],
  newIds: Set<string>,
  groups: LayoutGroup[] = [],
): Node[] {
  // group 背景节点放最前面（z-index 最低）
  const groupNodes: Node<EpicGroupBgData>[] = groups.map((g) => ({
    id: g.id,
    type: 'epicGroup',
    position: g.position,
    draggable: false,
    selectable: false,
    data: { label: g.label, width: g.width, height: g.height },
    style: { zIndex: -1 },
  }))

  const featureNodes = laid.map(({ view: v, position }) => {
    const isNew = newIds.has(v.id)
    const baseData = { view: v, isNew } as unknown as
      | EpicNodeData
      | FeatureNodeData
      | StepNodeData
    if (v.kind === 'epic') {
      return { id: v.id, type: 'epic', position, data: baseData }
    }
    if (v.kind === 'feature') {
      return { id: v.id, type: 'feature', position, data: baseData }
    }
    return { id: v.id, type: 'step', position, data: baseData }
  })

  return [...groupNodes, ...featureNodes] as Node[]
}

function buildEdge(e: FcgViewEdge, newNodeIds: Set<string>): Edge {
  let stroke = 'var(--color-edge-call)'
  let dashed = false
  let animated = false
  if (e.scope === 'step') {
    const m =
      (e.kind && FLOW_META[e.kind as keyof typeof FLOW_META]) ?? FLOW_META.next
    stroke = m.stroke
    dashed = m.dashed
    animated = m.animated
  } else if (e.kind === 'epic-link' || e.kind === 'feature-link') {
    stroke = 'var(--color-edge-import)'
    dashed = true
  }
  // 边端点是新节点 → 边也淡入
  const involvesNew = newNodeIds.has(e.source) || newNodeIds.has(e.target)
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
      animation: involvesNew ? 'edge-fade-in 360ms ease-out both' : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 13,
      height: 13,
      color: stroke,
    },
  }
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

function NewNodeIndicator({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
      <div
        className="pointer-events-auto rounded-full border px-3 py-1 text-[11.5px] shadow-[0_1px_2px_oklch(0_0_0/0.04)]"
        style={{
          background: 'var(--color-accent-soft)',
          color: 'var(--color-accent-strong)',
          borderColor: 'var(--color-accent)',
        }}
      >
        +{count} 个新节点
      </div>
    </div>
  )
}
