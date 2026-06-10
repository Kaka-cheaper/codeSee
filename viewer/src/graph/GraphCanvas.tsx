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
  saveLayoutFile,
  getStoredHandle,
  ensurePermission,
  type LayoutFile,
} from '@/fcg/fileSystem'
import { findBundledByRepoId } from '@/fcg/bundledProjects'
import { EpicNodeView, type EpicNodeData } from './EpicNodeView'
import { FeatureNodeView, type FeatureNodeData } from './FeatureNodeView'
import { StepNodeView, type StepNodeData } from './StepNodeView'
import { CROSS_META, FLOW_META, ROLE_META, type CrossKind } from './roleMeta'
import { DetailsPanel } from './DetailsPanel'
import { TourPanel, TourStartButton } from './TourMode'
import { tourVisibleNodeIds, type TourPlay } from './tourLogic'
import { EpicGroupBg, type EpicGroupBgData } from './EpicGroupBg'
import { useI18n } from '@/lib/i18n'
import { Save } from 'lucide-react'
import type { LaidOutNode, LayoutGroup } from './layout'

interface Props {
  file: FeaturesFile
  /** 上层传入的项目 id（用于 bundled 项目识别 + localStorage 分桶）。
   *  没有时退化为 file.manifest.repo。 */
  activeRepoId?: string | null
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

export function GraphCanvas({ file, activeRepoId }: Props) {
  return <GraphInner file={file} activeRepoId={activeRepoId} />
}

function GraphInner({ file, activeRepoId }: Props) {
  const [state, setState] = useState<FcgViewState>({ mode: 'overview' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** hover 节点 id：用于实时降噪——hover 时其他节点和边淡出，相关边加亮 */
  const [hoverId, setHoverId] = useState<string | null>(null)
  /** 导览播放状态（声明放最前：多个早期 effect 要引用它） */
  const [tourPlay, setTourPlay] = useState<TourPlay | null>(null)
  const reactFlow = useReactFlow()

  const view = useMemo(() => buildView(file, state), [file, state])
  const viewKey = viewKeyOf(state)

  // 项目标识：上层传入优先（bundled 项目用 bundled:slug 作识别），回退到 manifest.repo
  const repoId = useMemo(
    () => activeRepoId ?? file.manifest.repo ?? 'default',
    [activeRepoId, file.manifest.repo],
  )

  // 节点位置缓存（按 viewKey 分桶）：启动时从 localStorage 加载（草稿）
  const positionsRef = useRef<
    Map<string, Map<string, { x: number; y: number }>>
  >(loadPositions(repoId))

  // 概览版本号：每次概览视图中发生拖动时递增
  // 功能视图只在概览版本变化时才重新从概览计算基准位置
  const overviewVersionRef = useRef(0)
  const lastOverviewVersionForFeaturesRef = useRef(-1)

  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set())
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const measuredSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map())
  const [layoutVersion, setLayoutVersion] = useState(0) // 用于重置布局

  // 启动时尝试加载布局，优先级：
  //   1. 用户已拖动过的位置（localStorage 已经在 positionsRef 初始化时加载）
  //      → 任意视图有非空缓存就跳过 fetch，让用户拖动结果延续
  //   2. FSA 已授权目录里的 layout.json
  //   3. 内置项目精挑布局（bundled.layoutUrl）
  //   4. 通用兜底 /layout.json
  useEffect(() => {
    let cancelled = false
    async function loadLayout() {
      // 1. localStorage 已有任一视图的拖动位置 → 用户拖过，不再用 fetch 覆盖
      const hasUserPositions = [...positionsRef.current.values()].some((m) => m.size > 0)
      if (hasUserPositions) return

      // 2. FSA 授权目录
      let layout: LayoutFile | null = await loadLayoutFile(repoId)

      // 3. 内置项目精挑布局
      if (!layout) {
        const bundled = findBundledByRepoId(repoId)
        if (bundled?.layoutUrl) {
          try {
            const res = await fetch(bundled.layoutUrl, { cache: 'no-cache' })
            if (res.ok) {
              const data = await res.json()
              if (data?.version === '0' && data?.views) layout = data
            }
          } catch { /* noop */ }
        }
      }

      // 4. 通用兜底
      if (!layout) {
        try {
          const base = import.meta.env.BASE_URL ?? '/'
          const res = await fetch(`${base}layout.json`, { cache: 'no-cache' })
          if (res.ok) {
            const data = await res.json()
            if (data?.version === '0' && data?.views) layout = data
          }
        } catch { /* noop */ }
      }

      if (cancelled || !layout) return
      const restored = new Map<string, Map<string, { x: number; y: number }>>()
      for (const [vk, positions] of Object.entries(layout.views)) {
        restored.set(vk, new Map(Object.entries(positions as Record<string, { x: number; y: number }>)))
      }
      positionsRef.current = restored
      setLayoutVersion((v) => v + 1)
    }
    loadLayout()
    return () => { cancelled = true }
  }, [repoId])

  // 自动保存开关（持久化到 localStorage）
  // 默认 OFF——FSA 需要用户主动授权目录后才能真正自动保存。
  // key 用 v2 区分旧版本（旧版本默认 ON 但实际不工作，会污染用户预期）
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    try {
      return localStorage.getItem('codesee.autoSave.v2') === 'true'
    } catch {
      return false
    }
  })
  const setAutoSavePersist = useCallback((next: boolean) => {
    setAutoSave(next)
    try { localStorage.setItem('codesee.autoSave.v2', String(next)) } catch { /* noop */ }
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

  // 开发者用：在 DevTools 控制台调 codeseeExportLayout() 把当前布局保存为 <slug>-layout.json。
  //
  // 仅 dev 模式注册，生产构建里不存在。
  // 自动过滤掉与当前 file 节点无关的 viewKey（旧示例残留）。
  //
  // 使用流程（首次）：
  //   1. 在画布拖到满意位置
  //   2. 控制台输入 codeseeExportLayout()
  //   3. 弹目录选择器 → 选 viewer/public/examples/ → 允许 readwrite
  //   4. 直接写入 codesee-layout.json，无需手动复制粘贴
  //   首次授权后浏览器记住目录句柄，后续每次调用直接写。
  //
  // 备用：codeseeExportLayout({ download: true }) 强制走浏览器下载。
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { codeseeExportLayout?: (opts?: { download?: boolean }) => Promise<void> }
    const EXPORT_HANDLE_KEY = 'codesee-layout-export-dir'

    w.codeseeExportLayout = async (opts = {}) => {
      // 收集当前 file 中所有合法的 epic / feature / step id
      const validIds = new Set<string>()
      for (const e of file.epics) validIds.add(`epic:${e.id}`)
      for (const f of file.features) {
        validIds.add(`feature:${f.id}`)
        for (const s of f.steps) validIds.add(`step:${f.id}:${s.id}`)
      }
      const validStepsViews = new Set<string>(file.features.map((f) => `steps:${f.id}`))

      const cleanedViews: Record<string, Record<string, { x: number; y: number }>> = {}
      const layout = serializeLayout()
      for (const [vk, positions] of Object.entries(layout.views)) {
        if (vk.startsWith('steps:') && !validStepsViews.has(vk)) continue
        const cleaned: Record<string, { x: number; y: number }> = {}
        for (const [nodeId, pos] of Object.entries(positions)) {
          if (nodeId.startsWith('group:')) {
            const epicId = nodeId.slice(6)
            if (file.epics.some((e) => e.id === epicId)) cleaned[nodeId] = pos
            continue
          }
          if (validIds.has(nodeId)) cleaned[nodeId] = pos
        }
        if (Object.keys(cleaned).length > 0) cleanedViews[vk] = cleaned
      }

      const cleaned: LayoutFile = {
        version: '0',
        views: cleanedViews,
        generated_at: new Date().toISOString(),
      }
      const json = JSON.stringify(cleaned, null, 2)
      const fileName = `${repoId}-layout.json`

      if (opts.download || !isFSASupported()) {
        // 强制下载或浏览器不支持 FSA → 走 download 路径
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        console.log(`[CodeSee] 已下载 ${fileName}`)
        return
      }

      // FSA 路径：尝试复用已授权的目录；否则弹 picker 让用户选 viewer/public/examples/
      try {
        let dirHandle = await getStoredHandle(EXPORT_HANDLE_KEY)
        if (!dirHandle) {
          // 直接调 showDirectoryPicker（不走 pickDirectory 包装），
          // 因为后者会吞掉所有错误，无法区分"用户取消"和"无用户手势"
          try {
            // @ts-expect-error showDirectoryPicker 不在标准 typings
            dirHandle = await window.showDirectoryPicker({
              id: 'codesee-layout-export',
              mode: 'readwrite',
              startIn: 'documents',
            })
            // 持久化到 IDB（与 fileSystem.ts 共用 store）
            await (await import('@/fcg/fileSystem')).getStoredHandle // noop import to avoid unused warning
            // 直接复用 fileSystem.ts 的 setStoredHandle 流程
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const req = indexedDB.open('codesee-fs-handles', 3)
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            await new Promise<void>((res) => {
              const tx = db.transaction('directories', 'readwrite')
              tx.objectStore('directories').put(dirHandle, EXPORT_HANDLE_KEY)
              tx.oncomplete = () => res()
              tx.onerror = () => res()
            })
          } catch (err) {
            const e = err as Error
            if (e?.name === 'AbortError') {
              console.warn('[CodeSee] 用户取消了目录选择，未保存。')
            } else if (e?.name === 'SecurityError') {
              console.warn('[CodeSee] 控制台调用 showDirectoryPicker 需要用户手势——请在选目录前先点一下页面（如点画布空白处）再调 codeseeExportLayout()。\n或用备用方案：codeseeExportLayout({ download: true })')
            } else {
              console.error('[CodeSee] 选择目录失败：', err)
            }
            return
          }
        }
        const ok = await ensurePermission(dirHandle!)
        if (!ok) {
          console.warn('[CodeSee] 权限被拒，未保存。')
          return
        }
        const fileHandle = await dirHandle!.getFileHandle(fileName, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(json)
        await writable.close()
        console.log(`[CodeSee] 已写入 ${dirHandle!.name}/${fileName}（${json.length} 字符）。下次直接调 codeseeExportLayout() 即可，无需重新授权。`)
      } catch (err) {
        console.error('[CodeSee] 写入失败：', err)
        console.log('[CodeSee] 备用方案：codeseeExportLayout({ download: true })')
      }
    }
    return () => { delete w.codeseeExportLayout }
  }, [serializeLayout, repoId, file])

  // toggleAutoSave 智能化：
  // - 当前 ON → 关闭
  // - 当前 OFF → 启用：
  //     * 已有目录授权 → 直接 ensurePermission（仅小权限框，绝不弹文件夹选择器）
  //     * 没有目录授权 → 提示用户先点"打开"按钮选择目录
  // 关键：FSA 的 requestPermission 必须在用户手势同步调用栈内调用
  const toggleAutoSave = useCallback(async () => {
    if (autoSave) {
      setAutoSavePersist(false)
      return
    }
    // 不支持 FSA：直接开（仅 localStorage 草稿）
    if (!isFSASupported()) {
      setAutoSavePersist(true)
      return
    }
    // 已有 stored handle：直接 ensurePermission（不弹文件夹选择器！）
    const stored = await getStoredHandle(repoId)
    if (stored) {
      const ok = await ensurePermission(stored)
      if (ok) {
        // 写一次当前布局，然后开启
        await saveLayoutFile(repoId, serializeLayout()).catch(() => { /* noop */ })
        setAutoSavePersist(true)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1500)
        return
      }
      // 授权被拒：保持 OFF，提示用户
      setSaveStatus('failed')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }
    // 没有 stored handle：不在这里弹 picker——
    // 让用户去顶部"打开"按钮选目录，那里才是统一的授权入口
    setSaveStatus('failed')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [autoSave, repoId, setAutoSavePersist, serializeLayout])

  // 手动保存
  // 关键：永远不重新弹 directory picker——已授权的目录全程复用
  // 如果没有目录授权，提示用户先点"打开"按钮选择目录
  const saveLayout = useCallback(async () => {
    console.log('[CodeSee Save] 开始保存, repoId:', repoId)
    savePositions(repoId, positionsRef.current)

    if (!isFSASupported()) {
      console.log('[CodeSee Save] FSA 不支持，只存 localStorage')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }

    // 检查是否有已授权的目录
    const stored = await getStoredHandle(repoId)
    if (!stored) {
      // 没授权过任何目录：localStorage 已写完，给"saved"提示
      // （之后用户去点"打开"按钮选目录，下次保存才会写到磁盘）
      console.log('[CodeSee Save] 没有目录授权，仅存 localStorage')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }

    // 已有授权的目录：确保权限（必要时弹小权限框，绝不弹 picker）
    const ok = await ensurePermission(stored)
    if (!ok) {
      setSaveStatus('failed')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }

    // 写文件
    const result = await saveLayoutFile(repoId, serializeLayout())
    console.log('[CodeSee Save] saveLayoutFile 结果:', result)
    setSaveStatus(result === 'wrote' ? 'saved' : 'failed')
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

  // React Flow 受控模式：拖动/选中等内部变化必须通过这两个回调同步到 state
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => {
      let updated = applyNodeChanges(changes, nds)

      // 检测容器拖动：如果 group 节点位置变了，内部节点跟着移动
      let userDragging = false
      let groupDragging = false
      let draggedGroupEpicId: string | null = null
      let groupDx = 0
      let groupDy = 0

      for (const change of changes) {
        if (change.type !== 'position' || !change.position || !change.dragging) continue
        userDragging = true
        const nodeId = change.id
        if (!nodeId.startsWith('group:')) continue
        groupDragging = true
        const epicId = nodeId.replace(/^group:/, '')
        draggedGroupEpicId = epicId
        const oldGroup = nds.find((n) => n.id === nodeId)
        if (!oldGroup) continue
        const dx = (change.position.x ?? 0) - oldGroup.position.x
        const dy = (change.position.y ?? 0) - oldGroup.position.y
        groupDx = dx
        groupDy = dy
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

        // 功能视图：区分容器拖动 vs 节点独立拖动
        const isFeatureView = viewKey === 'features'
        if (isFeatureView) {
          const basePositions = positionsRef.current.get('features-base')
          if (basePositions) {
            if (groupDragging && draggedGroupEpicId) {
              // 容器拖动：只更新容器级偏移量，不更新节点独立偏移量
              let groupOffsets = positionsRef.current.get('features-group-offset')
              if (!groupOffsets) {
                groupOffsets = new Map()
                positionsRef.current.set('features-group-offset', groupOffsets)
              }
              const prevOffset = groupOffsets.get(draggedGroupEpicId) ?? { x: 0, y: 0 }
              groupOffsets.set(draggedGroupEpicId, {
                x: prevOffset.x + groupDx,
                y: prevOffset.y + groupDy,
              })
            } else {
              // 节点独立拖动：更新节点级偏移量（减去容器偏移后的净偏移）
              let offsets = positionsRef.current.get('features-offset')
              if (!offsets) {
                offsets = new Map()
                positionsRef.current.set('features-offset', offsets)
              }
              const groupOffsets = positionsRef.current.get('features-group-offset')
              for (const n of finalNodes) {
                if (n.type === 'epicGroup') continue
                const base = basePositions.get(n.id)
                if (!base) continue
                // 节点偏移 = 当前位置 - 基准位置 - 容器偏移
                const data = n.data as { view?: { kind?: string; feature?: { epicId?: string } } } | undefined
                const nEpicId = data?.view?.kind === 'feature' ? (data.view.feature?.epicId ?? '__none__') : null
                const gOffset: { x: number; y: number } = (nEpicId ? groupOffsets?.get(nEpicId) : undefined) ?? { x: 0, y: 0 }
                offsets.set(n.id, {
                  x: n.position.x - base.x - gOffset.x,
                  y: n.position.y - base.y - gOffset.y,
                })
              }
            }
          }
        }

        // 概览视图拖动时递增版本号，通知功能视图需要重算基准
        if (viewKey === 'overview') {
          overviewVersionRef.current += 1
        }

        // localStorage 永远写——这是浏览器无感记忆的核心，刷新后能恢复
        // autoSave 仅控制是否额外写到 FSA 文件
        savePositions(repoId, positionsRef.current)
        if (autoSave) {
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
        // 如果概览没变过且已有功能视图缓存，直接用缓存（不重算基准）
        const featuresCache = positionsRef.current.get('features')
        const overviewUnchanged = lastOverviewVersionForFeaturesRef.current === overviewVersionRef.current
        if (overviewUnchanged && featuresCache && featuresCache.size > 0) {
          // 直接用缓存位置
          const r = mergeWithPrevious(layoutResult, featuresCache)
          finalNodes = r.merged
          newIds = r.newIds
          // 用缓存位置修正容器包围盒
          if (groups.length > 0) {
            const corrected = recalcGroupBounds(finalNodes, groups)
            for (let gi = 0; gi < groups.length; gi++) {
              groups[gi] = corrected[gi]
            }
          }
        } else {
          // 概览变了或首次进入：从概览重算基准 + 叠加偏移量
          lastOverviewVersionForFeaturesRef.current = overviewVersionRef.current

          // 先叠加容器级偏移量，再叠加节点级偏移量
          const groupOffsets = positionsRef.current.get('features-group-offset')
          if (groupOffsets && groupOffsets.size > 0) {
            finalNodes = finalNodes.map((n) => {
              if (n.view.kind !== 'feature') return n
              const epicId = n.view.feature.epicId ?? '__none__'
              const gOffset = groupOffsets.get(epicId)
              if (!gOffset) return n
              return { ...n, position: { x: n.position.x + gOffset.x, y: n.position.y + gOffset.y } }
            })
          }
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
            // 先根据当前节点位置计算容器的实际包围盒（偏移后的）
            const preCollisionGroups = recalcGroupBounds(finalNodes, groups)
            const updatedGroups = resolveContainerCollisions(finalNodes, groups)
            // 如果容器被推开了，内部节点也要跟着动
            for (let gi = 0; gi < groups.length; gi++) {
              const beforeG = preCollisionGroups[gi]
              const afterG = updatedGroups[gi]
              const dx = afterG.position.x - beforeG.position.x
              const dy = afterG.position.y - beforeG.position.y
              if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
              const epicId = afterG.id.replace(/^group:/, '')
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
        }
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
    // 导览激活时镜头由导览自己编排，全局 fitView 不许抢镜
    if (tourPlay) return
    const t = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 320 })
    }, 80)
    return () => window.clearTimeout(t)
  }, [viewKey, reactFlow, layoutVersion, tourPlay])

  const resetLayout = useCallback(() => {
    positionsRef.current.delete(viewKey)
    positionsRef.current.delete('features-offset')
    positionsRef.current.delete('features-base')
    positionsRef.current.delete('features-group-offset')
    // 强制功能视图下次进入时重算基准
    lastOverviewVersionForFeaturesRef.current = -1
    clearPositions(repoId, viewKey)
    setLayoutVersion((v) => v + 1)
  }, [viewKey, repoId, setLayoutVersion])

  /* ==================== 导览模式 ==================== */
  const firstTour = file.tours?.[0]

  const startTour = useCallback(() => {
    const tour = file.tours?.[0]
    if (!tour || tour.steps.length === 0) return
    setSelectedId(null)
    setHoverId(null)
    // 视图档位由下面的同步 effect 按当前步自动切（骨架步→概览，细节步→功能）
    setTourPlay({ tour, stepIndex: 0, phase: 'ask' })
  }, [file.tours])

  /** 退出/完成共用：解锁全图 + 镜头拉回全景（马提尼杯的杯口） */
  const exitTour = useCallback(() => {
    setTourPlay(null)
    window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 500 })
    }, 100)
  }, [reactFlow])

  const revealTourStep = useCallback(() => {
    setTourPlay((p) => (p ? { ...p, phase: 'shown' } : p))
  }, [])

  const nextTourStep = useCallback(() => {
    setTourPlay((p) => {
      if (!p) return p
      if (p.stepIndex >= p.tour.steps.length - 1) return p // 最后一步由 onExit 收尾
      return { ...p, stepIndex: p.stepIndex + 1, phase: 'ask' }
    })
  }, [])

  /** 当前进度的可见/当前节点集合（导览未激活时为 null → 全部直通） */
  const tourVisibility = useMemo(() => {
    if (!tourPlay) return null
    return tourVisibleNodeIds(file, tourPlay)
  }, [file, tourPlay])

  /** 视图档位跟随当前步：骨架步在概览（Epic 真节点 + 主线边），细节步在功能视图 */
  useEffect(() => {
    if (!tourVisibility) return
    const mode = tourVisibility.mode
    setState((prev) =>
      prev.mode === mode && !prev.focusedFeatureId ? prev : { mode },
    )
  }, [tourVisibility])

  /**
   * 渲染过滤用 useMemo 派生，绝不 setState patch——
   * rfNodes 是布局/拖动的唯一真值源，导览只是在出口处做减法，
   * 这样进退导览、点亮节点都不会触发布局重算或位置漂移。
   */
  const displayNodes = useMemo(() => {
    if (!tourVisibility) return rfNodes
    const { visible, current } = tourVisibility
    return rfNodes.map((n) => {
      const isVisible = visible.has(n.id)
      const oldData = n.data as Record<string, unknown>
      return {
        ...n,
        hidden: !isVisible,
        // 已走过的步骤保持微弱可见（空间记忆锚点），当前步全亮
        data: { ...oldData, dimmed: isVisible && !current.has(n.id) && current.size > 0 },
      }
    })
  }, [rfNodes, tourVisibility])

  const displayEdges = useMemo(() => {
    if (!tourVisibility) return rfEdges
    const { visible } = tourVisibility
    return rfEdges.map((e) => ({
      ...e,
      hidden: !(visible.has(e.source) && visible.has(e.target)),
    }))
  }, [rfEdges, tourVisibility])

  /**
   * 揭晓时镜头推到当前步的节点（包围盒 + 留白）。
   * 依赖里带 rfNodes：视图档位刚切换时 ELK 布局是异步的，
   * 第一次 fitView 可能扑空——布局落地后 rfNodes 变化会再触发一次补拍。
   */
  useEffect(() => {
    if (!tourPlay || tourPlay.phase !== 'shown' || !tourVisibility) return
    const ids = tourVisibility.current
    if (ids.size === 0) return
    const t = window.setTimeout(() => {
      const nodes = reactFlow.getNodes().filter((n) => ids.has(n.id))
      if (nodes.length === 0) return
      reactFlow.fitView({ nodes, padding: 0.45, duration: 600 })
    }, 120)
    return () => window.clearTimeout(t)
  }, [tourPlay, tourVisibility, reactFlow, rfNodes])

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      // 导览中禁止双击下钻——视图切换会破坏逐盏点亮的舞台
      if (tourPlay) return
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
    [view.nodes, reactFlow, tourPlay],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id)
  }, [])

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    setHoverId(node.id)
  }, [])
  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoverId(null)
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

  /**
   * Hover/锁定降噪：
   *   - hover 任意节点 → 临时聚焦
   *   - 鼠标离开但有 selected → 保持锁定聚焦（鼠标移到详情面板 / 滚动画布都不会失焦）
   *   - hover 优先于锁定（实时预览另一个节点的关系）
   * 行为：
   *   - 与焦点节点直接相连的边 → 加粗 + 完全不透明
   *   - 不相关的边 → 淡出到 18%
   *   - 相关节点（焦点 + 邻居 + 同 Epic 容器） → 不变
   *   - 不相关节点 → dimmed=true，由节点视图加灰
   * focusId=null 时全部复位。
   */
  const focusId = hoverId ?? selectedId

  /**
   * 相关节点集合：选中/hover 一个节点时，所有"应该高亮的节点"。
   * 给 MiniMap 着色 + DetailsPanel 聚焦按钮使用。
   *
   * ⚠ 不要把这个 useMemo 加到下面 patch effect 的依赖里 ——
   *   useMemo 依赖 rfEdges/rfNodes 引用, 而 effect 又会 setRfEdges/setRfNodes,
   *   一旦把 relatedNodeIds 当依赖会触发无限循环（"Maximum update depth exceeded"）。
   *   patch effect 自己用 .length 当依赖, 内部就地重算同样的集合即可。
   *
   * useMemo 自身的依赖也用 .length（与 effect 对称），避免每帧 patch 都让
   * minimap nodeColor 跟着重算（性能噪音）。focusId 不变时，相关集合也不变。
   */
  const relatedNodeIds = useMemo(() => {
    const set = new Set<string>()
    if (!focusId) return set
    set.add(focusId)
    for (const e of rfEdges) {
      if (e.source === focusId) set.add(e.target)
      if (e.target === focusId) set.add(e.source)
    }
    const focused = rfNodes.find((n) => n.id === focusId)
    if (focused?.type === 'feature') {
      const epicId = (focused.data as { view?: { feature?: { epicId?: string } } } | undefined)
        ?.view?.feature?.epicId ?? '__none__'
      set.add(`group:${epicId}`)
    }
    if (focused?.type === 'epicGroup') {
      const epicId = focusId.replace(/^group:/, '')
      for (const n of rfNodes) {
        if (n.type === 'epicGroup') continue
        const nEpicId = (n.data as { view?: { feature?: { epicId?: string } } } | undefined)
          ?.view?.feature?.epicId ?? null
        if (nEpicId === epicId) set.add(n.id)
      }
    }
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, rfEdges.length, rfNodes.length])

  useEffect(() => {
    // 就地重算相关节点集合（不能依赖 useMemo, 见上面注释）
    const relatedNodes = new Set<string>()
    if (focusId) {
      relatedNodes.add(focusId)
      for (const e of rfEdges) {
        if (e.source === focusId) relatedNodes.add(e.target)
        if (e.target === focusId) relatedNodes.add(e.source)
      }
      const focused = rfNodes.find((n) => n.id === focusId)
      if (focused?.type === 'feature') {
        const epicId = (focused.data as { view?: { feature?: { epicId?: string } } } | undefined)
          ?.view?.feature?.epicId ?? '__none__'
        relatedNodes.add(`group:${epicId}`)
      }
      if (focused?.type === 'epicGroup') {
        const epicId = focusId.replace(/^group:/, '')
        for (const n of rfNodes) {
          if (n.type === 'epicGroup') continue
          const nEpicId = (n.data as { view?: { feature?: { epicId?: string } } } | undefined)
            ?.view?.feature?.epicId ?? null
          if (nEpicId === epicId) relatedNodes.add(n.id)
        }
      }
    }

    // patch 边 style
    setRfEdges((eds) =>
      eds.map((edge) => {
        const visual = (edge.data as { visual?: EdgeVisual } | undefined)?.visual
        if (!visual) return edge
        if (!focusId) {
          return {
            ...edge,
            style: {
              ...edge.style,
              stroke: visual.stroke,
              strokeWidth: visual.strokeWidth,
              strokeDasharray: visual.dashed ? '4 4' : undefined,
              opacity: visual.baseOpacity,
            },
          }
        }
        const isRelated = edge.source === focusId || edge.target === focusId
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: visual.stroke,
            strokeWidth: isRelated ? visual.strokeWidth + 0.8 : visual.strokeWidth,
            strokeDasharray: visual.dashed ? '4 4' : undefined,
            opacity: isRelated ? 1 : 0.18,
          },
        }
      }),
    )

    // patch 节点 data.dimmed
    setRfNodes((nds) =>
      nds.map((n) => {
        const dimmed = focusId !== null && !relatedNodes.has(n.id)
        const oldData = n.data as Record<string, unknown> | undefined
        const oldDimmed = (oldData?.dimmed as boolean | undefined) ?? false
        if (oldDimmed === dimmed) return n
        return { ...n, data: { ...(oldData ?? {}), dimmed } }
      }),
    )
  }, [focusId, rfEdges.length, rfNodes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault()
        handleRedo()
      } else if (e.key === 'Escape') {
        // 清掉焦点锁定（hover 不受影响——离开鼠标自然清）
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  /**
   * "聚焦相关" 行为：把当前焦点 + 所有相关节点 fit 到视口。
   * 用 reactFlow.fitView 的 nodes 数组形态，自动算 bounding box + 留白。
   * 节点不存在 / 没焦点时 noop。
   */
  const focusRelated = useCallback(() => {
    if (!focusId || relatedNodeIds.size === 0) return
    const nodes = reactFlow.getNodes().filter((n) => relatedNodeIds.has(n.id))
    if (nodes.length === 0) return
    reactFlow.fitView({ nodes, padding: 0.3, duration: 400 })
  }, [focusId, relatedNodeIds, reactFlow])

  /**
   * 浏览历史栈：实现详情面板的"上一个"按钮（浏览器式 back-only stack）。
   *
   * 行为：
   *   - navigateToNode 把"当前 selectedId"压栈, 把目标设为新的当前
   *   - goBack 弹栈 → 把弹出的设为新的当前 (用 navigateWithoutHistory, 不再 push)
   *   - 切换视图 (mode 变化) 时栈清空, 因为节点 id 命名空间变了
   *     ("feature:xxx" 在 overview 视图下根本不存在)
   *   - 关闭详情面板不清栈 → 用户重新选节点时栈仍可用
   *
   * historyRef 用 ref 是为了避免 push 触发 re-render；
   * canGoBack 单独用 state 是因为它驱动按钮的 disabled, 必须能重渲染。
   */
  const historyRef = useRef<string[]>([])
  const [canGoBack, setCanGoBack] = useState(false)

  /** 视图切换 → 清栈, 因为 id 命名空间变了 */
  useEffect(() => {
    historyRef.current = []
    setCanGoBack(false)
  }, [state.mode, state.focusedFeatureId])

  /** 内部跳转, 不动历史栈 (goBack 用) */
  const navigateWithoutHistory = useCallback((nodeId: string) => {
    setSelectedId(nodeId)
    window.setTimeout(() => {
      const target = reactFlow.getNodes().find((n) => n.id === nodeId)
      if (!target) return
      reactFlow.fitView({ nodes: [{ id: nodeId }], padding: 0.5, duration: 400 })
    }, 60)
  }, [reactFlow])

  /**
   * 跳转到指定节点：详情面板"上下游 / 关联功能"列表项点击触发。
   *
   * 顺序很关键：先 setSelectedId（详情面板切到目标 + 触发高亮 patch effect），
   * 再在 setTimeout 里 fitView。如果反过来或同步连发，setSelectedId 引发的
   * setRfNodes / setRfEdges 会让 React Flow 内部状态在 fitView 动画期间重置,
   * 表现为"按钮按了画布没动"。
   * 60ms 足够 React 完成本轮 commit + patch effect, 然后 fitView 干净启动。
   */
  const navigateToNode = useCallback((nodeId: string) => {
    // 把当前 selectedId 压栈 (除非要跳的就是当前)
    if (selectedId && selectedId !== nodeId) {
      historyRef.current.push(selectedId)
      // 上限 30: 避免长时间使用导致栈无限增长
      if (historyRef.current.length > 30) historyRef.current.shift()
      setCanGoBack(true)
    }
    navigateWithoutHistory(nodeId)
  }, [selectedId, navigateWithoutHistory])

  /** "上一个"按钮：弹栈, 跳到弹出的节点 */
  const goBack = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    setCanGoBack(historyRef.current.length > 0)
    // 跳之前确认目标节点还在当前视图里 (理论上视图切换会清栈, 但兜底)
    const exists = reactFlow.getNodes().some((n) => n.id === prev)
    if (exists) {
      navigateWithoutHistory(prev)
    } else {
      // 目标已不存在 → 跳过这条, 继续弹下一个
      goBack()
    }
  }, [reactFlow, navigateWithoutHistory])

  /**
   * 详情面板列表项 hover：让画布上对应节点临时高亮（复用 hoverId）。
   * 鼠标移开列表项 → 传 null 即可恢复。
   */
  const previewNode = useCallback((nodeId: string | null) => {
    setHoverId(nodeId)
  }, [])

  /** 当前视图实际渲染的节点 id 集合，给详情面板判断列表项可不可点 */
  const viewNodeIds = useMemo(() => new Set(view.nodes.map((n) => n.id)), [view.nodes])

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
        nodes={displayNodes}
        edges={displayEdges}
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
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="oklch(0.8 0.018 70)" />
        <MiniMap
          pannable
          zoomable
          // 左下角: 避开右侧 DetailsPanel; Controls 也在左下, minimap 在 Controls 之上
          position="bottom-left"
          // 整体尺寸略宽矮, 信息密度更高 (默认 200x150 在长画布上太方)
          style={{ width: 220, height: 150 }}
          // 视口框（当前视野）：用 accent 软色 + 半透明,
          // 跟暖白底融合, 不再是默认的硬白盒
          maskColor="oklch(0.948 0.012 80 / 0.5)"
          maskStrokeColor="oklch(0.62 0.135 45 / 0.4)"
          maskStrokeWidth={1}
          // 节点形状: 微圆角 + 极细描边 (描边色由 CSS 控制)
          nodeBorderRadius={3}
          nodeStrokeWidth={0.6}
          nodeColor={(n) => {
            // 焦点态着色：选中/hover 时让 minimap 也参与"哪个是焦点 / 谁相关 / 谁不相关"的视觉
            // - focus 自身    → 强 accent (暖橘饱和)
            // - 相关节点      → 弱 accent (暖橘淡)
            // - 不相关节点    → 极淡灰 (退到背景)
            // - 没 focus 时   → 按 kind 上色 (维持现状)
            if (focusId) {
              if (n.id === focusId) return 'oklch(0.62 0.135 45)'
              if (relatedNodeIds.has(n.id)) return 'oklch(0.78 0.08 45)'
              return 'oklch(0.88 0.01 70)'
            }
            if (n.type === 'step') {
              const data = n.data as unknown as StepNodeData | undefined
              if (data?.view.kind === 'step')
                return (ROLE_META[data.view.stepRole] ?? ROLE_META.other).minimap
            }
            if (n.type === 'feature') return 'oklch(0.78 0.04 60)'
            return 'oklch(0.78 0.05 240)'
          }}
        />
        <Controls position="bottom-left" />
      </ReactFlow>

      {!tourPlay && (
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
      )}

      {!tourPlay && firstTour && firstTour.steps.length > 0 && (
        <TourStartButton
          title={firstTour.title}
          stepCount={firstTour.steps.length}
          onStart={startTour}
        />
      )}

      {tourPlay && (
        <TourPanel
          key={tourPlay.stepIndex}
          play={tourPlay}
          onReveal={revealTourStep}
          onNext={tourPlay.stepIndex >= tourPlay.tour.steps.length - 1 ? exitTour : nextTourStep}
          onExit={exitTour}
        />
      )}

      {newNodeIds.size > 0 && state.mode === 'features' && !tourPlay && (
        <NewNodeIndicator count={newNodeIds.size} />
      )}

      <DetailsPanel
        view={selectedView}
        file={file}
        onClose={() => setSelectedId(null)}
        relatedCount={relatedNodeIds.size > 0 ? relatedNodeIds.size : 0}
        viewNodeIds={viewNodeIds}
        onFocusRelated={focusRelated}
        onNavigate={navigateToNode}
        onPreviewNode={previewNode}
        canGoBack={canGoBack}
        onGoBack={goBack}
      />
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
 * 根据当前节点位置重新计算容器包围盒（不做排斥，仅计算）。
 * 用于碰撞检测前获取"排斥前"的容器位置，以便正确计算推开 delta。
 */
function recalcGroupBounds(
  nodes: LaidOutNode[],
  groups: LayoutGroup[],
): LayoutGroup[] {
  const PAD = 60
  return groups.map((g) => {
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
    return {
      ...g,
      position: { x: minX - PAD, y: minY - PAD },
      width: (maxX - minX) + PAD * 2,
      height: (maxY - minY) + PAD * 2,
    }
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

/**
 * 边视觉的基础样式（不含 hover 派生）。
 * 4 种 cross_feature kind 各有独立颜色与虚实，避免画面"全是同色虚线乱麻"。
 */
interface EdgeVisual {
  stroke: string
  strokeWidth: number
  dashed: boolean
  animated: boolean
  baseOpacity: number
}

function edgeVisualOf(e: FcgViewEdge): EdgeVisual {
  if (e.scope === 'step') {
    const m = (e.kind && FLOW_META[e.kind as keyof typeof FLOW_META]) ?? FLOW_META.next
    return {
      stroke: m.stroke,
      strokeWidth: 1.4,
      dashed: m.dashed,
      animated: m.animated,
      baseOpacity: 0.9,
    }
  }
  if (e.kind === 'epic-link') {
    return {
      stroke: 'var(--color-edge-import)',
      strokeWidth: 1.4,
      dashed: true,
      animated: false,
      baseOpacity: 0.9,
    }
  }
  // 3 类 cross_feature kind
  if (e.kind.startsWith('cross-')) {
    const cross = e.kind.slice('cross-'.length) as CrossKind
    const meta = CROSS_META[cross]
    if (meta) {
      // flow + mode='async' → 虚线 + 动画，与同步 flow 区分
      const isAsync = cross === 'flow' && e.mode === 'async'
      return {
        stroke: meta.stroke,
        strokeWidth: meta.strokeWidth,
        dashed: meta.dashed || isAsync,
        animated: isAsync,
        baseOpacity: meta.opacity,
      }
    }
  }
  // 兜底
  return {
    stroke: 'var(--color-edge-call)',
    strokeWidth: 1.4,
    dashed: false,
    animated: false,
    baseOpacity: 0.9,
  }
}

function buildEdge(e: FcgViewEdge, newNodeIds: Set<string>): Edge {
  const v = edgeVisualOf(e)
  const involvesNew = newNodeIds.has(e.source) || newNodeIds.has(e.target)
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    animated: v.animated,
    label: e.label || undefined,
    labelStyle: { fill: 'var(--color-fg-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' },
    labelBgStyle: { fill: 'var(--color-bg-1)', fillOpacity: 0.85 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
    // 基础 style 用于 hover 离开时复位
    data: { visual: v },
    style: {
      stroke: v.stroke,
      strokeWidth: v.strokeWidth,
      strokeDasharray: v.dashed ? '4 4' : undefined,
      opacity: v.baseOpacity,
      animation: involvesNew ? 'edge-fade-in 360ms ease-out both' : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color: v.stroke },
  }
}

/* --------------------------------------------------------- UI */

function ViewSwitcher({ mode, focusedFeatureName, onChangeMode, onResetLayout, autoSave, onToggleAutoSave, onSaveLayout, saveStatus, onUndo, onRedo, canUndo, canRedo }: {
  mode: ViewMode
  focusedFeatureName?: string
  onChangeMode: (m: ViewMode) => void
  onResetLayout: () => void
  autoSave: boolean
  onToggleAutoSave: () => void | Promise<void>
  onSaveLayout: () => void
  saveStatus: 'idle' | 'saved' | 'downloaded' | 'failed'
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  const { t } = useI18n()
  const tipText =
    saveStatus === 'saved' ? t('view.saved') :
    saveStatus === 'downloaded' ? t('view.downloaded') :
    saveStatus === 'failed' ? t('view.failed') :
    null
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-1.5 py-1 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
        <ModeBtn active={mode === 'overview'} onClick={() => onChangeMode('overview')}>{t('view.overview')}</ModeBtn>
        <ModeBtn active={mode === 'features'} onClick={() => onChangeMode('features')}>{t('view.features')}</ModeBtn>
        <ModeBtn active={mode === 'steps'} onClick={() => mode === 'steps' && onChangeMode('steps')} disabled={mode !== 'steps'} title={mode !== 'steps' ? t('view.stepsNeedFeature') : undefined}>{t('view.steps')}</ModeBtn>
        <span className="mx-0.5 h-4 w-px bg-[var(--color-border)]" />
        <button
          onClick={onToggleAutoSave}
          title={autoSave ? t('view.autoOnTitle') : t('view.autoOffTitle')}
          className={
            'rounded-md px-1.5 py-1 text-[11px] transition-colors ' +
            (autoSave
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
              : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-2)]')
          }
        >
          {t('view.auto')}
        </button>
        <button
          onClick={onSaveLayout}
          title={t('view.saveTitle')}
          className="relative rounded-md px-1.5 py-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]"
        >
          <Save size={13} strokeWidth={2} />
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title={t('view.undoTitle')}
          className={'rounded-md px-1.5 py-1 text-[11px] transition-colors ' + (canUndo ? 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]' : 'text-[var(--color-fg-subtle)] opacity-40')}
        >
          ←
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title={t('view.redoTitle')}
          className={'rounded-md px-1.5 py-1 text-[11px] transition-colors ' + (canRedo ? 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]' : 'text-[var(--color-fg-subtle)] opacity-40')}
        >
          →
        </button>
        <button
          onClick={onResetLayout}
          title={t('view.resetTitle')}
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
          <span className="text-[var(--color-fg-subtle)]">{t('view.stepsLabel')}</span>
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
  const { t } = useI18n()
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
      <div className="pointer-events-auto rounded-full border px-3 py-1 text-[11.5px] shadow-[0_1px_2px_oklch(0_0_0/0.04)]"
        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-strong)', borderColor: 'var(--color-accent)' }}>
        {t('view.newNodes', { count })}
      </div>
    </div>
  )
}
