import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
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
import type { LaidOutNode, LayoutGroup } from './layout'

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

function viewKeyOf(state: FcgViewState): string {
  return state.mode === 'steps'
    ? `steps:${state.focusedFeatureId ?? ''}`
    : state.mode
}

export function GraphCanvas({ file }: Props) {
  return <GraphInner file={file} />
}

function GraphInner({ file }: Props) {
  const [state, setState] = useState<FcgViewState>({ mode: 'features' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const reactFlow = useReactFlow()

  const view = useMemo(() => buildView(file, state), [file, state])
  const viewKey = viewKeyOf(state)
  const isOverview = state.mode === 'overview'

  const positionsRef = useRef<
    Map<string, Map<string, { x: number; y: number }>>
  >(new Map())
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set())
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const measuredSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map())

  // React Flow 受控模式：拖动/选中等内部变化必须通过这两个回调同步到 state
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => {
      let updated = applyNodeChanges(changes, nds)

      // 检测容器拖动：如果 group 节点位置变了，内部节点跟着移动
      for (const change of changes) {
        if (change.type !== 'position' || !change.position || !change.dragging) continue
        const nodeId = change.id
        if (!nodeId.startsWith('group:')) continue
        const epicId = nodeId.replace(/^group:/, '')
        const oldGroup = nds.find((n) => n.id === nodeId)
        if (!oldGroup) continue
        const dx = (change.position.x ?? 0) - oldGroup.position.x
        const dy = (change.position.y ?? 0) - oldGroup.position.y
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue

        updated = updated.map((n) => {
          if (n.type === 'epicGroup' || n.id === nodeId) return n
          const data = n.data as { view?: { kind?: string; feature?: { epicId?: string } } } | undefined
          const nEpicId = data?.view?.kind === 'feature' ? (data.view.feature?.epicId ?? '__none__') : null
          if (nEpicId !== epicId) return n
          return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        })
      }

      return updateGroupBounds(updated)
    })
  }, [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  /* ==================== ELK 布局（功能/流程视图） ==================== */
  useEffect(() => {
    // 概览视图由力导向管理，跳过 ELK
    if (isOverview) return

    let cancelled = false

    const initialNodes: Node[] = view.nodes.map((v) => ({
      id: v.id,
      type: v.kind === 'epic' ? 'epic' : v.kind === 'feature' ? 'feature' : 'step',
      position: { x: 0, y: 0 },
      data: { view: v, isNew: false } as unknown as EpicNodeData | FeatureNodeData | StepNodeData,
      style: { opacity: 0, pointerEvents: 'none' as const },
    }))
    setRfNodes(initialNodes)
    setRfEdges(view.edges.map((e) => buildEdge(e, new Set())))

    const timer = window.setTimeout(async () => {
      if (cancelled) return
      const measured = reactFlow.getNodes()
      const sizeMap = new Map<string, { width: number; height: number }>()
      for (const n of measured) {
        sizeMap.set(n.id, {
          width: n.measured?.width ?? n.width ?? 280,
          height: n.measured?.height ?? n.height ?? 132,
        })
      }
      measuredSizesRef.current = sizeMap

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

      const next = new Map<string, { x: number; y: number }>()
      for (const n of finalNodes) next.set(n.view.id, n.position)
      positionsRef.current.set(viewKey, next)

      setRfNodes(toRfNodes(finalNodes, newIds, groups))
      setRfEdges(view.edges.map((e) => buildEdge(e, newIds)))
      setNewNodeIds(newIds)
    }, 50)

    return () => { cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewKey, isOverview])

  /* ==================== 力导向布局（概览视图） ==================== */
  // 概览视图切入时初始化节点
  useEffect(() => {
    if (!isOverview) return
    const nodes: Node[] = view.nodes.map((v) => ({
      id: v.id,
      type: 'epic',
      position: { x: Math.random() * 400 - 200, y: Math.random() * 300 - 150 },
      data: { view: v, isNew: false } as unknown as EpicNodeData,
    }))
    setRfNodes(nodes)
    setRfEdges(view.edges.map((e) => buildEdge(e, new Set())))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverview, view])

  const handleForceTick = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      setRfNodes((prev) =>
        prev.map((n) => {
          const pos = positions.get(n.id)
          if (!pos) return n
          if (Math.abs(n.position.x - pos.x) < 0.5 && Math.abs(n.position.y - pos.y) < 0.5) return n
          return { ...n, position: pos }
        }),
      )
    },
    [],
  )

  const { onDragStart, onDrag, onDragEnd } = useForceLayout({
    nodes: view.nodes,
    edges: view.edges,
    measuredSizes: measuredSizesRef.current,
    enabled: isOverview,
    onTick: handleForceTick,
  })

  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => { if (isOverview) onDragStart(node.id) },
    [isOverview, onDragStart],
  )
  const handleNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => { if (isOverview) onDrag(node.id, node.position.x, node.position.y) },
    [isOverview, onDrag],
  )
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => { if (isOverview) onDragEnd(node.id) },
    [isOverview, onDragEnd],
  )

  /* ==================== 通用交互 ==================== */
  useEffect(() => {
    const t = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 320 })
    }, isOverview ? 500 : 80)
    return () => window.clearTimeout(t)
  }, [viewKey, reactFlow, isOverview])

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const v = view.nodes.find((n) => n.id === node.id)
      if (!v) return
      if (v.kind === 'epic') setState({ mode: 'features' })
      else if (v.kind === 'feature') setState({ mode: 'steps', focusedFeatureId: v.feature.id })
    },
    [view.nodes],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={onPaneClick}
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

const GROUP_PADDING = { top: 56, left: 32, bottom: 32, right: 32 }

/**
 * 根据内部 feature 节点的位置，重新计算每个 epicGroup 容器的 position 和 size。
 */
function updateGroupBounds(nodes: Node[]): Node[] {
  const groups = nodes.filter((n) => n.type === 'epicGroup')
  if (groups.length === 0) return nodes

  const epicIdToGroupId = new Map<string, string>()
  for (const g of groups) {
    epicIdToGroupId.set(g.id.replace(/^group:/, ''), g.id)
  }

  const bounds = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
  for (const n of nodes) {
    if (n.type === 'epicGroup') continue
    const data = n.data as { view?: { kind?: string; feature?: { epicId?: string } } } | undefined
    const epicId = data?.view?.kind === 'feature' ? (data.view.feature?.epicId ?? '__none__') : null
    if (!epicId) continue
    const groupId = epicIdToGroupId.get(epicId)
    if (!groupId) continue

    const w = n.measured?.width ?? n.width ?? 280
    const h = n.measured?.height ?? n.height ?? 160
    const x = n.position.x
    const y = n.position.y

    const prev = bounds.get(groupId)
    if (!prev) {
      bounds.set(groupId, { minX: x, minY: y, maxX: x + w, maxY: y + h })
    } else {
      prev.minX = Math.min(prev.minX, x)
      prev.minY = Math.min(prev.minY, y)
      prev.maxX = Math.max(prev.maxX, x + w)
      prev.maxY = Math.max(prev.maxY, y + h)
    }
  }

  return nodes.map((n) => {
    if (n.type !== 'epicGroup') return n
    const b = bounds.get(n.id)
    if (!b) return n
    const newPos = { x: b.minX - GROUP_PADDING.left, y: b.minY - GROUP_PADDING.top }
    const newWidth = (b.maxX - b.minX) + GROUP_PADDING.left + GROUP_PADDING.right
    const newHeight = (b.maxY - b.minY) + GROUP_PADDING.top + GROUP_PADDING.bottom
    const oldData = n.data as EpicGroupBgData
    if (
      Math.abs(n.position.x - newPos.x) < 1 &&
      Math.abs(n.position.y - newPos.y) < 1 &&
      Math.abs(oldData.width - newWidth) < 1 &&
      Math.abs(oldData.height - newHeight) < 1
    ) return n
    return { ...n, position: newPos, data: { ...oldData, width: newWidth, height: newHeight } }
  })
}

function toRfNodes(
  laid: LaidOutNode[],
  newIds: Set<string>,
  groups: LayoutGroup[] = [],
): Node[] {
  const groupNodes: Node<EpicGroupBgData>[] = groups.map((g) => ({
    id: g.id,
    type: 'epicGroup',
    position: g.position,
    draggable: true,
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
    if (v.kind === 'epic') return { id: v.id, type: 'epic', position, data: baseData }
    if (v.kind === 'feature') return { id: v.id, type: 'feature', position, data: baseData }
    return { id: v.id, type: 'step', position, data: baseData }
  })

  return [...groupNodes, ...featureNodes] as Node[]
}

function buildEdge(e: FcgViewEdge, newNodeIds: Set<string>): Edge {
  let stroke = 'var(--color-edge-call)'
  let dashed = false
  let animated = false
  if (e.scope === 'step') {
    const m = (e.kind && FLOW_META[e.kind as keyof typeof FLOW_META]) ?? FLOW_META.next
    stroke = m.stroke
    dashed = m.dashed
    animated = m.animated
  } else if (e.kind === 'epic-link' || e.kind === 'feature-link') {
    stroke = 'var(--color-edge-import)'
    dashed = true
  }
  const involvesNew = newNodeIds.has(e.source) || newNodeIds.has(e.target)
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    animated,
    label: e.label || undefined,
    labelStyle: { fill: 'var(--color-fg-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' },
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
    markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color: stroke },
  }
}

/* --------------------------------------------------------- UI */

function ViewSwitcher({ mode, focusedFeatureName, onChangeMode }: {
  mode: ViewMode; focusedFeatureName?: string; onChangeMode: (m: ViewMode) => void
}) {
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <div className="pointer-events-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-1.5 py-1 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
        <div className="flex items-center gap-0.5">
          <ModeBtn active={mode === 'overview'} onClick={() => onChangeMode('overview')}>概览</ModeBtn>
          <ModeBtn active={mode === 'features'} onClick={() => onChangeMode('features')}>功能</ModeBtn>
          <ModeBtn active={mode === 'steps'} onClick={() => mode === 'steps' && onChangeMode('steps')} disabled={mode !== 'steps'} title={mode !== 'steps' ? '请先在功能视图双击一个功能' : undefined}>流程</ModeBtn>
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

function ModeBtn({ active, onClick, disabled, children, title }: {
  active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; title?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={'rounded-md px-2.5 py-1 text-[11.5px] transition-colors ' +
        (active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
          : disabled ? 'text-[var(--color-fg-subtle)] opacity-50'
          : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]')}
    >{children}</button>
  )
}

function NewNodeIndicator({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
      <div className="pointer-events-auto rounded-full border px-3 py-1 text-[11.5px] shadow-[0_1px_2px_oklch(0_0_0/0.04)]"
        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-strong)', borderColor: 'var(--color-accent)' }}>
        +{count} 个新节点
      </div>
    </div>
  )
}
