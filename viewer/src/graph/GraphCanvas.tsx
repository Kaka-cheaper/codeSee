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
import { useUndoRedo } from './useUndoRedo'
import {
  isFSASupported,
  loadLayoutFile,
  pickDirectory,
  saveLayoutFile,
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
  const [state, setState] = useState<FcgViewState>({ mode: 'overview' })
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

  // 手动保存
  // 关键：showDirectoryPicker 必须在用户手势的同步调用栈内触发
  // 所以不能在 await 之后调用它——必须作为 click 的第一个 async 操作
  const saveLayout = useCallback(async () => {
    console.log('[CodeSee Save] 开始保存, repoId:', repoId)
    savePositions(repoId, positionsRef.current)

    if (!isFSASupported()) {
      console.log('[CodeSee Save] FSA 不支持，只存 localStorage')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }

    console.log('[CodeSee Save] FSA 支持，尝试 saveLayoutFile...')
    // 直接尝试写文件（saveLayoutFile 内部会用 stored handle）
    const result = await saveLayoutFile(repoId, serializeLayout())
    console.log('[CodeSee Save] saveLayoutFile 结果:', result)
    if (result === 'wrote') {
      setSaveStatus('saved')
    } else {
      console.log('[CodeSee Save] 没有 handle，弹 pickDirectory...')
      // 没有 stored handle → 弹目录选择器
      const handle = await pickDirectory(repoId)
      console.log('[CodeSee Save] pickDirectory 结果:', handle)
      if (handle) {
        const retry = await saveLayoutFile(repoId, serializeLayout())
        console.log('[CodeSee Save] 重试 saveLayoutFile 结果:', retry)
        setSaveStatus(retry === 'wrote' ? 'saved' : 'failed')
      } else {
        setSaveStatus('saved') // 取消了，只存 localStorage
      }
    }
    setTimeout(() => setSaveStatus('idle'), 2500)
  }, [repoId, serializeLayout])

  // 文件自动保存防抖（拖动时 onTick 高频，但落盘只需偶尔一次）
  // ⚠ 自动保存永远不触发下载或弹窗——只在已授权时静默写文件
  const autoSaveTimerRef = useRef<number | null>(null)
  const scheduleAutoSaveFile = useCallback(() => {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (!isFSASupported()) return
      // 直接尝试写——如果没 handle 会返回 'no-handle'，静默忽略
      await saveLayoutFile(repoId, serializeLayout()).catch(() => { /* noop */ })
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
        let positionMap = positionsRef.current.get(viewKey)
        if (!positionMap) {
          positionMap = new Map()
          positionsRef.current.set(viewKey, positionMap)
        }
        for (const n of finalNodes) {
          if (n.type === 'epicGroup') continue
          positionMap.set(n.id, { x: n.position.x, y: n.position.y })
        }

        // 功能视图：计算偏移量 = 当前位置 - 基准位置
        const isFeatureView = viewKey === 'features'
        if (isFeatureView) {
          const basePositions = positionsRef.current.get('features-base')
          if (basePositions) {
            let offsets = positionsRef.current.get('features-offset')
            if (!offsets) {
              offsets = new Map()
              positionsRef.current.set('features-offset', offsets)
            }
            for (const n of finalNodes) {
              if (n.type === 'epicGroup') continue
              const base = basePositions.get(n.id)
              if (base) {
                offsets.set(n.id, { x: n.position.x - base.x, y: n.position.y - base.y })
              }
            }
          }
        }

        console.log('[CodeSee Drag] 写入缓存, viewKey:', viewKey, 'size:', positionMap.size)
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
      console.log('[CodeSee Layout] 功能视图布局, overviewPositions size:', overviewPositions?.size ?? 'undefined', 'keys:', overviewPositions ? [...overviewPositions.keys()].slice(0, 5) : 'N/A')
      const layoutResult = await layoutViewAsync(view.nodes, view.edges, epicNames, sizeMap, overviewPositions)
      if (cancelled) return

      // 方案 E：增量偏移模型
      // - 概览/流程视图：用自己的缓存保持用户拖动
      // - 功能视图：基准位置（从概览重算）+ 偏移量 = 最终位置
      const isFeatureView = view.nodes.length > 0 && view.nodes[0].kind === 'feature'
      let finalNodes = layoutResult.nodes
      let newIds = new Set<string>()
      const groups = layoutResult.groups

      if (isFeatureView) {
        // 功能视图：叠加偏移量
        const offsets = positionsRef.current.get('features-offset')
        if (offsets && offsets.size > 0) {
          finalNodes = finalNodes.map((n) => {
            const offset = offsets.get(n.view.id)
            if (!offset) return n
            return { ...n, position: { x: n.position.x + offset.x, y: n.position.y + offset.y } }
          })
        }

        // 偏移量叠加后，对容器做碰撞检测（防止偏移导致容器重叠）
        if (groups.length > 1) {
          const updatedGroups = resolveContainerCollisions(finalNodes, groups)
          // 如果容器被推开了，内部节点也要跟着动
          for (let gi = 0; gi < groups.length; gi++) {
            const oldG = groups[gi]
            const newG = updatedGroups[gi]
            const dx = newG.position.x - oldG.position.x
            const dy = newG.position.y - oldG.position.y
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
            const epicId = oldG.id.replace(/^group:/, '')
            finalNodes = finalNodes.map((n) => {
              if (n.view.kind !== 'feature') return n
              if ((n.view.feature.epicId ?? '__none__') !== epicId) return n
              return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            })
          }
          // 更新 groups 引用
          for (let gi = 0; gi < groups.length; gi++) {
            groups[gi] = updatedGroups[gi]
          }
        }

        // 存基准位置（用于后续计算偏移量）
        const basePositions = new Map<string, { x: number; y: number }>()
        for (const n of layoutResult.nodes) basePositions.set(n.view.id, n.position)
        positionsRef.current.set('features-base', basePositions)
      } else {
        // 概览/流程视图：用缓存保持用户拖动
        const prev = positionsRef.current.get(viewKey)
        if (prev && prev.size > 0) {
          const r = mergeWithPrevious(layoutResult, prev)
          finalNodes = r.merged
          newIds = r.newIds
        }
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
    positionsRef.current.delete('features-offset')
    positionsRef.current.delete('features-base')
    clearPositions(repoId, viewKey)
    setLayoutVersion((v) => v + 1)
  }, [viewKey, repoId])

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const v = view.nodes.find((n) => n.id === node.id)
      if (!v) return
      if (v.kind === 'epic') {
        setState({ mode: 'features' })
        // 延迟聚焦到对应容器（等布局完成后）
        const epicId = v.epic.id
        setTimeout(() => {
          const groupNodeId = `group:${epicId}`
          const nodes = reactFlow.getNodes()
          const target = nodes.find((n) => n.id === groupNodeId)
          if (target) {
            reactFlow.fitView({
              nodes: [target],
              padding: 0.5,
              duration: 400,
            })
          }
        }, 200)
      } else if (v.kind === 'feature') {
        setState({ mode: 'steps', focusedFeatureId: v.feature.id })
      }
    },
    [view.nodes, reactFlow],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id)
  }, [])

  // Undo/Redo
  const { record, undo, redo, canUndo, canRedo } = useUndoRedo()

  /** 拖动结束时记录快照 */
  const recordSnapshot = useCallback(() => {
    const nodes = reactFlow.getNodes()
    const snapshot = new Map<string, { x: number; y: number }>()
    for (const n of nodes) {
      if (n.type === 'epicGroup') continue
      snapshot.set(n.id, { x: n.position.x, y: n.position.y })
    }
    record(viewKey, snapshot)
  }, [reactFlow, viewKey, record])

  /** 应用一个快照到画布 */
  const applySnapshot = useCallback((snapshot: Map<string, { x: number; y: number }>) => {
    setRfNodes((nds) => {
      const updated = nds.map((n) => {
        const pos = snapshot.get(n.id)
        if (!pos) return n
        return { ...n, position: pos }
      })
      return updateGroupBounds(updated)
    })
    // 同步到 positionsRef
    positionsRef.current.set(viewKey, new Map(snapshot))
  }, [viewKey])

  const handleUndo = useCallback(() => {
    const nodes = reactFlow.getNodes()
    const current = new Map<string, { x: number; y: number }>()
    for (const n of nodes) {
      if (n.type === 'epicGroup') continue
      current.set(n.id, { x: n.position.x, y: n.position.y })
    }
    const prev = undo(viewKey, current)
    if (prev) applySnapshot(prev)
  }, [reactFlow, viewKey, undo, applySnapshot])

  const handleRedo = useCallback(() => {
    const nodes = reactFlow.getNodes()
    const current = new Map<string, { x: number; y: number }>()
    for (const n of nodes) {
      if (n.type === 'epicGroup') continue
      current.set(n.id, { x: n.position.x, y: n.position.y })
    }
    const next = redo(viewKey, current)
    if (next) applySnapshot(next)
  }, [reactFlow, viewKey, redo, applySnapshot])

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

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
        onNodeDragStop={recordSnapshot}
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo(viewKey)}
        canRedo={canRedo(viewKey)}
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

/**
 * 容器级碰撞检测：偏移量叠加后容器可能重叠，推开到刚好不重叠。
 * 输入：当前所有 feature 节点的最终位置 + groups 列表
 * 输出：推开后的 groups（位置和尺寸可能变了）
 * 不改偏移量——纯后处理。
 */
function resolveContainerCollisions(
  nodes: LaidOutNode[],
  groups: LayoutGroup[],
): LayoutGroup[] {
  const CONTAINER_GAP = 60

  // 重新计算每个容器的包围盒（基于当前节点位置）
  const updatedGroups = groups.map((g) => {
    const epicId = g.id.replace(/^group:/, '')
    const members = nodes.filter(
      (n) => n.view.kind === 'feature' && (n.view.feature.epicId ?? '__none__') === epicId,
    )
    if (members.length === 0) return { ...g }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const m of members) {
      minX = Math.min(minX, m.position.x)
      minY = Math.min(minY, m.position.y)
      maxX = Math.max(maxX, m.position.x + m.width)
      maxY = Math.max(maxY, m.position.y + m.height)
    }
    const PAD = 60
    return {
      ...g,
      position: { x: minX - PAD, y: minY - PAD },
      width: (maxX - minX) + PAD * 2,
      height: (maxY - minY) + PAD * 2,
    }
  })

  // 矩形排斥迭代
  for (let iter = 0; iter < 15; iter++) {
    let moved = false
    for (let i = 0; i < updatedGroups.length; i++) {
      for (let j = i + 1; j < updatedGroups.length; j++) {
        const a = updatedGroups[i]
        const b = updatedGroups[j]
        const aCx = a.position.x + a.width / 2
        const aCy = a.position.y + a.height / 2
        const bCx = b.position.x + b.width / 2
        const bCy = b.position.y + b.height / 2
        const overlapX = (a.width / 2 + b.width / 2 + CONTAINER_GAP) - Math.abs(aCx - bCx)
        const overlapY = (a.height / 2 + b.height / 2 + CONTAINER_GAP) - Math.abs(aCy - bCy)
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 1
            if (aCx <= bCx) {
              updatedGroups[i] = { ...a, position: { x: a.position.x - push, y: a.position.y } }
              updatedGroups[j] = { ...b, position: { x: b.position.x + push, y: b.position.y } }
            } else {
              updatedGroups[i] = { ...a, position: { x: a.position.x + push, y: a.position.y } }
              updatedGroups[j] = { ...b, position: { x: b.position.x - push, y: b.position.y } }
            }
          } else {
            const push = overlapY / 2 + 1
            if (aCy <= bCy) {
              updatedGroups[i] = { ...a, position: { x: a.position.x, y: a.position.y - push } }
              updatedGroups[j] = { ...b, position: { x: b.position.x, y: b.position.y + push } }
            } else {
              updatedGroups[i] = { ...a, position: { x: a.position.x, y: a.position.y + push } }
              updatedGroups[j] = { ...b, position: { x: b.position.x, y: b.position.y - push } }
            }
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }

  return updatedGroups
}

function toRfNodes(
  laid: LaidOutNode[],
  newIds: Set<string>,
  groups: LayoutGroup[] = [],
): Node[] {
  const groupNodes: Node<EpicGroupBgData>[] = groups.map((g, i) => ({
    id: g.id,
    type: 'epicGroup',
    position: g.position,
    draggable: true,
    selectable: false,
    data: { label: g.label, width: g.width, height: g.height, colorIndex: i },
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

function ViewSwitcher({ mode, focusedFeatureName, onChangeMode, onResetLayout, autoSave, onToggleAutoSave, onSaveLayout, saveStatus, onUndo, onRedo, canUndo, canRedo }: {
  mode: ViewMode
  focusedFeatureName?: string
  onChangeMode: (m: ViewMode) => void
  onResetLayout: () => void
  autoSave: boolean
  onToggleAutoSave: () => void
  onSaveLayout: () => void
  saveStatus: 'idle' | 'saved' | 'downloaded' | 'failed'
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
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
          onClick={onUndo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
          className={'rounded-md px-1.5 py-1 text-[11px] transition-colors ' + (canUndo ? 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]' : 'text-[var(--color-fg-subtle)] opacity-40')}
        >
          ←
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="重做 (Ctrl+Shift+Z)"
          className={'rounded-md px-1.5 py-1 text-[11px] transition-colors ' + (canRedo ? 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]' : 'text-[var(--color-fg-subtle)] opacity-40')}
        >
          →
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
