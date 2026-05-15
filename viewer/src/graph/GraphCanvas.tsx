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
import { loadPositions, savePositions, clearPositions } from './positionStorage'
import {
  isFSASupported,
  loadLayoutFile,
  pickDirectory,
  saveLayoutFile,
  hasAuthorized,
  type LayoutFile,
} from '@/fcg/fileSystem'
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

const defaultEdgeOptions = { type: 'step' as const }

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

  // 项目标识：用于 localStorage 分桶
  const repoId = useMemo(
    () => file.manifest.repo ?? 'default',
    [file.manifest.repo],
  )

  // 节点位置缓存（按 viewKey 分桶）：启动时从 localStorage 加载（草稿）
  const positionsRef = useRef<
    Map<string, Map<string, { x: number; y: number }>>
  >(loadPositions(repoId))

  // 启动时尝试加载布局：先从 FSA（用户授权的目录），再从 /layout.json（内置示例）
  useEffect(() => {
    let cancelled = false
    async function loadLayout() {
      // 1. 尝试 FSA
      let layout = await loadLayoutFile(repoId)
      // 2. 兜底：fetch /layout.json（内置示例用）
      if (!layout) {
        try {
          const res = await fetch('/layout.json', { cache: 'no-cache' })
          if (res.ok) {
            const data = await res.json()
            if (data?.version === '0' && data?.views) layout = data
          }
        } catch { /* noop */ }
      }
      if (cancelled || !layout) return
      const restored = new Map<string, Map<string, { x: number; y: number }>>()
      for (const [viewKey, positions] of Object.entries(layout.views)) {
        restored.set(viewKey, new Map(Object.entries(positions as Record<string, { x: number; y: number }>)))
      }
      positionsRef.current = restored
      setLayoutVersion((v) => v + 1)
    }
    loadLayout()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  // 自动保存开关（持久化到 localStorage）
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    try {
      return localStorage.getItem('codesee.autoSave') !== 'false'
    } catch {
      return true
    }
  })
  const toggleAutoSave = useCallback(() => {
    setAutoSave((v) => {
      const next = !v
      try { localStorage.setItem('codesee.autoSave', String(next)) } catch { /* noop */ }
      return next
    })
  }, [])

  // 保存状态（用于 UI 提示）
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'downloaded' | 'failed'>('idle')

  /** 把当前 positionsRef 序列化为 LayoutFile */
  const serializeLayout = useCallback((): LayoutFile => {
    const views: Record<string, Record<string, { x: number; y: number }>> = {}
    for (const [viewKey, positions] of positionsRef.current) {
      if (positions.size === 0) continue
      views[viewKey] = Object.fromEntries(positions)
    }
    return {
      version: '0',
      views,
      generated_at: new Date().toISOString(),
    }
  }, [])

  // 手动保存：先存 localStorage（草稿），再尝试写文件
  // 首次保存时若支持 FSA 但还没授权 → 先弹目录选择器
  const saveLayout = useCallback(async () => {
    savePositions(repoId, positionsRef.current)

    // 首次保存：FSA 支持但还没授权 → 主动弹选择器
    if (isFSASupported()) {
      const authorized = await hasAuthorized(repoId)
      if (!authorized) {
        const handle = await pickDirectory(repoId)
        if (!handle) {
          // 用户取消授权，降级为下载
          const result = await saveLayoutFile(repoId, serializeLayout())
          setSaveStatus(result === 'downloaded' ? 'downloaded' : 'failed')
          setTimeout(() => setSaveStatus('idle'), 2500)
          return
        }
      }
    }

    const result = await saveLayoutFile(repoId, serializeLayout())
    setSaveStatus(result === 'wrote' ? 'saved' : result === 'downloaded' ? 'downloaded' : 'failed')
    setTimeout(() => setSaveStatus('idle'), 2500)
  }, [repoId, serializeLayout])

  // 文件自动保存防抖（拖动时 onTick 高频，但落盘只需偶尔一次）
  // ⚠ 自动保存永远不触发下载或弹窗——只在已授权时静默写文件
  const autoSaveTimerRef = useRef<number | null>(null)
  const scheduleAutoSaveFile = useCallback(() => {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = window.setTimeout(async () => {
      // 只在 FSA 已授权时才写文件，否则只靠 localStorage
      if (!isFSASupported()) return
      const authorized = await hasAuthorized(repoId)
      if (!authorized) return
      saveLayoutFile(repoId, serializeLayout()).catch(() => { /* noop */ })
    }, 800)
  }, [repoId, serializeLayout])
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set())
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const measuredSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map())
  const [layoutVersion, setLayoutVersion] = useState(0) // 用于重置布局

  // React Flow 受控模式：拖动/选中等内部变化必须通过这两个回调同步到 state
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => {
      let updated = applyNodeChanges(changes, nds)

      // 检测容器拖动：如果 group 节点位置变了，内部节点跟着移动
      let userDragging = false
      for (const change of changes) {
        if (change.type !== 'position' || !change.position || !change.dragging) continue
        userDragging = true
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

      const finalNodes = updateGroupBounds(updated)

      // 只在用户拖动产生的 position change 时同步缓存
      // 不能对所有 change 类型都同步——React Flow 内部的 dimensions/select 等 change
      // 在节点位置还是初始 (0,0) 时也会触发，会把 (0,0) 写入缓存污染数据
      if (userDragging) {
        const positionMap = positionsRef.current.get(viewKey)
        if (positionMap) {
          for (const n of finalNodes) {
            if (n.type === 'epicGroup') continue
            positionMap.set(n.id, { x: n.position.x, y: n.position.y })
          }
        }
        // 自动保存：localStorage 立即写（草稿），文件防抖写
        if (autoSave) {
          savePositions(repoId, positionsRef.current)
          scheduleAutoSaveFile()
        }
      }

      return finalNodes
    })
  }, [viewKey, autoSave, repoId, scheduleAutoSaveFile])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  /* ==================== ELK 布局（所有视图统一） ==================== */
  useEffect(() => {
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
      const overviewPositions = positionsRef.current.get('overview')
      const layoutResult = await layoutViewAsync(view.nodes, view.edges, epicNames, sizeMap, overviewPositions)
      if (cancelled) return

      // 缓存有就用（拖动后切视图回来能保持），重置布局时缓存已被清空
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
  }, [view, viewKey, layoutVersion])

  /* ==================== 通用交互 ==================== */
  useEffect(() => {
    const t = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 320 })
    }, 80)
    return () => window.clearTimeout(t)
  }, [viewKey, reactFlow, layoutVersion])

  const resetLayout = useCallback(() => {
    positionsRef.current.delete(viewKey)
    clearPositions(repoId, viewKey)
    setLayoutVersion((v) => v + 1)
  }, [viewKey, repoId])

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
        onResetLayout={resetLayout}
        autoSave={autoSave}
        onToggleAutoSave={toggleAutoSave}
        onSaveLayout={saveLayout}
        saveStatus={saveStatus}
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

function ViewSwitcher({ mode, focusedFeatureName, onChangeMode, onResetLayout, autoSave, onToggleAutoSave, onSaveLayout, saveStatus }: {
  mode: ViewMode
  focusedFeatureName?: string
  onChangeMode: (m: ViewMode) => void
  onResetLayout: () => void
  autoSave: boolean
  onToggleAutoSave: () => void
  onSaveLayout: () => void
  saveStatus: 'idle' | 'saved' | 'downloaded' | 'failed'
}) {
  const tipText =
    saveStatus === 'saved' ? '已保存到 layout.json' :
    saveStatus === 'downloaded' ? '已下载（请放回 .codesee/）' :
    saveStatus === 'failed' ? '保存失败' :
    null
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-1.5 py-1 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
        <ModeBtn active={mode === 'overview'} onClick={() => onChangeMode('overview')}>概览</ModeBtn>
        <ModeBtn active={mode === 'features'} onClick={() => onChangeMode('features')}>功能</ModeBtn>
        <ModeBtn active={mode === 'steps'} onClick={() => mode === 'steps' && onChangeMode('steps')} disabled={mode !== 'steps'} title={mode !== 'steps' ? '请先在功能视图双击一个功能' : undefined}>流程</ModeBtn>
        <span className="mx-0.5 h-4 w-px bg-[var(--color-border)]" />
        <button
          onClick={onToggleAutoSave}
          title={autoSave ? '自动保存：开（拖动后自动写入 layout.json）' : '自动保存：关（需手动点 💾）'}
          className={
            'rounded-md px-1.5 py-1 text-[11px] transition-colors ' +
            (autoSave
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
              : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-2)]')
          }
        >
          自动
        </button>
        <button
          onClick={onSaveLayout}
          title="保存当前布局到 .codesee/layout.json（首次会请求授权选择 .codesee 目录）"
          className="relative rounded-md px-2 py-1 text-[11px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]"
        >
          💾
        </button>
        <button
          onClick={onResetLayout}
          title="重置布局（清除当前视图保存的位置）"
          className="rounded-md px-2 py-1 text-[11px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]"
        >
          ↺
        </button>
      </div>
      {tipText && (
        <div className="pointer-events-none mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
          {tipText}
        </div>
      )}
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
